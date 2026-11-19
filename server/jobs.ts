import fs from 'fs';
import path from 'path';
import {
  SPEAKING_STYLES,
  VOICE_PERSONAS,
} from '../src/data/catalog.ts';
import type {
  AudioArtifact,
  RealVoiceId,
  SpeechControlsConfig,
  SynthesisJob,
} from '../src/types/studio.ts';
import {
  analyzeTargetDurationFeasibility,
  applyPronunciationDictionary,
  splitTextIntoChunks,
} from '../src/utils/persianText.ts';
import {
  getWaveformPeaks,
  measureLoudness,
  probeAudio,
  processAudioEdit,
  stitchAudioFiles,
} from './audio.ts';
import { synthesizeSingleSpeaker, translateGeminiError } from './gemini.ts';
import {
  TMP_DIR,
  appendHistory,
  ensureStorageDirs,
  getAudioPath,
  listDictionary,
  newId,
  saveArtifactMeta,
} from './storage.ts';

const jobsMap = new Map<string, SynthesisJob>();
const cancelledJobs = new Set<string>();

interface JobInternalConfig {
  controls: SpeechControlsConfig;
  projectTitle: string;
  maxCharsPerChunk: number;
}

const jobConfigs = new Map<string, JobInternalConfig>();

export function buildEffectiveStylePrompt(controls: SpeechControlsConfig): string {
  const styleObj = SPEAKING_STYLES.find((s) => s.id === controls.styleId);
  const basePrompt =
    controls.customStylePrompt?.trim() ||
    styleObj?.stylePromptEn ||
    'Natural Iranian Persian speech with clear articulation.';

  const parts = [basePrompt];
  if (controls.emotionalIntensity === 'low') {
    parts.push('Keep emotional intensity restrained and understated.');
  } else if (controls.emotionalIntensity === 'high') {
    parts.push('Use heightened emotional engagement and clear vocal dynamics.');
  }
  if (controls.expressiveness === 'restrained') {
    parts.push('Maintain even, steady prosody.');
  } else if (controls.expressiveness === 'expressive') {
    parts.push('Use expressive intonation and natural phrasing emphasis.');
  }
  if (controls.punctuationSensitivity === 'strict') {
    parts.push('Strictly observe all commas, colons, and sentence pauses.');
  }
  return parts.join(' ');
}

export function getJob(jobId: string): SynthesisJob | undefined {
  return jobsMap.get(jobId);
}

