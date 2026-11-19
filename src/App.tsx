import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  AudioWaveform,
  BookOpen,
  Clock,
  FileText,
  FolderKanban,
  Menu,
  Mic,
  Moon,
  Save,
  Settings,
  Sliders,
  Sparkles,
  Sun,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { ExportModal } from './components/ExportModal';
import { StudioWorkspaceTab } from './components/StudioWorkspaceTab';
import { TextEditorTab } from './components/TextEditorTab';
import { DiacritizeTab } from './components/DiacritizeTab';
import { VoicesLibraryTab } from './components/VoicesLibraryTab';
import { StylesControlsTab } from './components/StylesControlsTab';
import { DictionaryTab } from './components/DictionaryTab';
import {
  DEFAULT_DICTIONARY_ENTRIES,
  DEFAULT_SPEECH_CONTROLS,
  SAMPLE_PERSIAN_SCRIPTS,
} from './data/catalog';
import {
  deleteProjectApi,
  deleteTemplateApi,
  fetchArtifacts,
  fetchDictionary,
  fetchHealth,
  fetchHistory,
  fetchJobs,
  fetchJobStatus,
  fetchModelsDiscovery,
  fetchProjects,
  fetchTemplates,
  requestDiacritize,
  saveDictionaryApi,
  saveProjectApi,
  saveTemplateApi,
} from './services/api';
import type {
  AudioArtifact,
  DictionaryEntry,
  HistoryItem,
  ModelsDiscoveryResponse,
  SpeechControlsConfig,
  StudioProject,
  StudioTab,
  SynthesisJob,
  VoicePersona,
  VoiceTemplate,
} from './types/studio';

// Lazy-load secondary heavy modules for fast initial load
const VoiceDesignTab = lazy(() =>
  import('./components/VoiceDesignTab').then((m) => ({ default: m.VoiceDesignTab }))
);
const TimingJobsTab = lazy(() =>
  import('./components/TimingJobsTab').then((m) => ({ default: m.TimingJobsTab }))
);
const AudioEditorTab = lazy(() =>
  import('./components/AudioEditorTab').then((m) => ({ default: m.AudioEditorTab }))
);
const ProjectsHistoryTab = lazy(() =>
  import('./components/ProjectsHistoryTab').then((m) => ({ default: m.ProjectsHistoryTab }))
);
const SettingsTab = lazy(() =>
  import('./components/SettingsTab').then((m) => ({ default: m.SettingsTab }))
);

interface NavItem {
  id: StudioTab;
  labelFa: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'studio', labelFa: 'استودیوی صدا', icon: Wand2 },
  { id: 'editor', labelFa: 'ویرایشگر متن', icon: FileText },
  { id: 'diacritize', labelFa: 'اعراب‌گذاری هوشمند', icon: Sparkles },
  { id: 'voices', labelFa: 'کتابخانه گویندگان', icon: Users },
  { id: 'voice-design', labelFa: 'طراحی صدا', icon: Mic },
  { id: 'styles', labelFa: 'سبک و لحن اجرا', icon: Sliders },
  { id: 'dictionary', labelFa: 'واژه‌نامه تلفظ', icon: BookOpen },
  { id: 'timing', labelFa: 'زمان‌بندی', icon: Clock },
  { id: 'audio-editor', labelFa: 'ویرایشگر صوت', icon: AudioWaveform },
  { id: 'projects', labelFa: 'پروژه‌ها', icon: FolderKanban },
  { id: 'settings', labelFa: 'تنظیمات', icon: Settings },
];

