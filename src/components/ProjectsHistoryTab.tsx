import React, { useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Copy,
  Download,
  FolderPlus,
  Play,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  HistoryItem,
  SpeechControlsConfig,
  StudioProject,
  VoiceTemplate,
} from '../types/studio';
import { formatTimecode } from '../utils/persianText';

interface ProjectsHistoryTabProps {
  projects: StudioProject[];
  activeProjectId: string;
  onSelectProject: (project: StudioProject) => void;
  onSaveProject: (project: StudioProject) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  templates: VoiceTemplate[];
  onApplyTemplate: (tpl: VoiceTemplate) => void;
  onSaveCurrentAsTemplate: (nameFa: string, descriptionFa: string) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  history: HistoryItem[];
  onPlayAudioId: (audioId: string) => void;
  currentControls: SpeechControlsConfig;
}

export const ProjectsHistoryTab: React.FC<ProjectsHistoryTabProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onSaveProject,
  onDeleteProject,
  templates,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
  onDeleteTemplate,
  history,
  onPlayAudioId,
  currentControls,
}) => {
  const [search, setSearch] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [issueWord, setIssueWord] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issueSavedNotice, setIssueSavedNotice] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (onlyFav && !p.favorite) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.approvedText.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [projects, search, onlyFav]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    const now = new Date().toISOString();
    const created: StudioProject = {
      id: `proj-${Date.now()}`,
      title: newProjName.trim(),
      originalText: '',
      processedText: '',
      approvedText: '',
      speechReadyText: '',
      controls: currentControls,
      targetDurationSec: null,
      favorite: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await onSaveProject(created);
    onSelectProject(created);
    setNewProjName('');
  };

  const handleDuplicate = async (p: StudioProject) => {
    const now = new Date().toISOString();
    await onSaveProject({
      ...p,
      id: `proj-${Date.now()}`,
      title: `${p.title} (رونوشت)`,
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      projects,
      templates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ava-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt) as { projects?: StudioProject[] };
      if (Array.isArray(parsed.projects)) {
        for (const p of parsed.projects) {
          if (p.id && p.title) await onSaveProject(p);
        }
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    await onSaveCurrentAsTemplate(tplName.trim(), tplDesc.trim());
    setTplName('');
    setTplDesc('');
  };

  const handleReportPronunciationIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueWord.trim()) return;
    const existing = JSON.parse(localStorage.getItem('ava_pronunciation_issues') || '[]');
    existing.unshift({
      word: issueWord.trim(),
      note: issueNote.trim(),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('ava_pronunciation_issues', JSON.stringify(existing.slice(0, 50)));
    setIssueWord('');
    setIssueNote('');
    setIssueSavedNotice(true);
    setTimeout(() => setIssueSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Projects Section */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            پروژه‌های ذخیره‌شده در سرور ({projects.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              <span>پشتیبان JSON</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>بازیابی JSON</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <form onSubmit={handleCreateProject} className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="نام پروژه جدید..."
              className="studio-focus flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>ایجاد</span>
            </button>
          </form>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی پروژه..."
              className="studio-focus w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-8 pl-3 py-1.5 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyFav((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs ${
              onlyFav
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>برگزیده‌ها</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className={`py-3 flex flex-wrap items-center justify-between gap-3 ${
                p.id === activeProjectId ? 'bg-teal-50/30 dark:bg-teal-950/15 -mx-2 px-2 rounded-lg' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectProject(p)}
                    className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 truncate"
                  >
                    {p.title}
                  </button>
                  {p.id === activeProjectId && (
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                      (پروژه فعال)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {p.approvedText.slice(0, 100) || 'بدون متن'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onSaveProject({ ...p, favorite: !p.favorite })}
                  title="نشانه‌گذاری"
                  className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    p.favorite ? 'text-amber-500' : 'text-slate-400'
                  }`}
                >
                  <Star className="w-4 h-4" fill={p.favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(p)}
                  title="تکثیر پروژه"
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={projects.length <= 1}
                  onClick={() => onDeleteProject(p.id)}
                  title="حذف پروژه"
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Templates & Pronunciation Issue Reporter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              الگوهای آماده صدا و لحن
            </h3>
          </div>

          <form onSubmit={handleSaveTemplate} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="نام الگوی جدید از تنظیمات فعلی..."
              className="sm:col-span-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              placeholder="توضیح کوتاه"
              className="sm:col-span-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold py-1.5"
            >
              ذخیره الگو
            </button>
          </form>

          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tpl.nameFa}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tpl.descriptionFa}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApplyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-md bg-teal-700 text-white text-xs font-medium"
                  >
                    اعمال
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ثبت گزارش خطای تلفظ برای اصلاح
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            واژگانی که در تلفظ مدل نیاز به اصلاح دارند را یادداشت کنید تا در واژه‌نامه تلفظ یا اعراب‌گذاری ثبت شوند.
          </p>
          <form onSubmit={handleReportPronunciationIssue} className="space-y-2.5">
            <input
              type="text"
              value={issueWord}
              onChange={(e) => setIssueWord(e.target.value)}
              placeholder="واژه یا عبارت (مثلاً تَفتان یا QBO)"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              placeholder="تلفظ مورد انتظار و توضیح..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold"
            >
              ثبت گزارش تلفظ
            </button>
            {issueSavedNotice && (
              <p className="text-xs text-teal-700 dark:text-teal-400">
                گزارش با موفقیت ثبت شد.
              </p>
            )}
          </form>
        </section>
      </div>

      {/* Generation History */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            تاریخچه تولید گفتار و برآورد مصرف تقریبی
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            کل قطعات: {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            تاریخچه‌ای ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-2 font-medium">عنوان</th>
                  <th className="py-2 px-2 font-medium">گوینده / سبک</th>
                  <th className="py-2 px-2 font-medium">مدل</th>
                  <th className="py-2 px-2 font-medium">مدت</th>
                  <th className="py-2 px-2 font-medium">نویسه</th>
                  <th className="py-2 px-2 font-medium">تخمین هزینه</th>
                  <th className="py-2 px-2 font-medium">پخش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.slice(0, 30).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-2 font-medium text-slate-900 dark:text-slate-100">
                      {item.projectTitle}
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400">
                      {item.personaNameFa} · {item.styleNameFa}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-500">
                      {item.modelUsed}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums">
                      {formatTimecode(item.durationSec)}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums">{item.charCount}</td>
                    <td dir="ltr" className="py-2 px-2 font-mono tabular-nums text-slate-500">
                      ~${item.estimatedCostUsd.toFixed(5)}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => onPlayAudioId(item.audioId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-700 text-white text-[11px]"
                      >
                        <Play className="w-3 h-3" />
                        <span>پخش</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
