import React, { useMemo, useState } from 'react';
import {
  Check,
  GitCompare,
  Heart,
  Info,
  Loader2,
  Play,
  Volume2,
} from 'lucide-react';
import {
  REAL_PREBUILT_VOICES,
  VOICE_PERSONAS,
} from '../data/catalog';
import { requestVoicePreview } from '../services/api';
import type { RealVoiceId, SpeechControlsConfig, VoicePersona } from '../types/studio';

interface VoicesLibraryTabProps {
  controls: SpeechControlsConfig;
  onSelectPersona: (persona: VoicePersona) => void;
  favorites: string[];
  onToggleFavorite: (personaId: string) => void;
  customVoiceSupported: boolean;
  customVoiceNoteFa: string;
}

const QUALITY_FILTERS = [
  'همه',
  'خبری',
  'علمی',
  'مستند',
  'گرم',
  'جدی',
  'داستانی',
  'شاعرانه',
  'محاوره‌ای',
  'آرام',
  'پرشتاب',
] as const;

export const VoicesLibraryTab: React.FC<VoicesLibraryTabProps> = ({
  controls,
  onSelectPersona,
  favorites,
  onToggleFavorite,
  customVoiceNoteFa,
}) => {
  const [filterQuality, setFilterQuality] = useState<string>('همه');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [abVoiceA, setAbVoiceA] = useState<RealVoiceId>('Kore');
  const [abVoiceB, setAbVoiceB] = useState<RealVoiceId>('Charon');
  const [abText, setAbText] = useState(
    'بر پایه آخرین تحلیل نقشه‌های هواشناسی، دمای هوا در استان فارس طی ۴۸ ساعت آینده روند کاهشی خواهد داشت.'
  );
  const [abAudioA, setAbAudioA] = useState<string | null>(null);
  const [abAudioB, setAbAudioB] = useState<string | null>(null);
  const [abLoading, setAbLoading] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  const filteredPersonas = useMemo(() => {
    return VOICE_PERSONAS.filter((p) => {
      if (onlyFavorites && !favorites.includes(p.id)) return false;
      if (filterQuality !== 'همه' && !p.qualities.includes(filterQuality as VoicePersona['qualities'][number])) {
        return false;
      }
      return true;
    });
  }, [filterQuality, onlyFavorites, favorites]);

  const handlePlayRealPreview = async (voiceId: RealVoiceId, styleDirection?: string, tag?: string) => {
    const key = tag || voiceId;
    setPlayingVoice(key);
    setErrorFa(null);
    try {
      const res = await requestVoicePreview({
        voiceId,
        stylePrompt: styleDirection,
      });
      const audio = new Audio(res.audioUrl);
      await audio.play();
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در پخش پیش‌نمایش صدا.');
    } finally {
      setPlayingVoice(null);
    }
  };

  const handleRunAbCompare = async () => {
    if (!abText.trim()) return;
    setAbLoading(true);
    setErrorFa(null);
    try {
      const [resA, resB] = await Promise.all([
        requestVoicePreview({ voiceId: abVoiceA, sampleText: abText }),
        requestVoicePreview({ voiceId: abVoiceB, sampleText: abText }),
      ]);
      setAbAudioA(resA.audioUrl);
      setAbAudioB(resB.audioUrl);
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در مقایسه A/B صداها.');
    } finally {
      setAbLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Honest API Transparency Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            شفافیت شناسه‌های واقعی صدا و پرسونای نمایشی
          </p>
          <p>{customVoiceNoteFa}</p>
        </div>
      </div>

      {errorFa && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
          {errorFa}
        </div>
      )}

      {/* Real 5 Prebuilt Voices */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          ۵ صدای پیش‌ساخته واقعی در Gemini API
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {REAL_PREBUILT_VOICES.map((voice) => (
            <div
              key={voice.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    {voice.id}
                  </span>
                  {controls.voiceId === voice.id && (
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                      فعال
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {voice.timbreNoteFa}
                </p>
              </div>
              <button
                type="button"
                disabled={playingVoice === voice.id}
                onClick={() => handlePlayRealPreview(voice.id)}
                className="studio-focus inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {playingVoice === voice.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                <span>شنیدن نمونه واقعی</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* A/B Comparison */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            مقایسه مستقیم A/B دو صدای واقعی روی یک متن مشترک
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">متن آزمایشی مشترک</label>
            <input
              type="text"
              value={abText}
              onChange={(e) => setAbText(e.target.value)}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">صدای A</label>
            <select
              value={abVoiceA}
              onChange={(e) => setAbVoiceA(e.target.value as RealVoiceId)}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono"
            >
              {REAL_PREBUILT_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">صدای B</label>
            <select
              value={abVoiceB}
              onChange={(e) => setAbVoiceB(e.target.value as RealVoiceId)}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono"
            >
              {REAL_PREBUILT_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={abLoading}
              onClick={handleRunAbCompare}
              className="studio-focus w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-50"
            >
              {abLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>تولید مقایسه</span>
            </button>
          </div>
        </div>
        {(abAudioA || abAudioB) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {abAudioA && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                <div className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  نمونه A: {abVoiceA}
                </div>
                <audio controls src={abAudioA} className="w-full h-9" />
              </div>
            )}
            {abAudioB && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                <div className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  نمونه B: {abVoiceB}
                </div>
                <audio controls src={abAudioB} className="w-full h-9" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* 20 Persian Display Personas */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            پروفایل‌های نمایشی فارسی (۲۰ الگو متصل به صداهای واقعی API)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs ${
                onlyFavorites
                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>پسندیده‌ها ({favorites.length})</span>
            </button>
          </div>
        </div>

        {/* Quality filter segmented controls */}
        <div className="flex flex-wrap gap-1.5">
          {QUALITY_FILTERS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setFilterQuality(q)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterQuality === q
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPersonas.map((persona) => {
            const isSelected = controls.personaId === persona.id;
            const isFav = favorites.includes(persona.id);
            return (
              <div
                key={persona.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/40 dark:bg-teal-950/20 dark:border-teal-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {persona.displayNameFa}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(persona.id)}
                      aria-label={`افزودن ${persona.displayNameFa} به علاقه‌مندی‌ها`}
                      className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        isFav ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      <Heart className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {persona.roleSummaryFa}
                  </p>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    <span>صدای واقعی: </span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {persona.mappedVoiceId}
                    </span>
                    <span className="mx-1">·</span>
                    <span>{persona.qualities.join(' / ')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={playingVoice === persona.id}
                    onClick={() =>
                      handlePlayRealPreview(
                        persona.mappedVoiceId,
                        persona.styleDirectionEn,
                        persona.id
                      )
                    }
                    className="studio-focus p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    title="پخش نمونه"
                  >
                    {playingVoice === persona.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPersona(persona)}
                    className={`studio-focus flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      isSelected
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{isSelected ? 'انتخاب‌شده' : 'انتخاب گوینده'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
