import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import type { AudioEditOperations, ExportOptions, LoudnessMetrics } from '../src/types/studio.ts';
import { TMP_DIR, ensureStorageDirs } from './storage.ts';

const execFileAsync = promisify(execFile);

const FFMPEG_BIN = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';

export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync(FFMPEG_BIN, ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export interface AudioProbeResult {
  durationSec: number;
  sampleRate: number;
  channels: number;
  codec: string;
  sizeBytes: number;
}

export async function probeAudio(filePath: string): Promise<AudioProbeResult> {
  const stat = fs.statSync(filePath);
  const { stdout } = await execFileAsync(
    FFPROBE_BIN,
    [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
    { timeout: 15000 }
  );
  const parsed = JSON.parse(stdout || '{}');
  const audioStream =
    (parsed.streams || []).find((s: { codec_type?: string }) => s.codec_type === 'audio') || {};
  const durationSec = parseFloat(parsed.format?.duration || audioStream.duration || '0') || 0;
  const sampleRate = parseInt(audioStream.sample_rate || '24000', 10) || 24000;
  const channels = parseInt(audioStream.channels || '1', 10) || 1;
  const codec = String(audioStream.codec_name || 'pcm_s16le');

  return {
    durationSec: Number(durationSec.toFixed(3)),
    sampleRate,
    channels,
    codec,
    sizeBytes: stat.size,
  };
}

export async function measureLoudness(filePath: string): Promise<LoudnessMetrics | undefined> {
  try {
    const { stderr } = await execFileAsync(
      FFMPEG_BIN,
      ['-hide_banner', '-i', filePath, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
      { timeout: 25000, maxBuffer: 4 * 1024 * 1024 }
    );
    // Parse Summary block at the end of ebur128 stderr output
    const summaryIdx = stderr.lastIndexOf('Summary:');
    const section = summaryIdx >= 0 ? stderr.slice(summaryIdx) : stderr;
    const iMatch = section.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
    const lraMatch = section.match(/LRA:\s*(-?\d+(?:\.\d+)?)\s*LU/);
    const peakMatch = section.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/);

    if (!iMatch) return undefined;
    return {
      integratedLufs: Number(parseFloat(iMatch[1]).toFixed(1)),
      loudnessRangeLu: lraMatch ? Number(parseFloat(lraMatch[1]).toFixed(1)) : 0,
      truePeakDb: peakMatch ? Number(parseFloat(peakMatch[1]).toFixed(1)) : -1.0,
    };
  } catch {
    return undefined;
  }
}

export async function getWaveformPeaks(filePath: string, bars = 160): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync(
      FFMPEG_BIN,
      [
        '-v',
        'error',
        '-i',
        filePath,
        '-ac',
        '1',
        '-ar',
        '8000',
        '-f',
        's16le',
        'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 20000 }
    );

    const buf = stdout as unknown as Buffer;
    const totalSamples = Math.floor(buf.length / 2);
    if (totalSamples === 0) return Array(bars).fill(0.05);

    const samplesPerBar = Math.max(1, Math.floor(totalSamples / bars));
    const peaks: number[] = [];

    for (let i = 0; i < bars; i++) {
      const start = i * samplesPerBar;
      const end = i === bars - 1 ? totalSamples : Math.min(totalSamples, start + samplesPerBar);
      let maxVal = 0;
      for (let s = start; s < end; s++) {
        const sample = Math.abs(buf.readInt16LE(s * 2)) / 32768;
        if (sample > maxVal) maxVal = sample;
      }
      peaks.push(Number(Math.max(0.03, maxVal).toFixed(3)));
    }

    // Normalize relative to peak so quiet speech remains visually legible
    const globalMax = Math.max(...peaks, 0.05);
    return peaks.map((p) => Number(Math.min(1, p / Math.max(0.25, globalMax)).toFixed(3)));
  } catch {
    return Array(bars).fill(0.15);
  }
}

function buildAtempoChain(speed: number): string {
  const clamped = Math.max(0.5, Math.min(2.0, speed));
  if (Math.abs(clamped - 1.0) < 0.005) return '';
  // ffmpeg atempo supports [0.5, 2.0] per filter
  return `atempo=${clamped.toFixed(4)}`;
}

export async function generateSilenceWav(outputPath: string, durationSec: number, sampleRate = 24000) {
  await execFileAsync(
    FFMPEG_BIN,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=${sampleRate}:cl=mono`,
      '-t',
      durationSec.toFixed(3),
      '-acodec',
      'pcm_s16le',
      outputPath,
    ],
    { timeout: 15000 }
  );
}

export async function stitchAudioFiles(
  inputPaths: string[],
  outputPath: string,
  pauseMs = 280,
  crossfadeMs = 25,
  normalizeEach = true
): Promise<void> {
  ensureStorageDirs();
  if (inputPaths.length === 0) {
    throw new Error('هیچ فایل صوتی برای اتصال وجود ندارد.');
  }
  if (inputPaths.length === 1 && !normalizeEach) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return;
  }

  const tempFiles: string[] = [];
  const runId = crypto.randomBytes(5).toString('hex');

  try {
    // Standardize each input to 24kHz mono 16-bit WAV with short micro-fades to eliminate clicks
    const preparedPaths: string[] = [];
    const fadeSec = Math.max(0.005, Math.min(0.08, crossfadeMs / 1000));

    for (let i = 0; i < inputPaths.length; i++) {
      const inp = inputPaths[i];
      const probe = await probeAudio(inp);
      const prepPath = path.join(TMP_DIR, `stitch-${runId}-${i}.wav`);
      tempFiles.push(prepPath);

      const filters: string[] = [];
      if (probe.durationSec > fadeSec * 3) {
        const fadeOutStart = Math.max(0, probe.durationSec - fadeSec);
        filters.push(`afade=t=in:st=0:d=${fadeSec.toFixed(3)}`);
        filters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeSec.toFixed(3)}`);
      }
      if (normalizeEach) {
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
      }

      const args = ['-y', '-i', inp, '-ar', '24000', '-ac', '1'];
      if (filters.length > 0) {
        args.push('-af', filters.join(','));
      }
      args.push('-acodec', 'pcm_s16le', prepPath);

      await execFileAsync(FFMPEG_BIN, args, { timeout: 30000 });
      preparedPaths.push(prepPath);
    }

    if (preparedPaths.length === 1) {
      fs.copyFileSync(preparedPaths[0], outputPath);
      return;
    }

    let silencePath: string | null = null;
    if (pauseMs > 20) {
      silencePath = path.join(TMP_DIR, `silence-${runId}.wav`);
      tempFiles.push(silencePath);
      await generateSilenceWav(silencePath, pauseMs / 1000, 24000);
    }

    const listPath = path.join(TMP_DIR, `concat-${runId}.txt`);
    tempFiles.push(listPath);

    const lines: string[] = [];
    for (let i = 0; i < preparedPaths.length; i++) {
      lines.push(`file '${preparedPaths[i].replace(/'/g, "'\\''")}'`);
      if (silencePath && i < preparedPaths.length - 1) {
        lines.push(`file '${silencePath.replace(/'/g, "'\\''")}'`);
      }
    }
    fs.writeFileSync(listPath, lines.join('\n'), 'utf-8');

    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-acodec',
        'pcm_s16le',
        outputPath,
      ],
      { timeout: 60000 }
    );
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

