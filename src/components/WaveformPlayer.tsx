import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  Repeat,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AudioArtifact } from '../types/studio';
import { formatTimecode } from '../utils/persianText';

interface WaveformPlayerProps {
  artifact: AudioArtifact;
  onOpenExport: () => void;
  onOpenEditor?: () => void;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  artifact,
  onOpenExport,
  onOpenEditor,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(artifact.durationSec || 0);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.95);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(artifact.durationSec || 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [artifact.id, artifact.durationSec]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
    audio.loop = loop;
    audio.playbackRate = playbackRate;
  }, [volume, muted, loop, playbackRate]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const peaks = artifact.waveformPeaks?.length
      ? artifact.waveformPeaks
      : Array(120).fill(0.2);
    const barCount = peaks.length;
    const width = rect.width;
    const height = rect.height;
    const gap = 2;
    const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const isDark = document.documentElement.classList.contains('dark');

    ctx.clearRect(0, 0, width, height);

    // Draw segment boundaries if available
    if (artifact.segmentMarkers?.length && duration > 0) {
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1;
      for (const seg of artifact.segmentMarkers) {
        if (seg.startSec > 0) {
          const x = (seg.startSec / duration) * width;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (let i = 0; i < barCount; i++) {
      const amp = Math.max(0.06, peaks[i]);
      const barH = Math.max(4, amp * (height - 10));
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;
      const barProgress = (i + 0.5) / barCount;

      if (barProgress <= progressRatio) {
        ctx.fillStyle = isDark ? '#14B8A6' : '#0F766E';
      } else {
        ctx.fillStyle = isDark ? '#334155' : '#CBD5E1';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(1.5, barWidth), barH, 1.5);
      ctx.fill();
    }
  }, [artifact.waveformPeaks, artifact.segmentMarkers, currentTime, duration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextTime = ratio * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const jumpToSec = (sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, sec));
    setCurrentTime(audio.currentTime);
  };

  const activeSegmentIdx = artifact.segmentMarkers?.findIndex(
    (m) => currentTime >= m.startSec && currentTime <= m.endSec + 0.05
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5">
      <audio
        ref={audioRef}
        src={`/api/audio/${encodeURIComponent(artifact.id)}`}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {artifact.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{artifact.personaNameFa}</span>
            <span aria-hidden="true">·</span>
            <span>{artifact.styleNameFa}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{artifact.modelUsed}</span>
            {artifact.loudness && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {artifact.loudness.integratedLufs} LUFS
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ویرایش صوت</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenExport}
            className="studio-focus inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی و دانلود</span>
          </button>
        </div>
      </div>

      {/* Interactive LTR Waveform Canvas (audio timeline progresses left-to-right standard) */}
      <div dir="ltr" className="relative rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 px-3 py-2.5 mb-3">
        <canvas
          ref={canvasRef}
          onClick={handleSeek}
          role="slider"
          aria-label="نوار زمان موج صوتی"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              void togglePlay();
            } else if (e.key === 'ArrowRight') {
              jumpToSec(currentTime + 2);
            } else if (e.key === 'ArrowLeft') {
              jumpToSec(currentTime - 2);
            }
          }}
          className="w-full h-16 cursor-pointer block studio-focus rounded"
        />
      </div>

      {/* Transport Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'توقف پخش' : 'پخش صوت'}
            className="studio-focus inline-flex items-center justify-center w-10 h-10 rounded-lg bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <div dir="ltr" className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 px-2">
            <span>{formatTimecode(currentTime)}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span>{formatTimecode(duration)}</span>
          </div>

          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            title="تکرار پخش"
            aria-pressed={loop}
            className={`studio-focus p-2 rounded-lg border text-xs transition-colors ${
              loop
                ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-500'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Playback speed */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
            {[0.85, 1, 1.15, 1.35].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono tabular-nums transition-colors ${
                  playbackRate === rate
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              aria-label="تنظیم بلندی صدا"
              className="w-20 accent-teal-700 dark:accent-teal-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Real Segment Markers (only shown when trustworthy chunk/speaker timing exists) */}
      {artifact.segmentMarkers && artifact.segmentMarkers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            نشانگر بخش‌های تاییدشده (زمان‌بندی واقعی قطعات):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {artifact.segmentMarkers.map((seg, idx) => (
              <button
                key={`${seg.label}-${idx}`}
                type="button"
                onClick={() => jumpToSec(seg.startSec)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                  activeSegmentIdx === idx
                    ? 'bg-teal-700 text-white dark:bg-teal-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{seg.label}</span>
                <span dir="ltr" className="font-mono text-[11px] opacity-80 mr-1.5 tabular-nums">
                  {formatTimecode(seg.startSec)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
