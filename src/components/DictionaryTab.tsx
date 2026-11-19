import React, { useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Volume2,
} from 'lucide-react';
import { requestVoicePreview } from '../services/api';
import type { DictionaryCategory, DictionaryEntry, RealVoiceId } from '../types/studio';
import { applyPronunciationDictionary } from '../utils/persianText';

interface DictionaryTabProps {
  entries: DictionaryEntry[];
  onSaveEntries: (next: DictionaryEntry[]) => Promise<void>;
  activeVoiceId: RealVoiceId;
}

const CATEGORIES: DictionaryCategory[] = [
  'هواشناسی و اقلیم',
  'نام‌های خاص ایرانی',
  'شهرها و روستاها',
  'واژگان خارجی',
  'مخفف‌ها',
  'تاریخ و اعداد',
  'واحدهای علمی',
];

export const DictionaryTab: React.FC<DictionaryTabProps> = ({
  entries,
  onSaveEntries,
  activeVoiceId,
}) => {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('همه');
  const [newOriginal, setNewOriginal] = useState('');
  const [newSpoken, setNewSpoken] = useState('');
  const [newHint, setNewHint] = useState('');
  const [newCategory, setNewCategory] = useState<DictionaryCategory>('هواشناسی و اقلیم');
  const [newAcronymMode, setNewAcronymMode] = useState<DictionaryEntry['acronymMode']>('as-is');
  const [newScope, setNewScope] = useState<DictionaryEntry['scope']>('global');
  const [newPriority, setNewPriority] = useState(8);
  const [testPhrase, setTestPhrase] = useState(
    'بر اساس مدل ECMWF و GFS، فشار تراز دریا 1012 hPa و ناهنجاری بارش در شرایط La Niña بررسی شد.'
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (catFilter !== 'همه' && e.category !== catFilter) return false;
      if (
        q &&
        !e.original.toLowerCase().includes(q) &&
        !e.spokenForm.toLowerCase().includes(q) &&
        !(e.phoneticHint || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [entries, search, catFilter]);

  const previewApplied = useMemo(
    () => applyPronunciationDictionary(testPhrase, entries),
    [testPhrase, entries]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOriginal.trim() || !newSpoken.trim()) return;
    setSaving(true);
    setErrorFa(null);
    try {
      const next: DictionaryEntry[] = [
        {
          id: `dict-${Date.now()}`,
          original: newOriginal.trim(),
          spokenForm: newSpoken.trim(),
          phoneticHint: newHint.trim() || undefined,
          category: newCategory,
          priority: newPriority,
          acronymMode: newAcronymMode,
          scope: newScope,
          enabled: true,
        },
        ...entries,
      ];
      await onSaveEntries(next);
      setNewOriginal('');
      setNewSpoken('');
      setNewHint('');
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ذخیره واژه‌نامه.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEntry = async (id: string) => {
    const next = entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e));
    await onSaveEntries(next);
  };

  const deleteEntry = async (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    await onSaveEntries(next);
  };

  const changeAcronymMode = async (id: string, mode: DictionaryEntry['acronymMode']) => {
    const next = entries.map((e) => (e.id === id ? { ...e, acronymMode: mode } : e));
    await onSaveEntries(next);
  };

  const handleTestEntryAudio = async (entry: DictionaryEntry) => {
    setTestingId(entry.id);
    setErrorFa(null);
    try {
      const text =
        entry.acronymMode === 'as-is' && entry.spokenForm === entry.original
          ? entry.original
          : entry.spokenForm;
      const res = await requestVoicePreview({
        voiceId: activeVoiceId,
        sampleText: `تلفظ آزمایشی: ${text}`,
      });
      const audio = new Audio(res.audioUrl);
      await audio.play();
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در پخش آزمایشی واژه.');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Add New Rule Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3"
      >
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          افزودن قاعده جدید به واژه‌نامه تلفظ
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <input
            type="text"
            value={newOriginal}
            onChange={(e) => setNewOriginal(e.target.value)}
            placeholder="نوشتار اصلی (مثلاً ECMWF)"
            required
            className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={newSpoken}
            onChange={(e) => setNewSpoken(e.target.value)}
            placeholder="شکل گفتاری (مثلاً ای‌سی‌ام‌دبلیو‌اف)"
            required
            className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
            placeholder="راهنمای آوایی (اختیاری)"
            className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as DictionaryCategory)}
            className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={newAcronymMode}
            onChange={(e) => setNewAcronymMode(e.target.value as DictionaryEntry['acronymMode'])}
            className="studio-focus rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
          >
            <option value="as-is">جایگزینی مستقیم</option>
            <option value="spell-out">تلفظ حرف‌به‌حرف مخفف</option>
            <option value="expand">بسط کامل به فارسی</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="studio-focus inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن قاعده</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>دامنه:</span>
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as 'global' | 'project')}
              className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
            >
              <option value="global">سراسری</option>
              <option value="project">پروژه فعلی</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>اولویت (۱ تا ۱۰):</span>
            <input
              type="number"
              min={1}
              max={10}
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value) || 5)}
              className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
        </div>
      </form>

      {errorFa && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
          {errorFa}
        </div>
      )}

      {/* Live Dictionary Substitution Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2.5">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          آزمایش زنده اعمال واژه‌نامه (جمله نمونه):
        </div>
        <input
          type="text"
          value={testPhrase}
          onChange={(e) => setTestPhrase(e.target.value)}
          className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
        />
        <div className="rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-3 text-xs leading-7 text-teal-800 dark:text-teal-300">
          {previewApplied.speechReadyText}
        </div>
      </div>

      {/* Filter & Entries Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در واژه‌ها و اصطلاحات..."
              className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-8 pl-3 py-1.5 text-xs"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="studio-focus rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
          >
            <option value="همه">همه دسته‌ها ({entries.length})</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2 font-medium">فعال</th>
                <th className="py-2.5 px-2 font-medium">نوشتار اصلی</th>
                <th className="py-2.5 px-2 font-medium">شکل گفتاری</th>
                <th className="py-2.5 px-2 font-medium">دسته</th>
                <th className="py-2.5 px-2 font-medium">نحوه مخفف</th>
                <th className="py-2.5 px-2 font-medium">اولویت</th>
                <th className="py-2.5 px-2 font-medium">آزمایش / حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                  <td className="py-2.5 px-2">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={() => toggleEntry(entry.id)}
                      className="accent-teal-700"
                    />
                  </td>
                  <td className="py-2.5 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {entry.original}
                  </td>
                  <td className="py-2.5 px-2 text-slate-800 dark:text-slate-200">
                    <div>{entry.spokenForm}</div>
                    {entry.phoneticHint && (
                      <div className="text-[11px] text-slate-400">{entry.phoneticHint}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{entry.category}</td>
                  <td className="py-2.5 px-2">
                    <select
                      value={entry.acronymMode}
                      onChange={(e) =>
                        changeAcronymMode(
                          entry.id,
                          e.target.value as DictionaryEntry['acronymMode']
                        )
                      }
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                    >
                      <option value="as-is">مستقیم</option>
                      <option value="spell-out">هجایی</option>
                      <option value="expand">بسط کامل</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {entry.priority}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={testingId === entry.id}
                        onClick={() => handleTestEntryAudio(entry)}
                        title="تست تلفظ با گوینده فعلی"
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {testingId === entry.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry.id)}
                        title="حذف"
                        className="p-1.5 rounded text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
