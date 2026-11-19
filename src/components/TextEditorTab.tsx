import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileUp,
  ListTree,
  Loader2,
  Redo2,
  Replace,
  Search,
  Sparkles,
  Undo2,
  Wand2,
} from 'lucide-react';
import { requestPauseSuggestions, uploadDocumentFile } from '../services/api';
import type { DictionaryEntry, PauseSuggestion, StudioTab } from '../types/studio';
import {
  applyPronunciationDictionary,
  countWordsAndChars,
  estimateSpeakingDurationSec,
  formatTimecode,
  normalizePersianText,
  segmentParagraphsAndSentences,
} from '../utils/persianText';

interface TextEditorTabProps {
  originalText: string;
  processedText: string;
  approvedText: string;
  onUpdateTexts: (patch: {
    originalText?: string;
    processedText?: string;
    approvedText?: string;
  }) => void;
  dictionary: DictionaryEntry[];
  onNavigateTab: (tab: StudioTab) => void;
}

export const TextEditorTab: React.FC<TextEditorTabProps> = ({
  originalText,
  processedText,
  approvedText,
  onUpdateTexts,
  dictionary,
  onNavigateTab,
}) => {
  const [activeLayer, setActiveLayer] = useState<'original' | 'processed' | 'approved' | 'speech'>('approved');
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [normArabic, setNormArabic] = useState(true);
  const [normZwnj, setNormZwnj] = useState(true);
  const [normPunct, setNormPunct] = useState(true);
  const [normSpace, setNormSpace] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [pauseSuggestions, setPauseSuggestions] = useState<PauseSuggestion[]>([]);
  const [loadingPauses, setLoadingPauses] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentLayerText =
    activeLayer === 'original'
      ? originalText
      : activeLayer === 'processed'
      ? processedText
      : approvedText;

  const speechReady = useMemo(
    () => applyPronunciationDictionary(approvedText, dictionary).speechReadyText,
    [approvedText, dictionary]
  );

  const stats = useMemo(() => countWordsAndChars(approvedText), [approvedText]);
  const estSec = useMemo(() => estimateSpeakingDurationSec(approvedText, 1.0), [approvedText]);
  const segments = useMemo(() => segmentParagraphsAndSentences(approvedText), [approvedText]);

  const matchCount = useMemo(() => {
    if (!searchTerm) return 0;
    return currentLayerText.split(searchTerm).length - 1;
  }, [currentLayerText, searchTerm]);

  const editCurrentLayer = (nextText: string) => {
    setHistoryStack((prev) => [...prev.slice(-24), currentLayerText]);
    setRedoStack([]);
    if (activeLayer === 'original') {
      onUpdateTexts({ originalText: nextText });
    } else if (activeLayer === 'processed') {
      onUpdateTexts({ processedText: nextText });
    } else {
      onUpdateTexts({ approvedText: nextText });
    }
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, currentLayerText]);
    if (activeLayer === 'original') onUpdateTexts({ originalText: prev });
    else if (activeLayer === 'processed') onUpdateTexts({ processedText: prev });
    else onUpdateTexts({ approvedText: prev });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistoryStack((s) => [...s, currentLayerText]);
    if (activeLayer === 'original') onUpdateTexts({ originalText: next });
    else if (activeLayer === 'processed') onUpdateTexts({ processedText: next });
    else onUpdateTexts({ approvedText: next });
  };

  const handleReplaceAll = () => {
    if (!searchTerm) return;
    const replaced = currentLayerText.split(searchTerm).join(replaceTerm);
    editCurrentLayer(replaced);
  };

  const handleNormalizeToProcessed = () => {
    const source = originalText || approvedText;
    const normalized = normalizePersianText(source, {
      normalizeArabicChars: normArabic,
      normalizeZwnj: normZwnj,
      fixPunctuationSpacing: normPunct,
      normalizeWhitespace: normSpace,
    });
    onUpdateTexts({ processedText: normalized });
    setActiveLayer('processed');
  };

  const handleApproveProcessed = () => {
    onUpdateTexts({ approvedText: processedText });
    setActiveLayer('approved');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      const res = await uploadDocumentFile(file);
      setImportWarnings(res.warningsFa || []);
      if (res.text) {
        onUpdateTexts({
          originalText: res.text,
          processedText: res.text,
          approvedText: res.text,
        });
        setActiveLayer('original');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'خطا در وارد کردن فایل.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleAnalyzePauses = async () => {
    if (!approvedText.trim()) return;
    setLoadingPauses(true);
    setImportError(null);
    try {
      const res = await requestPauseSuggestions(approvedText);
      setPauseSuggestions(res.suggestions);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'خطا در تحلیل مکث‌ها.');
    } finally {
      setLoadingPauses(false);
    }
  };

  const applyPauseSuggestion = (id: string) => {
    const item = pauseSuggestions.find((s) => s.id === id);
    if (!item || item.applied) return;
    if (!approvedText.includes(item.targetPhrase)) return;
    const next = approvedText.replace(item.targetPhrase, item.suggestedText);
    onUpdateTexts({ approvedText: next });
    setPauseSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, applied: true } : s))
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          {[
            { id: 'original', label: 'متن اصلی' },
            { id: 'processed', label: 'پردازش‌شده (نرمال)' },
            { id: 'approved', label: 'تاییدشده برای گفتار' },
            { id: 'speech', label: 'متن آماده گفتار (با واژه‌نامه)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLayer(tab.id as typeof activeLayer)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeLayer === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt,.docx,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="studio-focus inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            <span>وارد کردن فایل (TXT/MD/DOCX/PDF/SRT)</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStack.length === 0 || activeLayer === 'speech'}
            title="بازگشت (Undo)"
            className="studio-focus p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0 || activeLayer === 'speech'}
            title="تکرار (Redo)"
            className="studio-focus p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {importError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
          {importError}
        </div>
      )}

      {importWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1 text-xs text-amber-800 dark:text-amber-300">
          {importWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Editor Area */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          {/* Search & Replace Bar */}
          {activeLayer !== 'speech' && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجو در این لایه..."
                  className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-8 pl-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="جایگزینی با..."
                  className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!searchTerm || matchCount === 0}
                  onClick={handleReplaceAll}
                  className="studio-focus inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium disabled:opacity-40 whitespace-nowrap"
                >
                  <Replace className="w-3.5 h-3.5" />
                  <span>جایگزینی ({matchCount})</span>
                </button>
              </div>
            </div>
          )}

          {activeLayer === 'speech' ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] p-4 min-h-[320px] text-[15px] leading-8 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {speechReady || 'متن تاییدشده‌ای وجود ندارد.'}
            </div>
          ) : (
            <textarea
              value={currentLayerText}
              onChange={(e) => editCurrentLayer(e.target.value)}
              rows={14}
              dir="rtl"
              placeholder="متن این لایه..."
              className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] p-4 text-[15px] leading-8 text-slate-900 dark:text-slate-100 resize-y"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-2 tabular-nums">
              <span>{stats.wordCount} واژه</span>
              <span aria-hidden="true">·</span>
              <span>{stats.charCount} نویسه</span>
              <span aria-hidden="true">·</span>
              <span>{stats.paragraphCount} بند</span>
              <span aria-hidden="true">·</span>
              <span>{stats.sentenceCount} جمله</span>
              <span aria-hidden="true">·</span>
              <span>برآورد زمان: {formatTimecode(estSec)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSegments((v) => !v)}
                className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400"
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>{showSegments ? 'پنهان کردن تفکیک جملات' : 'تفکیک بند و جمله'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('studio')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>ارسال به استودیو</span>
              </button>
            </div>
          </div>

          {showSegments && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                جملات شناسایی‌شده ({segments.sentences.length} جمله):
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {segments.sentences.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800"
                  >
                    <span className="font-mono tabular-nums text-slate-400 shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Normalization & Breath/Pause Suggestions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              یکسان‌سازی و نرمال‌سازی فارسی
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              تغییرات فقط در لایه «پردازش‌شده» ذخیره می‌شوند تا متن اصلی شما دست‌نخورده بماند.
            </p>
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normArabic} onChange={(e) => setNormArabic(e.target.checked)} className="accent-teal-700" />
                <span>تبدیل حروف عربی (ي/ك/ة) به معادل فارسی</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normZwnj} onChange={(e) => setNormZwnj(e.target.checked)} className="accent-teal-700" />
                <span>اصلاح نیم‌فاصله‌های تکراری و زائد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normPunct} onChange={(e) => setNormPunct(e.target.checked)} className="accent-teal-700" />
                <span>فاصله‌گذاری استاندارد علائم سجاوندی</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normSpace} onChange={(e) => setNormSpace(e.target.checked)} className="accent-teal-700" />
                <span>حذف فاصله‌ها و خطوط خالی اضافی</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleNormalizeToProcessed}
                className="studio-focus flex-1 px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                اعمال به لایه پردازش‌شده
              </button>
              <button
                type="button"
                onClick={handleApproveProcessed}
                className="studio-focus px-3 py-2 rounded-lg border border-teal-600 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40"
              >
                تایید برای گفتار
              </button>
            </div>
          </div>

          {/* Optional Narration Pause Suggestions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                پیشنهاد سجاوندی و مکث نفس‌گیری
              </h3>
              <button
                type="button"
                disabled={loadingPauses || !approvedText.trim()}
                onClick={handleAnalyzePauses}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 disabled:opacity-50"
              >
                {loadingPauses ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>تحلیل</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              پیشنهادها هرگز خودکار روی متن اعمال نمی‌شوند؛ تنها با تایید شما جایگزین می‌شوند.
            </p>
            {pauseSuggestions.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pauseSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="text-slate-500 dark:text-slate-400 line-through">
                      {s.targetPhrase}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {s.suggestedText}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">{s.reasonFa}</span>
                      <button
                        type="button"
                        disabled={s.applied}
                        onClick={() => applyPauseSuggestion(s.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-700 text-white text-[11px] disabled:opacity-45"
                      >
                        <Check className="w-3 h-3" />
                        <span>{s.applied ? 'اعمال شد' : 'اعمال'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
