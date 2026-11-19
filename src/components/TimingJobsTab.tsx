import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';
import {
  cancelSynthesisJob,
  createSynthesisJob,
  resumeSynthesisJob,
} from '../services/api';
import type {
  AudioArtifact,
  DictionaryEntry,
  SpeechControlsConfig,
  SynthesisJob,
} from '../types/studio';
import {
  analyzeTargetDurationFeasibility,
  applyPronunciationDictionary,
  formatTimecode,
  splitTextIntoChunks,
} from '../utils/persianText';

interface TimingJobsTabProps {
  projectTitle: string;
  approvedText: string;
  controls: SpeechControlsConfig;
  dictionary: DictionaryEntry[];
  targetDurationSec: number | null;
  onTargetDurationChange: (sec: number | null) => void;
  jobs: SynthesisJob[];
  onJobUpdated: (job: SynthesisJob) => void;
  onRefreshJobs: () => Promise<void>;
  onSelectAudioId: (audioId: string) => void;
  artifacts: AudioArtifact[];
}

export const TimingJobsTab: React.FC<TimingJobsTabProps> = ({
  projectTitle,
  approvedText,
  controls,
  dictionary,
  targetDurationSec,
  onTargetDurationChange,
  jobs,
  onJobUpdated,
  onRefreshJobs,
  onSelectAudioId,
}) => {
  const [unit, setUnit] = useState<'sec' | 'min'>('sec');
  const [tolerance, setTolerance] = useState(5);
  const [autoStretch, setAutoStretch] = useState(true);
  const [maxCharsPerChunk, setMaxCharsPerChunk] = useState(950);
  const [starting, setStarting] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  const speechText = useMemo(
    () => applyPronunciationDictionary(approvedText, dictionary).speechReadyText,
    [approvedText, dictionary]
  );

  const chunkPreview = useMemo(
    () => splitTextIntoChunks(speechText, maxCharsPerChunk),
    [speechText, maxCharsPerChunk]
  );

  const feasibility = useMemo(() => {
    if (!targetDurationSec || targetDurationSec <= 0) return null;
    return analyzeTargetDurationFeasibility(speechText, targetDurationSec);
  }, [speechText, targetDurationSec]);

  const displayValue = targetDurationSec
    ? unit === 'min'
      ? Number((targetDurationSec / 60).toFixed(2))
      : targetDurationSec
    : '';

  const handleInputChange = (val: string) => {
    if (!val) {
      onTargetDurationChange(null);
      return;
    }
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) {
      onTargetDurationChange(null);
      return;
    }
    onTargetDurationChange(unit === 'min' ? Math.round(n * 60) : Math.round(n));
  };

  const handleStartJob = async () => {
    if (!approvedText.trim()) {
      setErrorFa('متن تاییدشده برای صف پردازش خالی است.');
      return;
    }
    setStarting(true);
    setErrorFa(null);
    try {
      const { job } = await createSynthesisJob({
        title: projectTitle || 'تولید زمان‌بندی‌شده',
        text: approvedText,
        controls,
        maxCharsPerChunk,
        targetDurationSec: targetDurationSec || null,
        tolerancePercent: tolerance,
        autoTimeStretch: autoStretch,
      });
      onJobUpdated(job);
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ثبت صف پردازش.');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { job } = await cancelSynthesisJob(id);
      onJobUpdated(job);
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در لغو کار.');
    }
  };

  const handleResume = async (id: string) => {
    try {
      const { job } = await resumeSynthesisJob(id);
      onJobUpdated(job);
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ادامه کار.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Target Duration & Chunking Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              کنترل مدت زمان هدف و تحلیل امکان‌پذیری
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[30, 60, 120, 300].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onTargetDurationChange(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  targetDurationSec === sec
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {sec < 60 ? `${sec} ثانیه` : `${sec / 60} دقیقه`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                زمان هدف دلخواه
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={unit === 'min' ? 0.5 : 1}
                  value={displayValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="مثلاً 45"
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono tabular-nums"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'sec' | 'min')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                >
                  <option value="sec">ثانیه</option>
                  <option value="min">دقیقه</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                تلورانس مجاز (%)
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value) || 5)}
                className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono tabular-nums"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStretch}
                onChange={(e) => setAutoStretch(e.target.checked)}
                className="accent-teal-700"
              />
              <span>کشش زمانی بدون تغییر گام</span>
            </label>
          </div>

          {feasibility ? (
            <div
              className={`rounded-lg border p-3 text-xs space-y-1.5 ${
                feasibility.severity === 'unrealistic'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                  : feasibility.severity === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                  : 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {feasibility.severity === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  سرعت لازم: {feasibility.requiredWpm} واژه بر دقیقه · برآورد طبیعی: {formatTimecode(feasibility.estimatedNaturalSec)}
                </span>
              </div>
              <p className="leading-relaxed">{feasibility.messageFa}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              یک مدت زمان هدف وارد کنید تا پیش از تولید، تعداد واژگان بر دقیقه (WPM) و امکان‌پذیری طبیعی بودن گفتار محاسبه شود.
            </p>
          )}
        </section>

        {/* Long Text Chunking Preview */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              تقطیع خودکار متن‌های طولانی ({chunkPreview.length} قطعه)
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-500">حداکثر نویسه هر قطعه:</label>
              <input
                type="number"
                min={350}
                max={2000}
                step={50}
                value={maxCharsPerChunk}
                onChange={(e) => setMaxCharsPerChunk(Number(e.target.value) || 950)}
                className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-2">
            {chunkPreview.map((chunk, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] p-2.5 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>قطعه {i + 1}</span>
                  <span className="font-mono tabular-nums">{chunk.length} نویسه</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {chunk}
                </p>
              </div>
            ))}
          </div>

          {errorFa && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-2.5 text-xs text-red-700 dark:text-red-300">
              {errorFa}
            </div>
          )}

          <button
            type="button"
            disabled={starting || chunkPreview.length === 0}
            onClick={handleStartJob}
            className="studio-focus w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-50"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>اجرای صف پردازش طولانی و اتصال خودکار</span>
          </button>
        </section>
      </div>

      {/* Job Queue Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            صف کارهای پردازشی و بازیابی خطا ({jobs.length})
          </h3>
          <button
            type="button"
            onClick={onRefreshJobs}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>بروزرسانی</span>
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            هنوز صف پردازش طولانی ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {job.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 mt-0.5 tabular-nums">
                      <span>
                        وضعیت:{' '}
                        {job.status === 'completed'
                          ? 'تکمیل‌شده'
                          : job.status === 'running'
                          ? 'در حال اجرا'
                          : job.status === 'queued'
                          ? 'در صف'
                          : job.status === 'partial'
                          ? 'ناقص (قابل ادامه)'
                          : job.status === 'cancelled'
                          ? 'لغوشده'
                          : 'خطا'}
                      </span>
                      <span>·</span>
                      <span>
                        {job.completedChunks} از {job.totalChunks} قطعه
                      </span>
                      {job.finalDurationSec && (
                        <>
                          <span>·</span>
                          <span className="font-mono">
                            زمان نهایی: {formatTimecode(job.finalDurationSec)}
                          </span>
                        </>
                      )}
                      {job.appliedSpeedFactor && job.appliedSpeedFactor !== 1 && (
                        <>
                          <span>·</span>
                          <span className="font-mono">ضریب سرعت: {job.appliedSpeedFactor}x</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(job.status === 'running' || job.status === 'queued') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                      >
                        <Square className="w-3 h-3" />
                        <span>لغو</span>
                      </button>
                    )}
                    {(job.status === 'partial' || job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => handleResume(job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>ادامه از بخش‌های باقی‌مانده</span>
                      </button>
                    )}
                    {job.finalAudioId && (
                      <button
                        type="button"
                        onClick={() => onSelectAudioId(job.finalAudioId!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
                      >
                        <Play className="w-3 h-3" />
                        <span>پخش خروجی نهایی</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Chunk pills */}
                <div className="flex flex-wrap gap-1.5">
                  {job.chunks.map((c) => (
                    <span
                      key={c.index}
                      title={c.errorFa || c.text.slice(0, 80)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums ${
                        c.status === 'completed'
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                          : c.status === 'processing'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                          : c.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      #{c.index + 1}
                    </span>
                  ))}
                </div>

                {job.errorFa && (
                  <p className="text-xs text-red-600 dark:text-red-300">{job.errorFa}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