const DRAFT_STORAGE_KEY = 'ava_studio_draft_v1';
const THEME_STORAGE_KEY = 'ava_studio_theme';
const FAV_STORAGE_KEY = 'ava_studio_fav_personas';

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Project & text state
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-default-weather');
  const [projectTitle, setProjectTitle] = useState<string>(SAMPLE_PERSIAN_SCRIPTS[0].titleFa);
  const [originalText, setOriginalText] = useState<string>(SAMPLE_PERSIAN_SCRIPTS[0].text);
  const [processedText, setProcessedText] = useState<string>(SAMPLE_PERSIAN_SCRIPTS[0].text);
  const [approvedText, setApprovedText] = useState<string>(SAMPLE_PERSIAN_SCRIPTS[0].text);
  const [controls, setControls] = useState<SpeechControlsConfig>(DEFAULT_SPEECH_CONTROLS);
  const [targetDurationSec, setTargetDurationSec] = useState<number | null>(null);

  // Domain resources
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>(DEFAULT_DICTIONARY_ENTRIES);
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [artifacts, setArtifacts] = useState<AudioArtifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<AudioArtifact | null>(null);
  const [jobs, setJobs] = useState<SynthesisJob[]>([]);
  const [activeJob, setActiveJob] = useState<SynthesisJob | null>(null);

  // Capabilities & preferences
  const [discovery, setDiscovery] = useState<ModelsDiscoveryResponse | null>(null);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || '["yalda","arman"]');
    } catch {
      return ['yalda', 'arman'];
    }
  });

  const [diacritizing, setDiacritizing] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Sync HTML dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Recover local text draft on first load if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          projectTitle?: string;
          approvedText?: string;
          originalText?: string;
          processedText?: string;
          controls?: SpeechControlsConfig;
        };
        if (draft.approvedText) setApprovedText(draft.approvedText);
        if (draft.originalText) setOriginalText(draft.originalText);
        if (draft.processedText) setProcessedText(draft.processedText);
        if (draft.projectTitle) setProjectTitle(draft.projectTitle);
        if (draft.controls) setControls((c) => ({ ...c, ...draft.controls }));
      }
    } catch {
      // ignore invalid draft
    }
  }, []);

  // Autosave lightweight text draft to localStorage (never audio blobs)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            projectTitle,
            originalText,
            processedText,
            approvedText,
            controls,
          })
        );
      } catch {
        // ignore quota
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [projectTitle, originalText, processedText, approvedText, controls]);

  // Initial server bootstrap
  useEffect(() => {
    void (async () => {
      try {
        const [h, m, p, d, t, hist, arts, j] = await Promise.all([
          fetchHealth(),
          fetchModelsDiscovery(false),
          fetchProjects(),
          fetchDictionary(),
          fetchTemplates(),
          fetchHistory(),
          fetchArtifacts(),
          fetchJobs(),
        ]);
        setFfmpegAvailable(h.ffmpegAvailable);
        setDiscovery(m);
        if (p.projects.length > 0) {
          setProjects(p.projects);
          setActiveProjectId(p.projects[0].id);
        }
        if (d.entries.length > 0) setDictionary(d.entries);
        setTemplates(t.templates);
        setHistory(hist.history);
        setArtifacts(arts.artifacts);
        if (arts.artifacts.length > 0) setActiveArtifact(arts.artifacts[0]);
        setJobs(j.jobs);
      } catch {
        // Keep graceful defaults if initial boot encounters transient error
      }
    })();
  }, []);

  // Poll running/queued jobs
  useEffect(() => {
    const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued');
    if (running.length === 0) return;

    const timer = setInterval(() => {
      void (async () => {
        for (const jobItem of running) {
          try {
            const { job, artifact } = await fetchJobStatus(jobItem.id);
            setJobs((prev) => prev.map((x) => (x.id === job.id ? job : x)));
            if (activeJob?.id === job.id) {
              setActiveJob(job);
            }
            if (job.status === 'completed' && artifact) {
              setArtifacts((prev) => [artifact, ...prev.filter((a) => a.id !== artifact.id)]);
              setActiveArtifact(artifact);
              const hist = await fetchHistory();
              setHistory(hist.history);
            }
          } catch {
            // ignore transient polling error
          }
        }
      })();
    }, 1200);

    return () => clearInterval(timer);
  }, [jobs, activeJob?.id]);

  const handleSaveCurrentProject = useCallback(async () => {
    setSavingProject(true);
    try {
      const existing = projects.find((p) => p.id === activeProjectId);
      const payload: StudioProject = {
        id: activeProjectId,
        title: projectTitle || 'پروژه بدون عنوان',
        originalText,
        processedText,
        approvedText,
        speechReadyText: approvedText,
        controls,
        targetDurationSec,
        lastAudioId: activeArtifact?.id,
        favorite: existing?.favorite ?? false,
        tags: existing?.tags ?? [],
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await saveProjectApi(payload);
      setProjects(res.projects);
      setSaveToast('پروژه در سرور ذخیره شد');
      setTimeout(() => setSaveToast(null), 2400);
    } finally {
      setSavingProject(false);
    }
  }, [
    activeProjectId,
    projectTitle,
    originalText,
    processedText,
    approvedText,
    controls,
    targetDurationSec,
    activeArtifact?.id,
    projects,
  ]);

  // Ctrl+S shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveCurrentProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSaveCurrentProject]);

  const handleRunQuickDiacritize = async () => {
    if (!approvedText.trim()) return;
    setDiacritizing(true);
    try {
      const res = await requestDiacritize(approvedText, 'فارسی معیار و تخصصی');
      setApprovedText(res.diacritizedText);
      setSaveToast('اعراب‌گذاری هوشمند روی متن اعمال شد');
      setTimeout(() => setSaveToast(null), 2800);
    } catch (err) {
      setSaveToast(err instanceof Error ? err.message : 'خطا در اعراب‌گذاری');
      setTimeout(() => setSaveToast(null), 3200);
    } finally {
      setDiacritizing(false);
    }
  };

  const handleArtifactReady = async (artifact: AudioArtifact) => {
    setArtifacts((prev) => [artifact, ...prev.filter((a) => a.id !== artifact.id)]);
    setActiveArtifact(artifact);
    try {
      const hist = await fetchHistory();
      setHistory(hist.history);
    } catch {
      // ignore
    }
  };

  const handleJobUpdated = (job: SynthesisJob) => {
    setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    setActiveJob(job);
  };

  const handleSelectProject = (proj: StudioProject) => {
    setActiveProjectId(proj.id);
    setProjectTitle(proj.title);
    setOriginalText(proj.originalText);
    setProcessedText(proj.processedText);
    setApprovedText(proj.approvedText);
    setControls(proj.controls);
    setTargetDurationSec(proj.targetDurationSec);
    if (proj.lastAudioId) {
      const found = artifacts.find((a) => a.id === proj.lastAudioId);
      if (found) setActiveArtifact(found);
    }
    setActiveTab('studio');
  };

  const handleSelectPersona = (persona: VoicePersona) => {
    setControls((c) => ({
      ...c,
      personaId: persona.id,
      voiceId: persona.mappedVoiceId,
      styleId: persona.recommendedStyleId,
      customStylePrompt: '',
    }));
    setActiveTab('studio');
  };

  const handleToggleFavorite = (personaId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(personaId)
        ? prev.filter((x) => x !== personaId)
        : [...prev, personaId];
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handlePlayAudioId = (audioId: string) => {
    const found = artifacts.find((a) => a.id === audioId);
    if (found) {
      setActiveArtifact(found);
      setActiveTab('studio');
    }
  };

  const ttsModels =
    discovery?.models.filter((m) => m.family === 'tts') || [
      {
        id: 'gemini-3.8-flash-lite-tts',
        displayName: 'Gemini 3.8 Flash Lite TTS',
        family: 'tts',
        availableInEnv: true,
        verifiedByListApi: false,
        supportsAudioOutput: true,
        supportsMultiSpeaker: false,
        supportsVoiceDesign: false,
        supportsStreamingPcm: true,
        qualityTierFa: 'کیفیت بالا و سریع',
        latencyEstimateFa: 'سریع',
        relativeCostEstimateFa: 'اقتصادی',
        notesFa: '',
      },
      {
        id: 'gemini-3.8-flash-tts',
        displayName: 'Gemini 3.8 Flash TTS',
        family: 'tts',
        availableInEnv: true,
        verifiedByListApi: false,
        supportsAudioOutput: true,
        supportsMultiSpeaker: true,
        supportsVoiceDesign: true,
        supportsStreamingPcm: true,
        qualityTierFa: 'طراحی صدا و دیالوگ',
        latencyEstimateFa: 'متوسط',
        relativeCostEstimateFa: 'متوسط',
        notesFa: '',
      },
    ];

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <div dir="rtl" className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            آوا استودیو
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="ناوبری اصلی">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`studio-focus w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-700 text-white dark:bg-teal-600'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.labelFa}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          {discovery && !discovery.apiConfigured && (
            <div className="text-red-600 dark:text-red-400 font-medium">
              کلید Gemini در سرور تنظیم نشده است.
            </div>
          )}
          <div>پروژه فعال: {projectTitle}</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white dark:bg-[#111827] h-full flex flex-col border-l border-slate-200 dark:border-slate-800 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-extrabold text-base">آوا استودیو</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="بستن منو"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                      active
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.labelFa}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منوی ناوبری"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {activeNavMeta?.labelFa || 'استودیوی صدا'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveToast && (
              <span className="hidden sm:inline text-xs text-teal-700 dark:text-teal-400 font-medium">
                {saveToast}
              </span>
            )}
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label="تغییر تم روشن و تیره"
              className="studio-focus p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              disabled={savingProject}
              onClick={handleSaveCurrentProject}
              className="studio-focus inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProject ? 'در حال ذخیره...' : 'ذخیره پروژه'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'studio' && (
            <StudioWorkspaceTab
              projectTitle={projectTitle}
              onProjectTitleChange={setProjectTitle}
              approvedText={approvedText}
              onApprovedTextChange={(txt) => {
                setApprovedText(txt);
                if (!originalText) setOriginalText(txt);
              }}
              controls={controls}
              onControlsChange={setControls}
              dictionary={dictionary}
              ttsModels={ttsModels}
              targetDurationSec={targetDurationSec}
              onTargetDurationChange={setTargetDurationSec}
              activeArtifact={activeArtifact}
              onArtifactReady={handleArtifactReady}
              activeJob={activeJob}
              onJobStarted={handleJobUpdated}
              onNavigateTab={setActiveTab}
              onRunQuickDiacritize={handleRunQuickDiacritize}
              diacritizing={diacritizing}
              onOpenExport={() => setExportOpen(true)}
            />
          )}

          {activeTab === 'editor' && (
            <TextEditorTab
              originalText={originalText}
              processedText={processedText}
              approvedText={approvedText}
              onUpdateTexts={(patch) => {
                if (typeof patch.originalText === 'string') setOriginalText(patch.originalText);
                if (typeof patch.processedText === 'string') setProcessedText(patch.processedText);
                if (typeof patch.approvedText === 'string') setApprovedText(patch.approvedText);
              }}
              dictionary={dictionary}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'diacritize' && (
            <DiacritizeTab
              originalText={originalText}
              approvedText={approvedText}
              onApproveDiacritized={setApprovedText}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'voices' && (
            <VoicesLibraryTab
              controls={controls}
              onSelectPersona={handleSelectPersona}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              customVoiceSupported={discovery?.customVoiceCloningSupported ?? false}
              customVoiceNoteFa={
                discovery?.customVoiceNoteFa ||
                'در این محیط ۵ صدای پیش‌ساخته واقعی در دسترس هستند و پرسونای فارسی به همراه دستور سبک روی آن‌ها اجرا می‌شود.'
              }
            />
          )}

          {activeTab === 'styles' && (
            <StylesControlsTab controls={controls} onControlsChange={setControls} />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryTab
              entries={dictionary}
              onSaveEntries={async (next) => {
                const res = await saveDictionaryApi(next);
                setDictionary(res.entries);
              }}
              activeVoiceId={controls.voiceId}
            />
          )}

          <Suspense
            fallback={
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center text-xs text-slate-500">
                در حال بارگذاری بخش...
              </div>
            }
          >
            {activeTab === 'voice-design' && (
              <VoiceDesignTab
                controls={controls}
                activeArtifact={activeArtifact}
                onArtifactReady={handleArtifactReady}
                onOpenExport={() => setExportOpen(true)}
              />
            )}

            {activeTab === 'timing' && (
              <TimingJobsTab
                projectTitle={projectTitle}
                approvedText={approvedText}
                controls={controls}
                dictionary={dictionary}
                targetDurationSec={targetDurationSec}
                onTargetDurationChange={setTargetDurationSec}
                jobs={jobs}
                onJobUpdated={handleJobUpdated}
                onRefreshJobs={async () => {
                  const res = await fetchJobs();
                  setJobs(res.jobs);
                }}
                onSelectAudioId={handlePlayAudioId}
                artifacts={artifacts}
              />
            )}

            {activeTab === 'audio-editor' && (
              <AudioEditorTab
                artifacts={artifacts}
                activeArtifact={activeArtifact}
                onArtifactSelected={setActiveArtifact}
                onArtifactCreated={handleArtifactReady}
                onOpenExport={() => setExportOpen(true)}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsHistoryTab
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProject}
                onSaveProject={async (p) => {
                  const res = await saveProjectApi(p);
                  setProjects(res.projects);
                }}
                onDeleteProject={async (id) => {
                  const res = await deleteProjectApi(id);
                  setProjects(res.projects);
                }}
                templates={templates}
                onApplyTemplate={(tpl) => {
                  setControls((c) => ({ ...c, ...tpl.controls }));
                  setActiveTab('studio');
                }}
                onSaveCurrentAsTemplate={async (nameFa, descriptionFa) => {
                  const res = await saveTemplateApi({
                    id: `tpl-${Date.now()}`,
                    nameFa,
                    descriptionFa,
                    controls,
                    createdAt: new Date().toISOString(),
                  });
                  setTemplates(res.templates);
                }}
                onDeleteTemplate={async (id) => {
                  const res = await deleteTemplateApi(id);
                  setTemplates(res.templates);
                }}
                history={history}
                onPlayAudioId={handlePlayAudioId}
                currentControls={controls}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                discovery={discovery}
                ffmpegAvailable={ffmpegAvailable}
                refreshing={refreshingModels}
                onRefreshModels={async () => {
                  setRefreshingModels(true);
                  try {
                    const res = await fetchModelsDiscovery(true);
                    setDiscovery(res);
                  } finally {
                    setRefreshingModels(false);
                  }
                }}
              />
            )}
          </Suspense>
        </main>
      </div>

      {exportOpen && activeArtifact && (
        <ExportModal artifact={activeArtifact} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
