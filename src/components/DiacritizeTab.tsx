import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  Eraser,
  GitCompare,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { requestDiacritize } from '../services/api';
import type { DiacritizeDiffItem, StudioTab } from '../types/studio';
import { stripPersianDiacritics } from '../utils/persianText';

interface DiacritizeTabProps {
  originalText: string;
  approvedText: string;
  onApproveDiacritized: (nextApproved: string) => void;
  onNavigateTab: (tab: StudioTab) => void;
}

export const DiacritizeTab: React.FC<DiacritizeTabProps> = ({
  originalText,
  approvedText,
  onApproveDiacritized,
  onNavigateTab,
}) => {
  const [sourceText, setSourceText] = useState(approvedText);
  const [domainHint, setDomainHint] = useState('هواشناسی، علمی و خبر رسمی فارسی');
  const [selectedSlice, setSelectedSlice] = useState('');
  const [items, setItems] = useState<DiacritizeDiffItem[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(true);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [noticeFa, setNoticeFa] = useState<string | null>(null);

  // Sync if approvedText changed externally and we have no pending diff session
  React.useEffect(() => {
    if (items.length === 0) {
      setSourceText(approvedText);
    }
  }, [approvedText, items.length]);

  const changedItems = useMemo(() => items.filter((i) => i.changed), [items]);

  const assembledResult = useMemo(() => {
    if (items.length === 0) return sourceText;
    return items
      .map((i) => {
        if (i.status === 'rejected') return i.original;
        return i.finalText;
      })
      .join(' ');
  }, [items, sourceText]);

  const runDiacritize = async (onlySelection = false) => {
    const target = onlySelection && selectedSlice.trim() ? selectedSlice.trim() : sourceText.trim();
    if (!target) {
      setErrorFa('متنی برای اعراب‌گذاری وجود ندارد.');
      return;
    }
    setLoading(true);
    setErrorFa(null);
    setNoticeFa(null);
    try {
      const res = await requestDiacritize(target, domainHint);
      setItems(res.items);
      setModelUsed(res.modelUsed);
      setNoticeFa(
        `پردازش با ${res.modelUsed} انجام شد: ${res.items.filter((x) => x.changed).length} مورد برای بازبینی پیشنهاد شده است.`
      );
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در اعراب‌گذاری هوشمند.');
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = (id: string, status: DiacritizeDiffItem['status'], customText?: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (status === 'rejected') {
          return { ...item, status: 'rejected', finalText: item.original };
        }
        if (status === 'edited' && typeof customText === 'string') {
          return { ...item, status: 'edited', finalText: customText };
        }
        return { ...item, status: 'accepted', finalText: item.suggested };
      })
    );
  };

  const acceptAllPending = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.status === 'pending' ? { ...i, status: 'accepted', finalText: i.suggested } : i
      )
    );
  };

  const handleConfirmChanges = () => {
    const finalOutput =
      selectedSlice.trim() && items.length > 0 && sourceText.includes(selectedSlice.trim())
        ? sourceText.replace(selectedSlice.trim(), assembledResult)
        : assembledResult;
    onApproveDiacritized(finalOutput);
    setSourceText(finalOutput);
    setNoticeFa('تغییرات اعراب‌گذاری در «متن تاییدشده برای گفتار» ذخیره شد.');
  };

  const handleRevertOriginal = () => {
    setItems([]);
    setSourceText(originalText);
    onApproveDiacritized(originalText);
    setNoticeFa('متن به نسخه اصلی بازگردانده شد.');
  };

  const handleStripDiacritics = () => {
    const stripped = stripPersianDiacritics(sourceText);
    setItems([]);
    setSourceText(stripped);
    onApproveDiacritized(stripped);
    setNoticeFa('تمام اعراب‌های متن حذف شدند.');
  };

  return (
    <div className="space-y-5">
      {/* Action Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => runDiacritize(false)}
              className="studio-focus inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>اعراب‌گذاری</span>
            </button>

            <button
              type="button"
              disabled={loading || !selectedSlice.trim()}
              onClick={() => runDiacritize(true)}
              title="بخشی از متن داخل کادر را با ماوس انتخاب کنید"
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
            >
              <span>اصلاح تلفظ بخش انتخاب‌شده</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCompare((v) => !v)}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>مقایسه نسخه‌ها</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmChanges}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>تأیید تغییرات</span>
            </button>

            <button
              type="button"
              onClick={handleRevertOriginal}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازگشت به متن اصلی</span>
            </button>

            <button
              type="button"
              onClick={handleStripDiacritics}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>حذف اعراب</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleConfirmChanges();
                onNavigateTab('studio');
              }}
              className="studio-focus inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>تبدیل به گفتار</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="text-slate-600 dark:text-slate-400 shrink-0">زمینه تخصصی متن:</label>
          <input
            type="text"
            value={domainHint}
            onChange={(e) => setDomainHint(e.target.value)}
            className="studio-focus flex-1 min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
          {modelUsed && (
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              مدل: {modelUsed}
            </span>
          )}
        </div>
      </div>

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

      {/* Side-by-side comparison */}
      <div className={`grid grid-cols-1 ${showCompare ? 'lg:grid-cols-2' : ''} gap-5`}>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>متن ورودی (برای انتخاب بخشی، متن را هایلایت کنید)</span>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onSelect={(e) => {
              const target = e.currentTarget;
              const slice = target.value.slice(target.selectionStart, target.selectionEnd);
              setSelectedSlice(slice);
            }}
            rows={10}
            dir="rtl"
            className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] p-3.5 text-[15px] leading-8 text-slate-900 dark:text-slate-100"
          />
        </div>

        {showCompare && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>پیش‌نمایش نسخه نهایی با اعراب تاییدشده</span>
              {changedItems.length > 0 && (
                <button
                  type="button"
                  onClick={acceptAllPending}
                  className="text-teal-700 dark:text-teal-400 hover:underline"
                >
                  پذیرش همه موارد منتظر ({changedItems.filter((c) => c.status === 'pending').length})
                </button>
              )}
            </div>
            <div
              dir="rtl"
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] p-3.5 min-h-[258px] text-[15px] leading-8 text-slate-900 dark:text-slate-100 whitespace-pre-wrap"
            >
              {assembledResult}
            </div>
          </div>
        )}
      </div>

      {/* Per-change Review List */}
      {changedItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              بررسی مورد به مورد تغییرات اعراب ({changedItems.length} واژه)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              موارد ویرایش‌شده یا ردشده به صورت دستی حفظ می‌شوند.
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {changedItems.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 line-through text-sm">
                    {item.original}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">←</span>
                  <input
                    type="text"
                    value={item.finalText}
                    onChange={(e) => updateItemStatus(item.id, 'edited', e.target.value)}
                    className="studio-focus rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-sm font-semibold text-teal-800 dark:text-teal-300 w-36"
                  />
                  <span className="text-slate-600 dark:text-slate-400">{item.reasonFa}</span>
                  <span className="text-[11px] text-slate-400">
                    · اطمینان:{' '}
                    {item.confidence === 'high'
                      ? 'بالا'
                      : item.confidence === 'medium'
                      ? 'متوسط'
                      : 'نیازمند بررسی'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateItemStatus(item.id, 'accepted')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
                      item.status === 'accepted' || item.status === 'edited'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تأیید</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItemStatus(item.id, 'rejected')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
                      item.status === 'rejected'
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>رد</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
