import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { SPEAKING_STYLES, VOICE_PERSONAS } from '../src/data/catalog.ts';
import type {
  AudioArtifact,
  AudioEditOperations,
  DictionaryEntry,
  DialogueTurn,
  ExportOptions,
  RealVoiceId,
  SpeechControlsConfig,
  StudioProject,
  VoiceTemplate,
} from '../src/types/studio.ts';
import { applyPronunciationDictionary } from '../src/utils/persianText.ts';
import {
  checkFfmpegAvailable,
  exportAudio,
  getWaveformPeaks,
  measureLoudness,
  probeAudio,
  processAudioEdit,
  stitchAudioFiles,
} from './audio.ts';
import { parseUploadedDocument } from './documents.ts';
import {
  diacritizePersianText,
  discoverModels,
  isApiKeyConfigured,
  suggestNarrationPauses,
  synthesizeDualSpeakerNative,
  synthesizeSingleSpeaker,
  translateGeminiError,
} from './gemini.ts';
import {
  buildEffectiveStylePrompt,
  cancelJob,
  createAndStartJob,
  getJob,
  listAllJobs,
  resumeJob,
} from './jobs.ts';
import {
  TMP_DIR,
  appendHistory,
  ensureStorageDirs,
  getArtifactMeta,
  getAudioPath,
  getPreviewAudioPath,
  listArtifacts,
  listDictionary,
  listHistory,
  listProjects,
  listTemplates,
  newId,
  sanitizeId,
  saveArtifactMeta,
  saveDictionary,
  saveProjects,
  saveTemplates,
} from './storage.ts';

const ALLOWED_DOC_EXTS = new Set(['.txt', '.md', '.srt', '.docx', '.pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_DOC_EXTS.has(ext)) {
      cb(new Error('فرمت فایل مجاز نیست. فرمت‌های پشتیبانی‌شده: TXT، MD، SRT، DOCX، PDF'));
      return;
    }
    cb(null, true);
  },
});

