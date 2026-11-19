import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Play,
  Sparkles,
  Square,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  REAL_PREBUILT_VOICES,
  SAMPLE_PERSIAN_SCRIPTS,
  SPEAKING_STYLES,
  VOICE_PERSONAS,
} from '../data/catalog';
import {
  cancelSynthesisJob,
  createSynthesisJob,
  generateSpeech,
  requestVoicePreview,
} from '../services/api';
import type {
  AudioArtifact,
  DictionaryEntry,
  DiscoveredModel,
  SpeechControlsConfig,
  StudioTab,
  SynthesisJob,
} from '../types/studio';
import {
  analyzeTargetDurationFeasibility,
  applyPronunciationDictionary,
  countWordsAndChars,
  estimateSpeakingDurationSec,
  formatTimecode,
} from '../utils/persianText';
import { WaveformPlayer } from './WaveformPlayer';

interface StudioWorkspaceTabProps {
  projectTitle: string;
  onProjectTitleChange: (title: string) => void;
  approvedText: string;
  onApprovedTextChange: (text: string) => void;
  controls: SpeechControlsConfig;
  onControlsChange: (next: SpeechControlsConfig) => void;
  dictionary: DictionaryEntry[];
  ttsModels: DiscoveredModel[];
  targetDurationSec: number | null;
  onTargetDurationChange: (sec: number | null) => void;
  activeArtifact: AudioArtifact | null;
  onArtifactReady: (artifact: AudioArtifact) => void;
  activeJob: SynthesisJob | null;
  onJobStarted: (job: SynthesisJob) => void;
  onNavigateTab: (tab: StudioTab) => void;
  onRunQuickDiacritize: () => Promise<void>;
  diacritizing: boolean;
  onOpenExport: () => void;
}

