import React, { useState } from 'react';
import {
  Info,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { REAL_PREBUILT_VOICES, VOICE_PERSONAS } from '../data/catalog';
import { generateMultiSpeakerSpeech, generateSpeech } from '../services/api';
import type {
  AudioArtifact,
  DialogueTurn,
  RealVoiceId,
  SpeechControlsConfig,
} from '../types/studio';
import { WaveformPlayer } from './WaveformPlayer';

interface VoiceDesignTabProps {
  controls: SpeechControlsConfig;
  activeArtifact: AudioArtifact | null;
  onArtifactReady: (artifact: AudioArtifact) => void;
  onOpenExport: () => void;
}

const INITIAL_TURNS: DialogueTurn[] = [
  {
    id: 'turn-1',
    speakerLabel: 'مهسا',
    voiceId: 'Puck',
    personaId: 'mahsa',
    stylePrompt: 'Warm, engaging Iranian Persian podcast host',
    text: 'سلام به شنوندگان عزیز! <breath> امروز می‌خواهیم درباره پیش‌بینی بارش‌های پاییزی و مدل‌های ECMWF صحبت کنیم.',
    pauseAfterMs: 280,
  },
  {
    id: 'turn-2',
    speakerLabel: 'شایان',
    voiceId: 'Charon',
    personaId: 'shayan',
    stylePrompt: 'Calm, authoritative meteorology expert in Iranian Persian',
    text: 'سلام مهسا جان، |yeah| خروجی‌های جدید نشان می‌دهد ناوه‌ی تراز ۵۰۰ هکتوپاسکال از نیمه هفته تقویت می‌شود.',
    pauseAfterMs: 320,
  },
];

export const VoiceDesignTab: React.FC<VoiceDesignTabProps> = ({
  controls,
  activeArtifact,
  onArtifactReady,
  onOpenExport,
}) => {
  const [title, setTitle] = useState('پادکست گفتگوی هواشناسی');
  const [turns, setTurns] = useState<DialogueTurn[]>(INITIAL_TURNS);
  const [mode, setMode] = useState<'auto' | 'native' | 'segmented'>('auto');
  const [normalizeLoudness, setNormalizeLoudness] = useState(true);
  const [loadingMulti, setLoadingMulti] = useState(false);

  // Voice Design Single-speaker custom prompt tester
  const [designVoiceId, setDesignVoiceId] = useState<RealVoiceId>('Zephyr');
  const [designStylePrompt, setDesignStylePrompt] = useState(
    'Calm, poetic Iranian Persian narrator with warm chest resonance and unhurried pauses.'
  );
  const [designText, setDesignText] = useState(
    'در سکوت کوهستان، صدای باد بر فراز دشت‌های فارس می‌پیچد و نوید باران پاییزی را می‌آورد.'
  );
  const [loadingDesign, setLoadingDesign] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [noticeFa, setNoticeFa] = useState<string | null>(null);

  const uniqueSpeakersCount = new Set(turns.map((t) => t.speakerLabel.trim()).filter(Boolean)).size;

  const addTurn = () => {
    const idx = turns.length + 1;
    const prev = turns[turns.length - 1];
    const nextVoice: RealVoiceId = prev?.voiceId === 'Puck' ? 'Charon' : 'Puck';
    setTurns((t) => [
      ...t,
      {
        id: `turn-${Date.now()}-${idx}`,
        speakerLabel: nextVoice === 'Puck' ? 'مهسا' : 'شایان',
        voiceId: nextVoice,
        personaId: nextVoice === 'Puck' ? 'mahsa' : 'shayan',
        stylePrompt: 'Natural Iranian Persian conversation',
        text: '',
        pauseAfterMs: 300,
      },
    ]);
  };

  const updateTurn = (id: string, patch: Partial<DialogueTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns((prev) => prev.filter((t) => t.id !== id));
  };

  const insertMarker = (id: string, marker: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: `${t.text} ${marker}`.trim() } : t))
    );
  };

  const handleGenerateMulti = async () => {
    setLoadingMulti(true);
    setErrorFa(null);
    setNoticeFa(null);
    try {
      const res = await generateMultiSpeakerSpeech({
        title,
        turns,
        mode,
        normalizeLoudness,
      });
      onArtifactReady(res.artifact);
      setNoticeFa(
        res.synthesisModeUsed === 'native-dual'
          ? 'دیالوگ دوگوینده با مدل بومی gemini-3.8-flash-tts تولید شد.'
          : 'دیالوگ به صورت نوبت‌به‌نوبت تولید و با FFmpeg مونتاژ شد.'
      );
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در تولید گفتگوی چندگوینده.');
    } finally {
      setLoadingMulti(false);
    }
  };

  const handleTestVoiceDesign = async () => {
    if (!designText.trim()) return;
    setLoadingDesign(true);
    setErrorFa(null);
    setNoticeFa(null);
    try {
      const res = await generateSpeech({
        title: 'آزمایش طراحی لحن صدا',
        text: designText,
        controls: {
          ...controls,
          modelId: 'gemini-3.8-flash-tts',
          autoModel: true,
          voiceId: designVoiceId,
          customStylePrompt: designStylePrompt,
        },
        applyDictionary: true,
      });
      onArtifactReady(res.artifact);
      setNoticeFa('نمونه طراحی لحن با مدل پرچم‌دار gemini-3.8-flash-tts تولید شد.');
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در آزمایش طراحی صدا.');
    } finally {
      setLoadingDesign(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Multi-Speaker Podcast / Interview Studio */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              استودیوی دیالوگ، مصاحبه و پادکست چندگوینده
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'auto' | 'native' | 'segmented')}
              className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            >
              <option value="auto">خودکار (بومی برای ۲ گوینده / مونتاژ برای بیشتر)</option>
              <option value="native">بومی دوگوینده (gemini-3.8-flash-tts)</option>
              <option value="segmented">تولید مجزای هر نوبت + مونتاژ FFmpeg</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={normalizeLoudness}
                onChange={(e) => setNormalizeLoudness(e.target.checked)}
                className="accent-teal-700"
              />
              <span>یکسان‌سازی بلندی صدا</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            تعداد گویندگان مجزا: <strong className="font-mono text-slate-800 dark:text-slate-200">{uniqueSpeakersCount}</strong>
            {uniqueSpeakersCount !== 2 && ' · حالت بومی gemini-3.8-flash-tts دقیقاً برای ۲ گوینده کار می‌کند و در غیر این صورت مونتاژ منظم FFmpeg اجرا می‌شود.'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            عنوان برنامه یا پادکست
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="studio-focus w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
          />
        </div>

        <div className="space-y-3">
          {turns.map((turn, idx) => (
            <div
              key={turn.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={turn.speakerLabel}
                    onChange={(e) => updateTurn(turn.id, { speakerLabel: e.target.value })}
                    placeholder="نام گوینده"
                    className="studio-focus w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold"
                  />
                  <select
                    value={turn.voiceId}
                    onChange={(e) =>
                      updateTurn(turn.id, { voiceId: e.target.value as RealVoiceId })
                    }
                    className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono"
                  >
                    {REAL_PREBUILT_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.id}</option>
                    ))}
                  </select>
                  <select
                    value={turn.personaId}
                    onChange={(e) => {
                      const p = VOICE_PERSONAS.find((x) => x.id === e.target.value);
                      if (!p) return;
                      updateTurn(turn.id, {
                        personaId: p.id,
                        speakerLabel: p.displayNameFa,
                        voiceId: p.mappedVoiceId,
                        stylePrompt: p.styleDirectionEn,
                      });
                    }}
                    className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                  >
                    {VOICE_PERSONAS.map((p) => (
                      <option key={p.id} value={p.id}>پرسونا: {p.displayNameFa}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500">مکث بعد (ms):</label>
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    step={50}
                    value={turn.pauseAfterMs}
                    onChange={(e) =>
                      updateTurn(turn.id, { pauseAfterMs: Number(e.target.value) || 0 })
                    }
                    className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={turns.length <= 1}
                    onClick={() => removeTurn(turn.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 disabled:opacity-30"
                    title="حذف نوبت"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={turn.stylePrompt}
                onChange={(e) => updateTurn(turn.id, { stylePrompt: e.target.value })}
                placeholder="دستور لحن این نوبت (انگلیسی برای دقت بالاتر مدل)"
                className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300"
              />

              <textarea
                rows={2}
                value={turn.text}
                onChange={(e) => updateTurn(turn.id, { text: e.target.value })}
                placeholder="متن گفتار این گوینده..."
                className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-sm leading-7 text-slate-900 dark:text-slate-100"
              />

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">افزودن نشانگرهای واکنش صوتی (gemini-3.8-flash-tts):</span>
                {['<breath>', '<laugh>', '<gasp>', '|yeah|', '|mhm|'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertMarker(turn.id, tag)}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300 hover:border-teal-500"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={addTurn}
            className="studio-focus inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن نوبت گفتگو</span>
          </button>

          <button
            type="button"
            disabled={loadingMulti}
            onClick={handleGenerateMulti}
            className="studio-focus inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-50"
          >
            {loadingMulti ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>تولید گفتگوی چندگوینده</span>
          </button>
        </div>
      </section>

      {/* Voice Design Prompt Workbench */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            طراحی لحن و کارگردانی صدا (Voice Design با gemini-3.8-flash-tts)
          </h2>
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
          <span>
            توضیح توصیفی لحن، سبک و شخصیت اجرا را روی یکی از صداهای پایه آزمایش کنید. توجه: توصیف متنی لحن، شناسه صوتی پایدار یا کلون اختصاصی جدید ایجاد نمی‌کند و در این محیط قابلیت ایجاد صدای اختصاصی با شناسه دائمی در دسترس نیست.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              صدای پایه واقعی
            </label>
            <select
              value={designVoiceId}
              onChange={(e) => setDesignVoiceId(e.target.value as RealVoiceId)}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono"
            >
              {REAL_PREBUILT_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-9">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              دستور کارگردانی صدا (Style / Voice Design Prompt)
            </label>
            <input
              type="text"
              value={designStylePrompt}
              onChange={(e) => setDesignStylePrompt(e.target.value)}
              dir="ltr"
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
            />
          </div>
        </div>

        <textarea
          rows={3}
          value={designText}
          onChange={(e) => setDesignText(e.target.value)}
          className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0B0F17] p-3 text-sm leading-7"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={loadingDesign}
            onClick={handleTestVoiceDesign}
            className="studio-focus inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
          >
            {loadingDesign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>آزمایش طراحی لحن</span>
          </button>
        </div>
      </section>

      {activeArtifact && (
        <WaveformPlayer artifact={activeArtifact} onOpenExport={onOpenExport} />
      )}
    </div>
  );
};