export function createApiRouter() {
  ensureStorageDirs();
  const router = express.Router();

  router.get('/health', async (_req, res) => {
    const ffmpegOk = await checkFfmpegAvailable();
    res.json({
      ok: true,
      apiKeyConfigured: isApiKeyConfigured(),
      ffmpegAvailable: ffmpegOk,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/models', async (req, res) => {
    const force = req.query.refresh === '1';
    const data = await discoverModels(force);
    res.json(data);
  });

  // Linguistic Diacritization
  router.post('/linguistic/diacritize', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      const domainHint = String(req.body?.domainHint || 'عمومی و استاندارد فارسی');
      if (!text) {
        res.status(400).json({ errorFa: 'متن برای اعراب‌گذاری خالی است.' });
        return;
      }
      if (text.length > 6000) {
        res.status(400).json({
          errorFa: 'طول متن ارسالی برای یک مرحله اعراب‌گذاری بیش از ۶۰۰۰ نویسه است. لطفاً متن را بخش‌بخش یا به صورت متن انتخاب‌شده پردازش کنید.',
        });
        return;
      }
      const result = await diacritizePersianText(text, domainHint);
      res.json(result);
    } catch (err) {
      res.status(500).json({ errorFa: translateGeminiError(err) });
    }
  });

  router.post('/linguistic/pause-suggestions', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) {
        res.status(400).json({ errorFa: 'متن برای تحلیل مکث خالی است.' });
        return;
      }
      const result = await suggestNarrationPauses(text.slice(0, 4000));
      res.json(result);
    } catch (err) {
      res.status(500).json({ errorFa: translateGeminiError(err) });
    }
  });

  // Document Import
  router.post('/documents/import', (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
      if (uploadErr) {
        res.status(400).json({ errorFa: uploadErr.message || 'خطا در بارگذاری فایل.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ errorFa: 'فایلی انتخاب نشده است.' });
        return;
      }
      try {
        const parsed = await parseUploadedDocument(req.file.buffer, req.file.originalname);
        res.json(parsed);
      } catch (err) {
        res.status(400).json({
          errorFa: err instanceof Error ? err.message : 'خطا در خواندن محتوای فایل.',
        });
      }
    });
  });

  // Real Voice Preview (cached on disk once generated)
  router.post('/tts/preview-voice', async (req, res) => {
    try {
      const voiceId = String(req.body?.voiceId || 'Kore') as RealVoiceId;
      const validVoices: RealVoiceId[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
      if (!validVoices.includes(voiceId)) {
        res.status(400).json({ errorFa: 'شناسه صدای انتخاب‌شده معتبر نیست.' });
        return;
      }
      const sampleText = String(
        req.body?.sampleText ||
          'سلام، این یک نمونه واقعی از صدای آوا استودیو برای آزمایش کیفیت و لحن گویندگی به زبان فارسی است.'
      ).trim();
      const stylePrompt = String(
        req.body?.stylePrompt || 'Clear, natural Iranian Persian voice sample.'
      ).trim();

      const customPreview = Boolean(req.body?.sampleText || req.body?.stylePrompt);
      const previewPath = getPreviewAudioPath(voiceId);

      if (!customPreview && fs.existsSync(previewPath)) {
        const probe = await probeAudio(previewPath);
        const peaks = await getWaveformPeaks(previewPath, 64);
        res.json({
          audioUrl: `/api/audio/preview/${voiceId}`,
          voiceId,
          durationSec: probe.durationSec,
          waveformPeaks: peaks,
          cached: true,
        });
        return;
      }

      const synth = await synthesizeSingleSpeaker({
        modelId: 'gemini-3.8-flash-lite-tts',
        autoModel: true,
        text: sampleText.slice(0, 400),
        voiceId,
        stylePrompt,
      });

      if (!customPreview) {
        fs.writeFileSync(previewPath, synth.wavBuffer);
        const probe = await probeAudio(previewPath);
        const peaks = await getWaveformPeaks(previewPath, 64);
        res.json({
          audioUrl: `/api/audio/preview/${voiceId}`,
          voiceId,
          durationSec: probe.durationSec,
          waveformPeaks: peaks,
          cached: false,
        });
        return;
      }

      const tempAudioId = newId('prev');
      const tempAudioPath = getAudioPath(tempAudioId);
      fs.writeFileSync(tempAudioPath, synth.wavBuffer);
      const probe = await probeAudio(tempAudioPath);
      const peaks = await getWaveformPeaks(tempAudioPath, 64);
      res.json({
        audioUrl: `/api/audio/${tempAudioId}`,
        voiceId,
        durationSec: probe.durationSec,
        waveformPeaks: peaks,
        cached: false,
      });
    } catch (err) {
      res.status(500).json({ errorFa: translateGeminiError(err) });
    }
  });

  // Single-speaker fast synthesis (for short/medium scripts)
  router.post('/tts/generate', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      const title = String(req.body?.title || 'خروجی استودیو').trim();
      const controls = req.body?.controls as SpeechControlsConfig;
      const applyDictionary = req.body?.applyDictionary !== false;

      if (!text) {
        res.status(400).json({ errorFa: 'متن برای تولید گفتار نمی‌تواند خالی باشد.' });
        return;
      }
      if (!controls || !controls.voiceId) {
        res.status(400).json({ errorFa: 'تنظیمات گوینده ارسال نشده است.' });
        return;
      }

      let speechText = text;
      let appliedRules: { original: string; spokenForm: string; count: number }[] = [];
      if (applyDictionary) {
        const dict = listDictionary();
        const applied = applyPronunciationDictionary(text, dict);
        speechText = applied.speechReadyText;
        appliedRules = applied.appliedRules;
      }

      const stylePrompt = buildEffectiveStylePrompt(controls);
      const synth = await synthesizeSingleSpeaker({
        modelId: controls.modelId || 'gemini-3.8-flash-lite-tts',
        autoModel: controls.autoModel !== false,
        text: speechText,
        voiceId: controls.voiceId,
        stylePrompt,
      });

      const audioId = newId('audio');
      const rawTmp = path.join(TMP_DIR, `${audioId}-raw.wav`);
      const finalPath = getAudioPath(audioId);
      fs.writeFileSync(rawTmp, synth.wavBuffer);

      const needsPost =
        Math.abs((controls.speedMultiplier || 1) - 1) >= 0.01 ||
        Math.abs(controls.outputGainDb || 0) >= 0.1 ||
        Boolean(controls.normalizeLoudness);

      if (needsPost) {
        await processAudioEdit(rawTmp, finalPath, {
          speed: controls.speedMultiplier || 1,
          volumeDb: controls.outputGainDb || 0,
          normalizeLufs: controls.normalizeLoudness ? (controls.targetLufs || -16) : null,
          peakLimitDb: -1.0,
        });
        if (fs.existsSync(rawTmp)) fs.unlinkSync(rawTmp);
      } else {
        fs.renameSync(rawTmp, finalPath);
      }

      const probe = await probeAudio(finalPath);
      const loudness = await measureLoudness(finalPath);
      const waveformPeaks = await getWaveformPeaks(finalPath, 160);

      const persona = VOICE_PERSONAS.find((p) => p.id === controls.personaId);
      const style = SPEAKING_STYLES.find((s) => s.id === controls.styleId);

      const artifact: AudioArtifact = {
        id: audioId,
        title,
        modelUsed: synth.modelUsed,
        voiceId: controls.voiceId,
        personaNameFa: persona?.displayNameFa || controls.voiceId,
        styleNameFa: style?.nameFa || 'سفارشی',
        durationSec: probe.durationSec,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        sizeBytes: probe.sizeBytes,
        waveformPeaks,
        loudness,
        createdAt: new Date().toISOString(),
        textPreview: text.slice(0, 140),
        estimatedTokens: synth.estimatedTokens,
        estimatedCostUsd: synth.estimatedCostUsd,
      };

      saveArtifactMeta(artifact);
      appendHistory({
        id: newId('hist'),
        audioId,
        projectTitle: title,
        modelUsed: synth.modelUsed,
        voiceId: controls.voiceId,
        personaNameFa: artifact.personaNameFa,
        styleNameFa: artifact.styleNameFa,
        durationSec: probe.durationSec,
        charCount: text.length,
        estimatedCostUsd: synth.estimatedCostUsd,
        createdAt: artifact.createdAt,
        textSnippet: artifact.textPreview,
      });

      res.json({
        artifact,
        speechReadyText: speechText,
        appliedRules,
      });
    } catch (err) {
      res.status(500).json({ errorFa: translateGeminiError(err) });
    }
  });

  // Multi-speaker Dialogue Synthesis
  router.post('/tts/multi-speaker', async (req, res) => {
    try {
      const title = String(req.body?.title || 'گفتگوی چندگوینده').trim();
      const turns = (req.body?.turns || []) as DialogueTurn[];
      const mode = String(req.body?.mode || 'auto'); // 'native' | 'segmented' | 'auto'
      const normalizeLoudness = req.body?.normalizeLoudness !== false;

      if (!Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ errorFa: 'حداقل یک نوبت گفتگو برای تولید صوت لازم است.' });
        return;
      }

      const dict = listDictionary();
      const processedTurns = turns
        .filter((t) => t.text && t.text.trim())
        .map((t) => ({
          ...t,
          text: applyPronunciationDictionary(t.text.trim(), dict).speechReadyText,
        }));

      if (processedTurns.length === 0) {
        res.status(400).json({ errorFa: 'متن نوبت‌های گفتگو خالی است.' });
        return;
      }

      const uniqueSpeakers = new Set(processedTurns.map((t) => t.speakerLabel.trim()));
      const canUseNative = uniqueSpeakers.size === 2 && processedTurns.length <= 16;

      const audioId = newId('multi');
      const finalPath = getAudioPath(audioId);
      let modelUsed = 'gemini-3.8-flash-tts';
      let estimatedTokens = 0;
      let estimatedCostUsd = 0;
      let segmentMarkers: { label: string; startSec: number; endSec: number }[] = [];
      let synthesisModeUsed: 'native-dual' | 'segmented-stitch' = 'segmented-stitch';

      if ((mode === 'native' || mode === 'auto') && canUseNative) {
        try {
          const nativeRes = await synthesizeDualSpeakerNative({ turns: processedTurns });
          const rawTmp = path.join(TMP_DIR, `${audioId}-native.wav`);
          fs.writeFileSync(rawTmp, nativeRes.wavBuffer);
          if (normalizeLoudness) {
            await processAudioEdit(rawTmp, finalPath, { normalizeLufs: -16, peakLimitDb: -1.0 });
            fs.unlinkSync(rawTmp);
          } else {
            fs.renameSync(rawTmp, finalPath);
          }
          modelUsed = nativeRes.modelUsed;
          estimatedTokens = nativeRes.estimatedTokens;
          estimatedCostUsd = nativeRes.estimatedCostUsd;
          synthesisModeUsed = 'native-dual';
        } catch (nativeErr) {
          if (mode === 'native') {
            throw nativeErr;
          }
          // Fall back to segmented ordered synthesis
        }
      }

      if (synthesisModeUsed === 'segmented-stitch') {
        const segmentPaths: string[] = [];
        const tempIds: string[] = [];
        let cursor = 0;
        const avgPauseMs = Math.round(
          processedTurns.reduce((a, t) => a + (t.pauseAfterMs || 280), 0) / processedTurns.length
        );

        try {
          for (const turn of processedTurns) {
            const single = await synthesizeSingleSpeaker({
              modelId: 'gemini-3.8-flash-lite-tts',
              autoModel: true,
              text: turn.text,
              voiceId: turn.voiceId,
              stylePrompt: turn.stylePrompt || 'Natural Iranian Persian dialogue.',
            });
            const segId = newId('turn');
            const segPath = getAudioPath(segId);
            fs.writeFileSync(segPath, single.wavBuffer);
            const segProbe = await probeAudio(segPath);
            segmentMarkers.push({
              label: turn.speakerLabel,
              startSec: Number(cursor.toFixed(2)),
              endSec: Number((cursor + segProbe.durationSec).toFixed(2)),
            });
            cursor += segProbe.durationSec + avgPauseMs / 1000;
            segmentPaths.push(segPath);
            tempIds.push(segPath);
            estimatedTokens += single.estimatedTokens;
            estimatedCostUsd += single.estimatedCostUsd;
            modelUsed = single.modelUsed;
          }

          await stitchAudioFiles(segmentPaths, finalPath, avgPauseMs, 20, normalizeLoudness);
        } finally {
          for (const p of tempIds) {
            try {
              if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch {
              // ignore
            }
          }
        }
      }

      const probe = await probeAudio(finalPath);
      const loudness = await measureLoudness(finalPath);
      const waveformPeaks = await getWaveformPeaks(finalPath, 160);

      const artifact: AudioArtifact = {
        id: audioId,
        title,
        modelUsed,
        voiceId: processedTurns[0].voiceId,
        personaNameFa: Array.from(uniqueSpeakers).join(' و '),
        styleNameFa:
          synthesisModeUsed === 'native-dual' ? 'دیالوگ دوگوینده بومی' : 'دیالوگ چندبخشی مونتاژشده',
        durationSec: probe.durationSec,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        sizeBytes: probe.sizeBytes,
        waveformPeaks,
        loudness,
        segmentMarkers: segmentMarkers.length ? segmentMarkers : undefined,
        createdAt: new Date().toISOString(),
        textPreview: processedTurns.map((t) => `${t.speakerLabel}: ${t.text}`).join(' | ').slice(0, 140),
        estimatedTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      };

      saveArtifactMeta(artifact);
      appendHistory({
        id: newId('hist'),
        audioId,
        projectTitle: title,
        modelUsed,
        voiceId: artifact.voiceId,
        personaNameFa: artifact.personaNameFa,
        styleNameFa: artifact.styleNameFa,
        durationSec: probe.durationSec,
        charCount: processedTurns.reduce((a, t) => a + t.text.length, 0),
        estimatedCostUsd: artifact.estimatedCostUsd || 0,
        createdAt: artifact.createdAt,
        textSnippet: artifact.textPreview,
      });

      res.json({ artifact, synthesisModeUsed });
    } catch (err) {
      res.status(500).json({ errorFa: translateGeminiError(err) });
    }
  });

  // Long-text Chunked Job Queue & Target Duration
  router.get('/jobs', (_req, res) => {
    res.json({ jobs: listAllJobs() });
  });

  router.post('/jobs', (req, res) => {
    try {
      const job = createAndStartJob({
        title: String(req.body?.title || 'پردازش متن طولانی'),
        text: String(req.body?.text || ''),
        controls: req.body?.controls as SpeechControlsConfig,
        maxCharsPerChunk: Number(req.body?.maxCharsPerChunk || 1000),
        targetDurationSec:
          typeof req.body?.targetDurationSec === 'number' ? req.body.targetDurationSec : null,
        tolerancePercent: Number(req.body?.tolerancePercent || 5),
        autoTimeStretch: Boolean(req.body?.autoTimeStretch),
      });
      res.json({ job });
    } catch (err) {
      res.status(400).json({
        errorFa: err instanceof Error ? err.message : 'خطا در ایجاد صف پردازش.',
      });
    }
  });

  router.get('/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ errorFa: 'کار پردازشی موردنظر یافت نشد.' });
      return;
    }
    res.json({ job, artifact: job.finalAudioId ? getArtifactMeta(job.finalAudioId) : undefined });
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    const job = cancelJob(req.params.id);
    if (!job) {
      res.status(404).json({ errorFa: 'کار پردازشی موردنظر یافت نشد.' });
      return;
    }
    res.json({ job });
  });

  router.post('/jobs/:id/resume', (req, res) => {
    const job = resumeJob(req.params.id);
    if (!job) {
      res.status(404).json({ errorFa: 'کار پردازشی موردنظر یافت نشد.' });
      return;
    }
    res.json({ job });
  });

  // Audio Streaming, Non-Destructive Processing & Export
  router.get('/audio/preview/:voiceId', (req, res) => {
    try {
      const voiceId = sanitizeId(req.params.voiceId);
      const filePath = getPreviewAudioPath(voiceId);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ errorFa: 'فایل پیش‌نمایش صوتی موجود نیست.' });
        return;
      }
      res.type('audio/wav').sendFile(filePath);
    } catch {
      res.status(400).json({ errorFa: 'شناسه پیش‌نمایش نامعتبر است.' });
    }
  });

  router.get('/audio/:id', (req, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const filePath = getAudioPath(id);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ errorFa: 'فایل صوتی یافت نشد.' });
        return;
      }
      res.type('audio/wav').sendFile(filePath);
    } catch {
      res.status(400).json({ errorFa: 'شناسه فایل صوتی نامعتبر است.' });
    }
  });

  router.get('/artifacts', (_req, res) => {
    res.json({ artifacts: listArtifacts() });
  });

  router.post('/audio/:id/process', async (req, res) => {
    try {
      const sourceId = sanitizeId(req.params.id);
      const sourcePath = getAudioPath(sourceId);
      if (!fs.existsSync(sourcePath)) {
        res.status(404).json({ errorFa: 'فایل صوتی مبدأ یافت نشد.' });
        return;
      }
      const ops = (req.body?.operations || {}) as AudioEditOperations;
      const newAudioId = newId('edit');
      const outputPath = getAudioPath(newAudioId);

      await processAudioEdit(sourcePath, outputPath, ops);

      const probe = await probeAudio(outputPath);
      const loudness = await measureLoudness(outputPath);
      const waveformPeaks = await getWaveformPeaks(outputPath, 160);
      const parentMeta = getArtifactMeta(sourceId);

      const artifact: AudioArtifact = {
        id: newAudioId,
        parentId: parentMeta?.parentId || sourceId,
        title: `${parentMeta?.title || 'فایل صوتی'} (ویرایش‌شده)`,
        modelUsed: parentMeta?.modelUsed || 'ffmpeg-post',
        voiceId: parentMeta?.voiceId || 'Kore',
        personaNameFa: parentMeta?.personaNameFa || 'استودیو',
        styleNameFa: parentMeta?.styleNameFa || 'ویرایش‌شده',
        durationSec: probe.durationSec,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        sizeBytes: probe.sizeBytes,
        waveformPeaks,
        loudness,
        createdAt: new Date().toISOString(),
        textPreview: parentMeta?.textPreview || '',
        isEdited: true,
      };

      saveArtifactMeta(artifact);
      res.json({ artifact });
    } catch (err) {
      res.status(500).json({
        errorFa: `خطا در پردازش صوت: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  router.post('/audio/merge', async (req, res) => {
    try {
      const audioIds = (req.body?.audioIds || []) as string[];
      const pauseMs = Number(req.body?.pauseMs ?? 300);
      const title = String(req.body?.title || 'فایل صوتی ادغام‌شده');

      if (!Array.isArray(audioIds) || audioIds.length < 2) {
        res.status(400).json({ errorFa: 'حداقل دو فایل صوتی برای ادغام لازم است.' });
        return;
      }
      const paths = audioIds.map((id) => {
        const p = getAudioPath(sanitizeId(id));
        if (!fs.existsSync(p)) throw new Error('یکی از فایل‌های صوتی انتخاب‌شده یافت نشد.');
        return p;
      });

      const mergedId = newId('merge');
      const outputPath = getAudioPath(mergedId);
      await stitchAudioFiles(paths, outputPath, pauseMs, 25, true);

      const probe = await probeAudio(outputPath);
      const loudness = await measureLoudness(outputPath);
      const waveformPeaks = await getWaveformPeaks(outputPath, 160);

      const artifact: AudioArtifact = {
        id: mergedId,
        title,
        modelUsed: 'ffmpeg-merge',
        voiceId: 'Kore',
        personaNameFa: 'ترکیب چندگانه',
        styleNameFa: 'مونتاژ',
        durationSec: probe.durationSec,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        sizeBytes: probe.sizeBytes,
        waveformPeaks,
        loudness,
        createdAt: new Date().toISOString(),
        textPreview: `${audioIds.length} قطعه صوتی ادغام‌شده`,
        isEdited: true,
      };

      saveArtifactMeta(artifact);
      res.json({ artifact });
    } catch (err) {
      res.status(500).json({
        errorFa: err instanceof Error ? err.message : 'خطا در ادغام فایل‌های صوتی.',
      });
    }
  });

  router.post('/audio/:id/export', async (req, res) => {
    let tempExportPath: string | null = null;
    try {
      const id = sanitizeId(req.params.id);
      const sourcePath = getAudioPath(id);
      if (!fs.existsSync(sourcePath)) {
        res.status(404).json({ errorFa: 'فایل صوتی برای خروجی یافت نشد.' });
        return;
      }

      const opts = (req.body || {}) as ExportOptions;
      const safeBaseName =
        (opts.filename || 'ava-studio-output')
          .replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_')
          .slice(0, 64) || 'ava-studio-output';

      const exportId = newId('exp');
      const ext = opts.format || 'mp3';
      tempExportPath = path.join(TMP_DIR, `${exportId}.${ext}`);

      const { mimeType, extension } = await exportAudio(sourcePath, tempExportPath, {
        format: opts.format || 'mp3',
        mp3BitrateKbps: opts.mp3BitrateKbps || 192,
        sampleRate: opts.sampleRate || 24000,
        channels: opts.channels || 1,
        filename: safeBaseName,
        titleMeta: opts.titleMeta,
        artistMeta: opts.artistMeta || 'AVA STUDIO',
      });

      const fileBuf = fs.readFileSync(tempExportPath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(`${safeBaseName}.${extension}`)}`
      );
      res.send(fileBuf);
    } catch (err) {
      res.status(500).json({
        errorFa: `خطا در رمزگذاری و خروجی صوت: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      if (tempExportPath && fs.existsSync(tempExportPath)) {
        try {
          fs.unlinkSync(tempExportPath);
        } catch {
          // ignore
        }
      }
    }
  });

  // Projects CRUD
  router.get('/projects', (_req, res) => {
    res.json({ projects: listProjects() });
  });

  router.post('/projects', (req, res) => {
    const incoming = req.body as StudioProject;
    const projects = listProjects();
    const now = new Date().toISOString();
    const project: StudioProject = {
      ...incoming,
      id: incoming.id ? sanitizeId(incoming.id) : newId('proj'),
      createdAt: incoming.createdAt || now,
      updatedAt: now,
    };
    const next = [project, ...projects.filter((p) => p.id !== project.id)];
    saveProjects(next);
    res.json({ project, projects: next });
  });

  router.delete('/projects/:id', (req, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const next = listProjects().filter((p) => p.id !== id);
      saveProjects(next);
      res.json({ projects: next });
    } catch {
      res.status(400).json({ errorFa: 'شناسه پروژه معتبر نیست.' });
    }
  });

  // Dictionary CRUD
  router.get('/dictionary', (_req, res) => {
    res.json({ entries: listDictionary() });
  });

  router.put('/dictionary', (req, res) => {
    const entries = req.body?.entries as DictionaryEntry[];
    if (!Array.isArray(entries)) {
      res.status(400).json({ errorFa: 'فهرست واژه‌نامه نامعتبر است.' });
      return;
    }
    const saved = saveDictionary(entries);
    res.json({ entries: saved });
  });

  // Templates CRUD
  router.get('/templates', (_req, res) => {
    res.json({ templates: listTemplates() });
  });

  router.post('/templates', (req, res) => {
    const tpl = req.body as VoiceTemplate;
    const current = listTemplates();
    const savedTpl: VoiceTemplate = {
      ...tpl,
      id: tpl.id ? sanitizeId(tpl.id) : newId('tpl'),
      createdAt: tpl.createdAt || new Date().toISOString(),
    };
    const next = [savedTpl, ...current.filter((t) => t.id !== savedTpl.id)];
    saveTemplates(next);
    res.json({ templates: next });
  });

  router.delete('/templates/:id', (req, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const next = listTemplates().filter((t) => t.id !== id);
      saveTemplates(next);
      res.json({ templates: next });
    } catch {
      res.status(400).json({ errorFa: 'شناسه الگو نامعتبر است.' });
    }
  });

  // History
  router.get('/history', (_req, res) => {
    res.json({ history: listHistory() });
  });

  return router;
}
