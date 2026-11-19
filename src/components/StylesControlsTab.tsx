import React, { useState } from 'react';
import { Check, Info, RotateCcw, Sliders } from 'lucide-react';
import { SPEAKING_STYLES } from '../data/catalog';
import type { SpeakingStyle, SpeechControlsConfig } from '../types/studio';

interface StylesControlsTabProps {
  controls: SpeechControlsConfig;
  onControlsChange: (next: SpeechControlsConfig) => void;
}

const STYLE_CATEGORIES = [
  'همه',
  'هواشناسی و اقلیم',
  'خبری و میدانی',
  'مستند و علمی',
  'پادکست و محاوره',
  'داستانی و ادبی',
  'احساسی و نمایشی',
] as const;

export const StylesControlsTab: React.FC<StylesControlsTabProps> = ({
  controls,
  onControlsChange,
}) => {
  const [category, setCategory] = useState<string>('همه');
  const selectedStyle = SPEAKING_STYLES.find((s) => s.id === controls.styleId);

  const visibleStyles = SPEAKING_STYLES.filter(
    (s) => category === 'همه' || s.categoryFa === category
  );

  const applyStyle = (style: SpeakingStyle) => {
    onControlsChange({
      ...controls,
      styleId: style.id,
      customStylePrompt: style.stylePromptEn,
      sentencePauseMs: style.recommendedPauseMs,
    });
  };

  return (
    <div className="space-y-6">
      {/* Speech Controls Architecture: Native vs Prompt vs Post-processing */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            کنترل‌های بیان و تفکیک سطح اجرا (بومی، دستوری، پس‌پردازش)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Native Model Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] p-4 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              ۱. کنترل‌های بومی مدل (Native API)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              تنظیماتی که مستقیماً توسط API جمینای پشتیبانی می‌شوند. کنترل‌هایی مانند تغییر مستقیم گام (Pitch Shift) به صورت بومی در API وجود ندارند و غیرفعال نگه داشته شده‌اند.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">شناسه صدا (Voice)</span>
                <span className="font-mono font-semibold">{controls.voiceId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-slate-800 opacity-50">
                <span>زیربمی بومی (Native Pitch)</span>
                <span>پشتیبانی نمی‌شود</span>
              </div>
              <div className="flex items-center justify-between py-1.5 opacity-50">
                <span>سرعت بومی مدل (Native Rate)</span>
                <span>از طریق FFmpeg اعمال می‌شود</span>
              </div>
            </div>
          </div>

          {/* 2. Prompt-level Guidance */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] p-4 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              ۲. هدایت در سطح دستور (Prompt Guidance)
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">شدت احساسی</label>
                <select
                  value={controls.emotionalIntensity}
                  onChange={(e) =>
                    onControlsChange({
                      ...controls,
                      emotionalIntensity: e.target.value as SpeechControlsConfig['emotionalIntensity'],
                    })
                  }
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  <option value="low">ملایم و کنترل‌شده</option>
                  <option value="medium">متعادل</option>
                  <option value="high">قوی و پرانرژی</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">پویایی بیان</label>
                <select
                  value={controls.expressiveness}
                  onChange={(e) =>
                    onControlsChange({
                      ...controls,
                      expressiveness: e.target.value as SpeechControlsConfig['expressiveness'],
                    })
                  }
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  <option value="restrained">یکنواخت و رسمی</option>
                  <option value="balanced">متوازن</option>
                  <option value="expressive">بیانگر و داستانی</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">حساسیت به علائم سجاوندی</label>
                <select
                  value={controls.punctuationSensitivity}
                  onChange={(e) =>
                    onControlsChange({
                      ...controls,
                      punctuationSensitivity: e.target.value as SpeechControlsConfig['punctuationSensitivity'],
                    })
                  }
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  <option value="natural">طبیعی</option>
                  <option value="strict">مکث دقیق روی ویرگول و نقطه</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. FFmpeg Post-Processing Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] p-4 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              ۳. کنترل‌های دقیق پس‌پردازش (FFmpeg DSP)
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span>سرعت بدون تغییر گام (atempo)</span>
                  <span dir="ltr" className="font-mono tabular-nums">{controls.speedMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.35}
                  step={0.05}
                  value={controls.speedMultiplier}
                  onChange={(e) =>
                    onControlsChange({ ...controls, speedMultiplier: parseFloat(e.target.value) })
                  }
                  className="w-full accent-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">مکث بین بخش‌ها (ms)</label>
                  <input
                    type="number"
                    min={0}
                    max={2500}
                    step={50}
                    value={controls.paragraphPauseMs}
                    onChange={(e) =>
                      onControlsChange({
                        ...controls,
                        paragraphPauseMs: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">بهره خروجی (dB)</label>
                  <input
                    type="number"
                    min={-12}
                    max={12}
                    step={1}
                    value={controls.outputGainDb}
                    onChange={(e) =>
                      onControlsChange({
                        ...controls,
                        outputGainDb: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={controls.normalizeLoudness}
                    onChange={(e) =>
                      onControlsChange({ ...controls, normalizeLoudness: e.target.checked })
                    }
                    className="accent-teal-700"
                  />
                  <span>نرمال‌سازی استاندارد (LUFS)</span>
                </span>
                <span dir="ltr" className="font-mono tabular-nums text-slate-500">
                  {controls.targetLufs} LUFS
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Editable Style Prompt Box */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              متن قابل ویرایش دستور سبک فعال ({selectedStyle?.nameFa || 'سفارشی'}):
            </label>
            <button
              type="button"
              onClick={() =>
                onControlsChange({
                  ...controls,
                  customStylePrompt: selectedStyle?.stylePromptEn || '',
                })
              }
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="w-3 h-3" />
              <span>بازنشانی دستور پیش‌فرض</span>
            </button>
          </div>
          <textarea
            rows={2}
            dir="ltr"
            value={controls.customStylePrompt || selectedStyle?.stylePromptEn || ''}
            onChange={(e) =>
              onControlsChange({ ...controls, customStylePrompt: e.target.value })
            }
            className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-xs font-mono text-slate-800 dark:text-slate-200"
          />
          <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-600" />
            <span>
              در سبک‌های هواشناسی، اولویت با تلفظ علمی دقیق، آهنگ طبیعی فارسی ایران و وضوح اعداد بدون اغراق نمایشی است.
            </span>
          </div>
        </div>
      </section>

      {/* Style Presets Grid */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {STYLE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                category === cat
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleStyles.map((style) => {
            const active = controls.styleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => applyStyle(style)}
                className={`studio-focus text-right rounded-xl border p-4 transition-colors flex flex-col justify-between gap-2 ${
                  active
                    ? 'border-teal-600 bg-teal-50/40 dark:bg-teal-950/25 dark:border-teal-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {style.nameFa}
                    </span>
                    {active && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {style.categoryFa}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {style.descriptionFa}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