export function listAllJobs(): SynthesisJob[] {
  return Array.from(jobsMap.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function cancelJob(jobId: string): SynthesisJob | undefined {
  const job = jobsMap.get(jobId);
  if (!job) return undefined;
  cancelledJobs.add(jobId);
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    for (const c of job.chunks) {
      if (c.status === 'pending') c.status = 'cancelled';
    }
  }
  return job;
}

export function createAndStartJob(params: {
  title: string;
  text: string;
  controls: SpeechControlsConfig;
  maxCharsPerChunk?: number;
  targetDurationSec?: number | null;
  tolerancePercent?: number;
  autoTimeStretch?: boolean;
}): SynthesisJob {
  ensureStorageDirs();
  const dictionary = listDictionary();
  const { speechReadyText } = applyPronunciationDictionary(params.text, dictionary);
  const chunkLimit = Math.max(300, Math.min(2200, params.maxCharsPerChunk || 1000));
  const rawChunks = splitTextIntoChunks(speechReadyText, chunkLimit);

  if (rawChunks.length === 0) {
    throw new Error('متن برای تبدیل به گفتار خالی است.');
  }

  let feasibilityWarningFa: string | undefined;
  if (params.targetDurationSec && params.targetDurationSec > 0) {
    const check = analyzeTargetDurationFeasibility(speechReadyText, params.targetDurationSec);
    if (check.severity !== 'ok') {
      feasibilityWarningFa = check.messageFa;
    }
  }

  const jobId = newId('job');
  const stylePrompt = buildEffectiveStylePrompt(params.controls);

  const job: SynthesisJob = {
    id: jobId,
    title: params.title || 'پروژه آوا استودیو',
    status: 'queued',
    totalChunks: rawChunks.length,
    completedChunks: 0,
    chunks: rawChunks.map((text, index) => ({
      index,
      text,
      status: 'pending',
      attempts: 0,
    })),
    modelId: params.controls.modelId,
    voiceId: params.controls.voiceId,
    stylePrompt,
    pauseBetweenChunksMs: params.controls.paragraphPauseMs ?? 450,
    crossfadeMs: 25,
    targetDurationSec: params.targetDurationSec ?? null,
    tolerancePercent: params.tolerancePercent ?? 5,
    autoTimeStretch: Boolean(params.autoTimeStretch),
    feasibilityWarningFa,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobsMap.set(jobId, job);
  jobConfigs.set(jobId, {
    controls: params.controls,
    projectTitle: job.title,
    maxCharsPerChunk: chunkLimit,
  });

  void executeJob(jobId);
  return job;
}

export function resumeJob(jobId: string): SynthesisJob | undefined {
  const job = jobsMap.get(jobId);
  if (!job) return undefined;
  cancelledJobs.delete(jobId);
  for (const c of job.chunks) {
    if (c.status === 'failed' || c.status === 'cancelled') {
      c.status = 'pending';
      c.errorFa = undefined;
    }
  }
  job.status = 'queued';
  job.errorFa = undefined;
  job.updatedAt = new Date().toISOString();
  void executeJob(jobId);
  return job;
}

async function executeJob(jobId: string): Promise<void> {
  const job = jobsMap.get(jobId);
  const cfg = jobConfigs.get(jobId);
  if (!job || !cfg) return;

  job.status = 'running';
  job.updatedAt = new Date().toISOString();

  let totalTokens = 0;
  let totalCost = 0;
  let lastModelUsed = job.modelId;

  for (const chunk of job.chunks) {
    if (cancelledJobs.has(jobId)) {
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      return;
    }
    if (chunk.status === 'completed' && chunk.audioId && fs.existsSync(getAudioPath(chunk.audioId))) {
      continue;
    }

    chunk.status = 'processing';
    chunk.attempts += 1;
    job.updatedAt = new Date().toISOString();

    try {
      const result = await synthesizeSingleSpeaker({
        modelId: cfg.controls.modelId,
        autoModel: cfg.controls.autoModel,
        text: chunk.text,
        voiceId: cfg.controls.voiceId,
        stylePrompt: job.stylePrompt,
      });

      if (cancelledJobs.has(jobId)) {
        chunk.status = 'cancelled';
        job.status = 'cancelled';
        job.updatedAt = new Date().toISOString();
        return;
      }

      const chunkAudioId = newId('chunk');
      const chunkPath = getAudioPath(chunkAudioId);
      fs.writeFileSync(chunkPath, result.wavBuffer);
      const probe = await probeAudio(chunkPath);

      chunk.audioId = chunkAudioId;
      chunk.durationSec = probe.durationSec;
      chunk.status = 'completed';
      lastModelUsed = result.modelUsed;
      totalTokens += result.estimatedTokens;
      totalCost += result.estimatedCostUsd;
      job.completedChunks = job.chunks.filter((c) => c.status === 'completed').length;
      job.updatedAt = new Date().toISOString();
    } catch (err) {
      chunk.status = 'failed';
      chunk.errorFa = translateGeminiError(err);
      job.status = job.completedChunks > 0 ? 'partial' : 'failed';
      job.errorFa = chunk.errorFa;
      job.updatedAt = new Date().toISOString();
      return;
    }
  }

  // All chunks completed -> stitch & apply post-processing
  try {
    const chunkPaths = job.chunks
      .filter((c) => c.audioId)
      .map((c) => getAudioPath(c.audioId!));

    const stitchedId = newId('audio');
    const stitchedRawPath = path.join(TMP_DIR, `${stitchedId}-raw.wav`);
    const finalPath = getAudioPath(stitchedId);

    await stitchAudioFiles(
      chunkPaths,
      stitchedRawPath,
      job.pauseBetweenChunksMs,
      job.crossfadeMs,
      cfg.controls.normalizeLoudness
    );

    const rawProbe = await probeAudio(stitchedRawPath);
    let speedFactor = cfg.controls.speedMultiplier || 1.0;

    // Optional target-duration stretch within safe bounds [0.80, 1.28]
    if (job.autoTimeStretch && job.targetDurationSec && job.targetDurationSec > 0 && rawProbe.durationSec > 0) {
      const tolerance = (job.tolerancePercent ?? 5) / 100;
      const diffRatio = Math.abs(rawProbe.durationSec - job.targetDurationSec) / job.targetDurationSec;
      if (diffRatio > tolerance) {
        const desiredSpeed = rawProbe.durationSec / job.targetDurationSec;
        const safeClamped = Math.max(0.8, Math.min(1.28, desiredSpeed));
        if (Math.abs(desiredSpeed - safeClamped) > 0.02) {
          job.feasibilityWarningFa =
            `تفاوت زمان تولیدشده (${rawProbe.durationSec.toFixed(1)} ثانیه) با زمان هدف (${job.targetDurationSec} ثانیه) بیش از حد مجاز برای کشش بدون افت وضوح بود؛ ضریب سرعت به ${safeClamped.toFixed(2)}x محدود شد.`;
        }
        speedFactor = safeClamped;
      }
    }

    const needsPost =
      Math.abs(speedFactor - 1.0) >= 0.01 ||
      Math.abs(cfg.controls.outputGainDb || 0) >= 0.1 ||
      cfg.controls.normalizeLoudness;

    if (needsPost) {
      await processAudioEdit(stitchedRawPath, finalPath, {
        speed: speedFactor,
        volumeDb: cfg.controls.outputGainDb || 0,
        normalizeLufs: cfg.controls.normalizeLoudness ? (cfg.controls.targetLufs || -16) : null,
        peakLimitDb: -1.0,
      });
      if (fs.existsSync(stitchedRawPath)) fs.unlinkSync(stitchedRawPath);
    } else {
      fs.renameSync(stitchedRawPath, finalPath);
    }

    const finalProbe = await probeAudio(finalPath);
    const loudness = await measureLoudness(finalPath);
    const waveformPeaks = await getWaveformPeaks(finalPath, 160);

    // Build segment markers from chunk durations adjusted by speedFactor
    let cursor = 0;
    const pauseSec = (job.pauseBetweenChunksMs || 0) / 1000;
    const segmentMarkers = job.chunks.map((c, idx) => {
      const segDur = (c.durationSec || 0) / Math.max(0.5, speedFactor);
      const startSec = Number(cursor.toFixed(2));
      const endSec = Number((cursor + segDur).toFixed(2));
      cursor = endSec + (idx < job.chunks.length - 1 ? pauseSec : 0);
      return {
        label: `بخش ${idx + 1}`,
        startSec,
        endSec,
      };
    });

    const persona = VOICE_PERSONAS.find((p) => p.id === cfg.controls.personaId);
    const style = SPEAKING_STYLES.find((s) => s.id === cfg.controls.styleId);

    const artifact: AudioArtifact = {
      id: stitchedId,
      title: job.title,
      modelUsed: lastModelUsed,
      voiceId: cfg.controls.voiceId as RealVoiceId,
      personaNameFa: persona?.displayNameFa || cfg.controls.voiceId,
      styleNameFa: style?.nameFa || 'سفارشی',
      durationSec: finalProbe.durationSec,
      sampleRate: finalProbe.sampleRate,
      channels: finalProbe.channels,
      sizeBytes: finalProbe.sizeBytes,
      waveformPeaks,
      loudness,
      createdAt: new Date().toISOString(),
      textPreview: job.chunks[0]?.text.slice(0, 140) || '',
      segmentMarkers,
      estimatedTokens: totalTokens,
      estimatedCostUsd: Number(totalCost.toFixed(6)),
    };

    saveArtifactMeta(artifact);
    appendHistory({
      id: newId('hist'),
      audioId: stitchedId,
      projectTitle: job.title,
      modelUsed: lastModelUsed,
      voiceId: cfg.controls.voiceId,
      personaNameFa: artifact.personaNameFa,
      styleNameFa: artifact.styleNameFa,
      durationSec: finalProbe.durationSec,
      charCount: job.chunks.reduce((acc, c) => acc + c.text.length, 0),
      estimatedCostUsd: artifact.estimatedCostUsd || 0,
      createdAt: artifact.createdAt,
      textSnippet: artifact.textPreview,
    });

    job.finalAudioId = stitchedId;
    job.finalDurationSec = finalProbe.durationSec;
    job.appliedSpeedFactor = Number(speedFactor.toFixed(2));
    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
  } catch (err) {
    job.status = 'failed';
    job.errorFa = `خطا در اتصال نهایی فایل‌های صوتی: ${err instanceof Error ? err.message : String(err)}`;
    job.updatedAt = new Date().toISOString();
  }
}
