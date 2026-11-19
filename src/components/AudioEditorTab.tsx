import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  Merge,
  Redo2,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { mergeAudioArtifacts, processAudioArtifact } from '../services/api';
import type { AudioArtifact, AudioEditOperations } from '../types/studio';
import { formatTimecode } from '../utils/persianText';
import { WaveformPlayer } from './WaveformPlayer';

interface AudioEditorTabProps {
  artifacts: AudioArtifact[];
  activeArtifact: AudioArtifact | null;
  onArtifactSelected: (artifact: AudioArtifact) => void;
  onArtifactCreated: (artifact: AudioArtifact) => void;
  onOpenExport: () => void;
}

export const AudioEditorTab: React.FC<AudioEditorTabProps> = ({
  artifacts,
  activeArtifact,
  onArtifactSelected,
  onArtifactCreated,
  onOpenExport,
}) => {
  const [undoStack, setUndoStack] = useState<AudioArtifact[]>([]);
  const [redoStack, setRedoStack] = useState<AudioArtifact[]>([]);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [insertSilAt, setInsertSilAt] = useState(0);
  const [insertSilDur, setInsertSilDur] = useState(0);
  const [removeLongSilences, setRemoveLongSilences] = useState(false);
  const [normalizeLufs, setNormalizeLufs] = useState<number | null>(-16);
  const [peakLimitDb, setPeakLimitDb] = useState<number | null>(-1.0);
  const [volumeDb, setVolumeDb] = useState(0);
  const [noiseReduce, setNoiseReduce] = useState(false);

  // Merge multi-artifacts
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [mergePauseMs, setMergePauseMs] = useState(300);

  const [processing, setProcessing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [noticeFa, setNoticeFa] = useState<string | null>(null);

  useEffect(() => {
    if (activeArtifact) {
      setTrimStart(0);
      setTrimEnd(Number(activeArtifact.durationSec.toFixed(2)));
    }
  }, [activeArtifact?.id, activeArtifact?.durationSec]);

  const resetEditsForm = () => {
    if (activeArtifact) {
      setTrimStart(0);
      setTrimEnd(Number(activeArtifact.durationSec.toFixed(2)));
    }
    setSpeed(1.0);
    setFadeIn(0);
    setFadeOut(0);
    setInsertSilAt(0);
    setInsertSilDur(0);
    setRemoveLongSilences(false);
    setNormalizeLufs(-16);
    setPeakLimitDb(-1.0);
    setVolumeDb(0);
    setNoiseReduce(false);
  };

  const handleApplyEdits = async () => {
    if (!activeArtifact) return;
    setProcessing(true);
    setErrorFa(null);
    setNoticeFa(null);
    try {
      const ops: AudioEditOperations = {
        trimStartSec: trimStart > 0 ? trimStart : undefined,
        trimEndSec: trimEnd < activeArtifact.durationSec - 0.05 ? trimEnd : undefined,
        speed: Math.abs(speed - 1.0) >= 0.01 ? speed : undefined,
        fadeInSec: fadeIn > 0 ? fadeIn : undefined,
        fadeOutSec: fadeOut > 0 ? fadeOut : undefined,
        insertSilenceAtSec: insertSilDur > 0 ? insertSilAt : undefined,
        insertSilenceDurationSec: insertSilDur > 0 ? insertSilDur : undefined,
        removeLongSilences,
        normalizeLufs,
        peakLimitDb,
        volumeDb: Math.abs(volumeDb) >= 0.1 ? volumeDb : undefined,
        noiseReduce,
      };
      const res = await processAudioArtifact(activeArtifact.id, ops);
      setUndoStack((prev) => [...prev, activeArtifact]);
      setRedoStack([]);
      onArtifactCreated(res.artifact);
      onArtifactSelected(res.artifact);
      setNoticeFa('نسخه ویرایش‌شده جدید بدون تخریب فایل اصلی ساخته شد.');
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ویرایش صوت.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !activeArtifact) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, activeArtifact]);
    onArtifactSelected(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activeArtifact) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, activeArtifact]);
    onArtifactSelected(next);
  };

  const handleRestoreOriginal = () => {
    if (!activeArtifact?.parentId) return;
    const orig = artifacts.find((a) => a.id === activeArtifact.parentId);
    if (orig) {
      onArtifactSelected(orig);
      setNoticeFa('نسخه اصلی بدون ویرایش بارگذاری شد.');
    }
  };

  const toggleMergeId = (id: string) => {
    setMergeSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (mergeSelectedIds.length < 2) return;
    setMerging(true);
    setErrorFa(null);
    setNoticeFa(null);
    try {
      const res = await mergeAudioArtifacts({
        audioIds: mergeSelectedIds,
        pauseMs: mergePauseMs,
        title: `ادغام ${mergeSelectedIds.length} قطعه`,
      });
      onArtifactCreated(res.artifact);
      onArtifactSelected(res.artifact);
      setMergeSelectedIds([]);
      setNoticeFa('فایل‌های انتخاب‌شده با موفقیت به هم متصل شدند.');
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ادغام فایل‌ها.');
    } finally {
      setMerging(false);
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        هنوز هیچ فایل صوتی تولید نشده است. ابتدا در تب «استودیوی صدا» یک گفتار تولید کنید تا ابزارهای تدوین، برش، نرمال‌سازی و خروجی FFmpeg در دسترس قرار گیرند.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source Selector & Undo/Redo */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
            قطعه فعال برای ویرایش:
          </label>
          <select
            value={activeArtifact?.id || ''}
            onChange={(e) => {
              const found = artifacts.find((a) => a.id === e.target.value);
              if (found) onArtifactSelected(found);
            }}
            className="studio-focus flex-1 max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
          >
            {artifacts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({formatTimecode(a.durationSec)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            title="بازگشت به نسخه قبلی"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            title="تکرار"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          {activeArtifact?.parentId && (
            <button
              type="button"
              onClick={handleRestoreOriginal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازگشت به صوت اصلی</span>
            </button>
          )}
          {activeArtifact && (
            <button
              type="button"
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی MP3 / WAV / FLAC</span>
            </button>
          )}
        </div>
      </div>

      {activeArtifact && (
        <WaveformPlayer artifact={activeArtifact} onOpenExport={onOpenExport} />
      )}

      {errorFa && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
          {errorFa}
        </div>
      )}
      {noticeFa && !errorFa && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/30 p-3 text-xs text-teal-800 dark:text-teal-300">
          {noticeFa}
        </div>
      )}

      {/* Non-destructive Editing Panel */}
      {activeArtifact && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ابزارهای پردازش و تدوین غیرمخرب صوت (FFmpeg)
                </h3>
              </div>
              <button
                type="button"
                onClick={resetEditsForm}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                بازنشانی تنظیمات
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Trim */}
              <div className="space-y-1.5">
                <label className="font-semibold block">شروع برش (ثانیه)</label>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, activeArtifact.durationSec - 0.1)}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold block">پایان برش (ثانیه)</label>
                <input
                  type="number"
                  min={0.1}
                  max={activeArtifact.durationSec}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              {/* Speed */}
              <div className="space-y-1.5">
                <label className="font-semibold flex justify-between">
                  <span>سرعت با حفظ گام</span>
                  <span dir="ltr" className="font-mono tabular-nums">{speed.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-teal-700"
                />
              </div>

              {/* Fades */}
              <div className="space-y-1.5">
                <label className="font-semibold block">محو ورود / Fade In (ثانیه)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={fadeIn}
                  onChange={(e) => setFadeIn(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold block">محو خروج / Fade Out (ثانیه)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={fadeOut}
                  onChange={(e) => setFadeOut(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              {/* Gain */}
              <div className="space-y-1.5">
                <label className="font-semibold block">تنظیم سطح صدا (dB)</label>
                <input
                  type="number"
                  min={-18}
                  max={12}
                  step={0.5}
                  value={volumeDb}
                  onChange={(e) => setVolumeDb(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              {/* Insert silence */}
              <div className="space-y-1.5">
                <label className="font-semibold block">درج سکوت در ثانیه</label>
                <input
                  type="number"
                  min={0}
                  max={activeArtifact.durationSec}
                  step={0.1}
                  value={insertSilAt}
                  onChange={(e) => setInsertSilAt(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold block">مدت سکوت درجی (ثانیه)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={insertSilDur}
                  onChange={(e) => setInsertSilDur(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>

              {/* Loudness LUFS */}
              <div className="space-y-1.5">
                <label className="font-semibold block">نرمال‌سازی بلندی (EBU R128)</label>
                <select
                  value={normalizeLufs === null ? 'none' : String(normalizeLufs)}
                  onChange={(e) =>
                    setNormalizeLufs(e.target.value === 'none' ? null : Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  <option value="none">خاموش</option>
                  <option value="-14">-14 LUFS (پادکست / وب)</option>
                  <option value="-16">-16 LUFS (استاندارد استودیو)</option>
                  <option value="-18">-18 LUFS (کتاب صوتی)</option>
                  <option value="-23">-23 LUFS (استاندارد پخش EBU)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={peakLimitDb !== null}
                  onChange={(e) => setPeakLimitDb(e.target.checked ? -1.0 : null)}
                  className="accent-teal-700"
                />
                <span>محدودکننده قله (Peak Limiter -1 dBFS)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeLongSilences}
                  onChange={(e) => setRemoveLongSilences(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>کاهش سکوت‌های طولانی</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noiseReduce}
                  onChange={(e) => setNoiseReduce(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>فیلتر حذف نویز پس‌زمینه (FFT Denoise + Highpass 75Hz)</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={processing}
                onClick={handleApplyEdits}
                className="studio-focus inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SlidersHorizontal className="w-4 h-4" />
                )}
                <span>اعمال پردازش و ساخت نسخه جدید</span>
              </button>
            </div>
          </section>

          {/* Merge multiple artifacts */}
          <section className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Merge className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                ادغام چند فایل صوتی
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              دو یا چند فایل صوتی تولیدشده را انتخاب کنید تا با مکث استاندارد به هم متصل شوند.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {artifacts.slice(0, 20).map((a) => {
                const checked = mergeSelectedIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMergeId(a.id)}
                    className={`w-full text-right flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                      checked
                        ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="truncate">{a.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {formatTimecode(a.durationSec)}
                      </span>
                      {checked && <Check className="w-3.5 h-3.5 text-teal-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="text-slate-600 dark:text-slate-400">مکث بین قطعات (ms):</label>
              <input
                type="number"
                min={0}
                max={3000}
                step={50}
                value={mergePauseMs}
                onChange={(e) => setMergePauseMs(Number(e.target.value) || 0)}
                className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono tabular-nums"
              />
            </div>

            <button
              type="button"
              disabled={merging || mergeSelectedIds.length < 2}
              onClick={handleMerge}
              className="studio-focus w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-40"
            >
              {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
              <span>ادغام ({mergeSelectedIds.length} مورد)</span>
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