export async function processAudioEdit(
  inputPath: string,
  outputPath: string,
  ops: AudioEditOperations
): Promise<void> {
  ensureStorageDirs();
  const probe = await probeAudio(inputPath);
  const runId = crypto.randomBytes(5).toString('hex');
  const tempFiles: string[] = [];

  try {
    let workingInput = inputPath;

    // 1. Optional silence insertion at a timestamp
    if (
      typeof ops.insertSilenceAtSec === 'number' &&
      typeof ops.insertSilenceDurationSec === 'number' &&
      ops.insertSilenceDurationSec > 0.05 &&
      ops.insertSilenceAtSec >= 0 &&
      ops.insertSilenceAtSec <= probe.durationSec
    ) {
      const splitSec = ops.insertSilenceAtSec;
      const silPath = path.join(TMP_DIR, `ins-sil-${runId}.wav`);
      const mergedPath = path.join(TMP_DIR, `ins-merged-${runId}.wav`);
      tempFiles.push(silPath, mergedPath);

      await generateSilenceWav(silPath, ops.insertSilenceDurationSec, probe.sampleRate || 24000);

      if (splitSec <= 0.02) {
        await stitchAudioFiles([silPath, workingInput], mergedPath, 0, 5, false);
      } else if (splitSec >= probe.durationSec - 0.02) {
        await stitchAudioFiles([workingInput, silPath], mergedPath, 0, 5, false);
      } else {
        const partA = path.join(TMP_DIR, `partA-${runId}.wav`);
        const partB = path.join(TMP_DIR, `partB-${runId}.wav`);
        tempFiles.push(partA, partB);

        await execFileAsync(
          FFMPEG_BIN,
          ['-y', '-i', workingInput, '-t', splitSec.toFixed(3), '-acodec', 'pcm_s16le', partA],
          { timeout: 25000 }
        );
        await execFileAsync(
          FFMPEG_BIN,
          ['-y', '-i', workingInput, '-ss', splitSec.toFixed(3), '-acodec', 'pcm_s16le', partB],
          { timeout: 25000 }
        );
        await stitchAudioFiles([partA, silPath, partB], mergedPath, 0, 8, false);
      }
      workingInput = mergedPath;
    }

    const workingProbe = await probeAudio(workingInput);
    const args: string[] = ['-y'];

    const trimStart =
      typeof ops.trimStartSec === 'number' && ops.trimStartSec > 0 ? ops.trimStartSec : 0;
    const trimEnd =
      typeof ops.trimEndSec === 'number' &&
      ops.trimEndSec > trimStart + 0.05 &&
      ops.trimEndSec < workingProbe.durationSec
        ? ops.trimEndSec
        : workingProbe.durationSec;

    if (trimStart > 0) {
      args.push('-ss', trimStart.toFixed(3));
    }
    args.push('-i', workingInput);
    if (trimEnd < workingProbe.durationSec) {
      const len = Math.max(0.1, trimEnd - trimStart);
      args.push('-t', len.toFixed(3));
    }

    const effectiveDuration = Math.max(0.1, trimEnd - trimStart);
    const filters: string[] = [];

    if (ops.noiseReduce) {
      filters.push('highpass=f=75', 'afftdn=nf=-24');
    }

    if (ops.removeLongSilences) {
      filters.push(
        'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:stop_periods=-1:stop_duration=0.65:stop_threshold=-42dB'
      );
    }

    if (typeof ops.speed === 'number' && Math.abs(ops.speed - 1.0) >= 0.01) {
      const tempo = buildAtempoChain(ops.speed);
      if (tempo) filters.push(tempo);
    }

    const postTempoDur =
      typeof ops.speed === 'number' && ops.speed > 0
        ? effectiveDuration / Math.max(0.5, Math.min(2.0, ops.speed))
        : effectiveDuration;

    if (typeof ops.fadeInSec === 'number' && ops.fadeInSec > 0.01) {
      const d = Math.min(ops.fadeInSec, postTempoDur * 0.45);
      filters.push(`afade=t=in:st=0:d=${d.toFixed(3)}`);
    }

    if (typeof ops.fadeOutSec === 'number' && ops.fadeOutSec > 0.01) {
      const d = Math.min(ops.fadeOutSec, postTempoDur * 0.45);
      const st = Math.max(0, postTempoDur - d);
      filters.push(`afade=t=out:st=${st.toFixed(3)}:d=${d.toFixed(3)}`);
    }

    if (typeof ops.volumeDb === 'number' && Math.abs(ops.volumeDb) >= 0.1) {
      const clampedDb = Math.max(-24, Math.min(18, ops.volumeDb));
      filters.push(`volume=${clampedDb.toFixed(1)}dB`);
    }

    if (typeof ops.normalizeLufs === 'number' && Number.isFinite(ops.normalizeLufs)) {
      const targetI = Math.max(-24, Math.min(-9, ops.normalizeLufs));
      filters.push(`loudnorm=I=${targetI}:TP=-1.5:LRA=11`);
    }

    if (typeof ops.peakLimitDb === 'number' && Number.isFinite(ops.peakLimitDb)) {
      const limitLin = Math.pow(10, Math.max(-6, Math.min(-0.1, ops.peakLimitDb)) / 20);
      filters.push(`alimiter=limit=${limitLin.toFixed(4)}:attack=5:release=50`);
    }

    if (filters.length > 0) {
      args.push('-af', filters.join(','));
    }

    args.push('-ar', '24000', '-ac', '1', '-acodec', 'pcm_s16le', outputPath);

    await execFileAsync(FFMPEG_BIN, args, { timeout: 60000 });
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

export async function exportAudio(
  inputPath: string,
  outputPath: string,
  opts: ExportOptions
): Promise<{ mimeType: string; extension: string }> {
  const args = [
    '-y',
    '-i',
    inputPath,
    '-ar',
    String(opts.sampleRate || 24000),
    '-ac',
    String(opts.channels || 1),
  ];

  if (opts.titleMeta) {
    args.push('-metadata', `title=${opts.titleMeta}`);
  }
  if (opts.artistMeta) {
    args.push('-metadata', `artist=${opts.artistMeta}`);
  }
  args.push('-metadata', 'comment=Generated with AVA STUDIO');

  let mimeType = 'audio/wav';
  let extension = 'wav';

  switch (opts.format) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', `${opts.mp3BitrateKbps || 192}k`);
      mimeType = 'audio/mpeg';
      extension = 'mp3';
      break;
    case 'flac':
      args.push('-c:a', 'flac');
      mimeType = 'audio/flac';
      extension = 'flac';
      break;
    case 'm4a':
      args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
      mimeType = 'audio/mp4';
      extension = 'm4a';
      break;
    case 'ogg':
      args.push('-c:a', 'libopus', '-b:a', '128k');
      mimeType = 'audio/ogg';
      extension = 'ogg';
      break;
    case 'wav':
    default:
      args.push('-c:a', 'pcm_s16le');
      mimeType = 'audio/wav';
      extension = 'wav';
      break;
  }

  args.push(outputPath);
  await execFileAsync(FFMPEG_BIN, args, { timeout: 60000 });
  return { mimeType, extension };
}