export const StudioWorkspaceTab: React.FC<StudioWorkspaceTabProps> = ({
  projectTitle,
  onProjectTitleChange,
  approvedText,
  onApprovedTextChange,
  controls,
  onControlsChange,
  dictionary,
  ttsModels,
  targetDurationSec,
  onTargetDurationChange,
  activeArtifact,
  onArtifactReady,
  activeJob,
  onJobStarted,
  onNavigateTab,
  onRunQuickDiacritize,
  diacritizing,
  onOpenExport,
}) => {
  const [applyDict, setApplyDict] = useState(true);
  const [showSpeechPreview, setShowSpeechPreview] = useState(false);
  const [autoStretch, setAutoStretch] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [statusNoticeFa, setStatusNoticeFa] = useState<string | null>(null);

  const stats = useMemo(() => countWordsAndChars(approvedText), [approvedText]);
  const estDurationSec = useMemo(
    () => estimateSpeakingDurationSec(approvedText, controls.speedMultiplier),
    [approvedText, controls.speedMultiplier]
  );

  const dictResult = useMemo(
    () => applyPronunciationDictionary(approvedText, dictionary),
    [approvedText, dictionary]
  );

  const feasibility = useMemo(() => {
    if (!targetDurationSec || targetDurationSec <= 0) return null;
    return analyzeTargetDurationFeasibility(dictResult.speechReadyText, targetDurationSec);
  }, [dictResult.speechReadyText, targetDurationSec]);

  const selectedPersona = VOICE_PERSONAS.find((p) => p.id === controls.personaId);
  const selectedStyle = SPEAKING_STYLES.find((s) => s.id === controls.styleId);

  const handleGenerate = async () => {
    const clean = approvedText.trim();
    if (!clean) {
      setErrorFa('ابتدا متن فارسی مورد نظر را در ویرایشگر وارد کنید.');
      return;
    }
    setErrorFa(null);
    setStatusNoticeFa(null);

    const needsChunkQueue = clean.length > 950 || Boolean(targetDurationSec && targetDurationSec > 0);

    if (needsChunkQueue) {
      setGenerating(true);
      try {
        const { job } = await createSynthesisJob({
          title: projectTitle || 'خروجی استودیو',
          text: clean,
          controls,
          maxCharsPerChunk: 950,
          targetDurationSec: targetDurationSec || null,
          tolerancePercent: 5,
          autoTimeStretch: autoStretch,
        });
        onJobStarted(job);
        setStatusNoticeFa(
          job.totalChunks > 1
            ? `متن در ${job.totalChunks} بخش منظم قرار گرفت و صف پردازش آغاز شد.`
            : 'پردازش زمان‌بندی‌شده در صف آغاز شد.'
        );
      } catch (err) {
        setErrorFa(err instanceof Error ? err.message : 'خطا در آغاز صف تولید.');
      } finally {
        setGenerating(false);
      }
      return;
    }

    setGenerating(true);
    try {
      const res = await generateSpeech({
        title: projectTitle || 'خروجی استودیو',
        text: clean,
        controls,
        applyDictionary: applyDict,
      });
      onArtifactReady(res.artifact);
      if (res.appliedRules.length > 0) {
        setStatusNoticeFa(
          `گفتار تولید شد (${res.appliedRules.length} قاعده تلفظ از واژه‌نامه اعمال شد).`
        );
      } else {
        setStatusNoticeFa('تولید گفتار با موفقیت انجام شد.');
      }
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در تولید گفتار.');
    } finally {
      setGenerating(false);
    }
  };

  const handleVoicePreview = async () => {
    setPreviewLoading(true);
    setErrorFa(null);
    try {
      const res = await requestVoicePreview({
        voiceId: controls.voiceId,
      });
      const audio = new Audio(res.audioUrl);
      await audio.play();
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در پخش نمونه صدا.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const jobInProgress =
    activeJob && (activeJob.status === 'queued' || activeJob.status === 'running');

  return (
    <div className="space-y-6">
      {/* Main 2-column studio split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right/Main Text Canvas (7 cols on lg) */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="studio-project-title" className="sr-only">
                عنوان پروژه
              </label>
              <input
                id="studio-project-title"
                type="text"
                value={projectTitle}
                onChange={(e) => onProjectTitleChange(e.target.value)}
                placeholder="عنوان پروژه یا قطعه صوتی..."
                className="studio-focus w-full text-base font-bold bg-transparent border-b border-transparent focus:border-teal-600 dark:focus:border-teal-400 pb-1 text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="بارگذاری متن نمونه"
                value=""
                onChange={(e) => {
                  const found = SAMPLE_PERSIAN_SCRIPTS.find((s) => s.id === e.target.value);
                  if (!found) return;
                  onProjectTitleChange(found.titleFa);
                  onApprovedTextChange(found.text);
                  const persona = VOICE_PERSONAS.find((p) => p.id === found.personaId);
                  onControlsChange({
                    ...controls,
                    styleId: found.styleId,
                    personaId: found.personaId,
                    voiceId: persona?.mappedVoiceId || controls.voiceId,
                  });
                }}
                className="studio-focus rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="">متن‌های نمونه فارسی...</option>
                {SAMPLE_PERSIAN_SCRIPTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titleFa}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={diacritizing || !approvedText.trim()}
                onClick={onRunQuickDiacritize}
                className="studio-focus inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-600/30 dark:border-teal-500/40 bg-teal-50/80 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {diacritizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>اعراب‌گذاری هوشمند</span>
              </button>
            </div>
          </div>

          <textarea
            value={approvedText}
            onChange={(e) => onApprovedTextChange(e.target.value)}
            rows={10}
            dir="rtl"
            placeholder="متن فارسی خود را اینجا بنویسید یا بچسبانید... برای وارد کردن فایل‌های DOCX، PDF یا SRT از تب ویرایشگر متن استفاده کنید."
            className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] p-3.5 text-[15px] leading-8 text-slate-900 dark:text-slate-100 resize-y"
          />

          {/* Clean unboxed metadata strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
              <span>{stats.wordCount} واژه</span>
              <span aria-hidden="true">·</span>
              <span>{stats.charCount} نویسه</span>
              <span aria-hidden="true">·</span>
              <span>{stats.sentenceCount} جمله</span>
              <span aria-hidden="true">·</span>
              <span>زمان تقریبی: {formatTimecode(estDurationSec)}</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyDict}
                  onChange={(e) => setApplyDict(e.target.checked)}
                  className="accent-teal-700 rounded"
                />
                <span>اعمال واژه‌نامه تلفظ ({dictResult.appliedRules.length} مورد منطبق)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSpeechPreview((v) => !v)}
                className="text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                {showSpeechPreview ? 'بستن پیش‌نمایش' : 'مشاهده متن آماده گفتار'}
              </button>
            </div>
          </div>

          {showSpeechPreview && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>نسخه ارسالی به موتور گفتار (بدون تغییر در متن اصلی شما):</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('dictionary')}
                  className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>مدیریت واژه‌نامه</span>
                </button>
              </div>
              <p className="text-xs leading-7 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {applyDict ? dictResult.speechReadyText : approvedText}
              </p>
            </div>
          )}
        </section>

        {/* Left Control Column (5 cols on lg) */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          {/* Model selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="studio-model-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                مدل سنتز گفتار
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={controls.autoModel}
                  onChange={(e) =>
                    onControlsChange({ ...controls, autoModel: e.target.checked })
                  }
                  className="accent-teal-700 rounded"
                />
                <span>جایگزینی خودکار در خطا</span>
              </label>
            </div>
            <select
              id="studio-model-select"
              value={controls.modelId}
              onChange={(e) => onControlsChange({ ...controls, modelId: e.target.value })}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            >
              {ttsModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} — {m.availableInEnv ? 'در دسترس' : 'نیازمند بررسی'}
                </option>
              ))}
            </select>
          </div>

          {/* Persona & Real Voice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="studio-persona-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                پرسونای نمایشی گوینده
              </label>
              <select
                id="studio-persona-select"
                value={controls.personaId}
                onChange={(e) => {
                  const p = VOICE_PERSONAS.find((x) => x.id === e.target.value);
                  if (!p) return;
                  onControlsChange({
                    ...controls,
                    personaId: p.id,
                    voiceId: p.mappedVoiceId,
                    styleId: p.recommendedStyleId,
                  });
                }}
                className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                {VOICE_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayNameFa} ({p.roleSummaryFa})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="studio-voice-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                شناسه واقعی صدا در API
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  id="studio-voice-select"
                  value={controls.voiceId}
                  onChange={(e) =>
                    onControlsChange({
                      ...controls,
                      voiceId: e.target.value as SpeechControlsConfig['voiceId'],
                    })
                  }
                  className="studio-focus flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                >
                  {REAL_PREBUILT_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={previewLoading}
                  onClick={handleVoicePreview}
                  title="پخش نمونه واقعی این صدا"
                  className="studio-focus p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                >
                  {previewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {selectedPersona && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              برچسب نمایشی «{selectedPersona.displayNameFa}» به صدای واقعی{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {controls.voiceId}
              </span>{' '}
              متصل است.
            </div>
          )}

          {/* Speaking style */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="studio-style-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                سبک و لحن اجرا (هدایت دستور)
              </label>
              <button
                type="button"
                onClick={() => onNavigateTab('styles')}
                className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline"
              >
                ویرایش دستور سبک
              </button>
            </div>
            <select
              id="studio-style-select"
              value={controls.styleId}
              onChange={(e) => onControlsChange({ ...controls, styleId: e.target.value })}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {SPEAKING_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.categoryFa} — {s.nameFa}
                </option>
              ))}
            </select>
            {selectedStyle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {selectedStyle.descriptionFa}
              </p>
            )}
          </div>

          {/* Speed & Target Duration */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  سرعت گفتار (پس‌پردازش حفظ زیربمی FFmpeg)
                </span>
                <span dir="ltr" className="font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                  {controls.speedMultiplier.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={controls.speedMultiplier}
                onChange={(e) =>
                  onControlsChange({
                    ...controls,
                    speedMultiplier: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-teal-700 dark:accent-teal-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div>
                <label htmlFor="studio-target-duration" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  مدت زمان هدف (ثانیه)
                </label>
                <input
                  id="studio-target-duration"
                  type="number"
                  min={0}
                  max={1800}
                  placeholder="اختیاری (مثلاً 30)"
                  value={targetDurationSec ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onTargetDurationChange(v ? Math.max(1, Number(v)) : null);
                  }}
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStretch}
                  onChange={(e) => setAutoStretch(e.target.checked)}
                  className="accent-teal-700 rounded"
                />
                <span>تطبیق خودکار زمان</span>
              </label>
            </div>

            {feasibility && (
              <div
                className={`rounded-lg p-2.5 text-xs flex items-start gap-2 border ${
                  feasibility.severity === 'unrealistic'
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                    : feasibility.severity === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                    : 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300'
                }`}
              >
                {feasibility.severity === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{feasibility.messageFa}</span>
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <div className="pt-2">
            <button
              type="button"
              disabled={generating || Boolean(jobInProgress) || !approvedText.trim()}
              onClick={handleGenerate}
              className="studio-focus w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-55 text-white transition-colors"
            >
              {generating || jobInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال تولید گفتار فارسی...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>تولید گفتار</span>
                </>
              )}
            </button>
          </div>

          {errorFa && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
              {errorFa}
            </div>
          )}

          {statusNoticeFa && !errorFa && (
            <div className="rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/30 p-3 text-xs text-teal-800 dark:text-teal-300">
              {statusNoticeFa}
            </div>
          )}
        </section>
      </div>

      {/* Live Chunked Job Progress */}
      {activeJob && (activeJob.status === 'running' || activeJob.status === 'queued' || activeJob.status === 'partial' || activeJob.status === 'failed') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              پیشرفت صف پردازش: {activeJob.title}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {activeJob.completedChunks} / {activeJob.totalChunks} بخش
              </span>
              {(activeJob.status === 'running' || activeJob.status === 'queued') && (
                <button
                  type="button"
                  onClick={() => cancelSynthesisJob(activeJob.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Square className="w-3 h-3" />
                  <span>لغو</span>
                </button>
              )}
              {(activeJob.status === 'partial' || activeJob.status === 'failed') && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('timing')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-700 text-white text-xs"
                >
                  <Play className="w-3 h-3" />
                  <span>مدیریت و ادامه صف</span>
                </button>
              )}
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all duration-300"
              style={{
                width: `${Math.round((activeJob.completedChunks / Math.max(1, activeJob.totalChunks)) * 100)}%`,
              }}
            />
          </div>
          {activeJob.feasibilityWarningFa && (
            <p className="text-xs text-amber-700 dark:text-amber-300">{activeJob.feasibilityWarningFa}</p>
          )}
          {activeJob.errorFa && (
            <p className="text-xs text-red-600 dark:text-red-300">{activeJob.errorFa}</p>
          )}
        </div>
      )}

      {/* Waveform Player */}
      {activeArtifact ? (
        <WaveformPlayer
          artifact={activeArtifact}
          onOpenExport={onOpenExport}
          onOpenEditor={() => onNavigateTab('audio-editor')}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-[#111827]/50 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          هنوز خروجی صوتی فعالی تولید نشده است. متن فارسی را وارد کرده و دکمه «تولید گفتار» را بزنید تا موج صوتی و پخش‌کننده در اینجا ظاهر شود.
        </div>
      )}
    </div>
  );
};
