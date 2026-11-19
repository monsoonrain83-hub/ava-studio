import type {
  AudioArtifact,
  AudioEditOperations,
  DiacritizeDiffItem,
  DictionaryEntry,
  DialogueTurn,
  ExportOptions,
  HistoryItem,
  ModelsDiscoveryResponse,
  PauseSuggestion,
  RealVoiceId,
  SpeechControlsConfig,
  StudioProject,
  SynthesisJob,
  VoiceTemplate,
} from '../types/studio';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.errorFa || data.error || `خطای سرور (${res.status})`);
  }
  return data as T;
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  apiKeyConfigured: boolean;
  ffmpegAvailable: boolean;
  timestamp: string;
}> {
  return apiJson('/api/health');
}

export async function fetchModelsDiscovery(refresh = false): Promise<ModelsDiscoveryResponse> {
  return apiJson(`/api/models${refresh ? '?refresh=1' : ''}`);
}

export async function requestDiacritize(
  text: string,
  domainHint?: string
): Promise<{
  diacritizedText: string;
  items: DiacritizeDiffItem[];
  modelUsed: string;
}> {
  return apiJson('/api/linguistic/diacritize', {
    method: 'POST',
    body: JSON.stringify({ text, domainHint }),
  });
}

export async function requestPauseSuggestions(text: string): Promise<{
  suggestions: PauseSuggestion[];
  modelUsed: string;
}> {
  return apiJson('/api/linguistic/pause-suggestions', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function uploadDocumentFile(file: File): Promise<{
  filename: string;
  format: string;
  text: string;
  srtCues?: { index: number; start: string; end: string; text: string }[];
  warningsFa: string[];
  isLikelyScannedPdf?: boolean;
  pageCount?: number;
}> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/documents/import', {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.errorFa || 'خطا در وارد کردن فایل.');
  }
  return data;
}

export async function requestVoicePreview(params: {
  voiceId: RealVoiceId;
  sampleText?: string;
  stylePrompt?: string;
}): Promise<{
  audioUrl: string;
  voiceId: RealVoiceId;
  durationSec: number;
  waveformPeaks: number[];
  cached: boolean;
}> {
  return apiJson('/api/tts/preview-voice', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function generateSpeech(params: {
  title: string;
  text: string;
  controls: SpeechControlsConfig;
  applyDictionary?: boolean;
}): Promise<{
  artifact: AudioArtifact;
  speechReadyText: string;
  appliedRules: { original: string; spokenForm: string; count: number }[];
}> {
  return apiJson('/api/tts/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function generateMultiSpeakerSpeech(params: {
  title: string;
  turns: DialogueTurn[];
  mode: 'auto' | 'native' | 'segmented';
  normalizeLoudness?: boolean;
}): Promise<{
  artifact: AudioArtifact;
  synthesisModeUsed: 'native-dual' | 'segmented-stitch';
}> {
  return apiJson('/api/tts/multi-speaker', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createSynthesisJob(params: {
  title: string;
  text: string;
  controls: SpeechControlsConfig;
  maxCharsPerChunk?: number;
  targetDurationSec?: number | null;
  tolerancePercent?: number;
  autoTimeStretch?: boolean;
}): Promise<{ job: SynthesisJob }> {
  return apiJson('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchJobs(): Promise<{ jobs: SynthesisJob[] }> {
  return apiJson('/api/jobs');
}

export async function fetchJobStatus(jobId: string): Promise<{
  job: SynthesisJob;
  artifact?: AudioArtifact;
}> {
  return apiJson(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelSynthesisJob(jobId: string): Promise<{ job: SynthesisJob }> {
  return apiJson(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

export async function resumeSynthesisJob(jobId: string): Promise<{ job: SynthesisJob }> {
  return apiJson(`/api/jobs/${encodeURIComponent(jobId)}/resume`, { method: 'POST' });
}

export async function fetchArtifacts(): Promise<{ artifacts: AudioArtifact[] }> {
  return apiJson('/api/artifacts');
}

export async function processAudioArtifact(
  audioId: string,
  operations: AudioEditOperations
): Promise<{ artifact: AudioArtifact }> {
  return apiJson(`/api/audio/${encodeURIComponent(audioId)}/process`, {
    method: 'POST',
    body: JSON.stringify({ operations }),
  });
}

export async function mergeAudioArtifacts(params: {
  audioIds: string[];
  pauseMs: number;
  title: string;
}): Promise<{ artifact: AudioArtifact }> {
  return apiJson('/api/audio/merge', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function downloadExportedAudio(audioId: string, options: ExportOptions): Promise<void> {
  const res = await fetch(`/api/audio/${encodeURIComponent(audioId)}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errorFa || 'خطا در خروجی گرفتن فایل صوتی');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.filename || 'ava-studio'}.${options.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchProjects(): Promise<{ projects: StudioProject[] }> {
  return apiJson('/api/projects');
}

export async function saveProjectApi(project: StudioProject): Promise<{
  project: StudioProject;
  projects: StudioProject[];
}> {
  return apiJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

export async function deleteProjectApi(id: string): Promise<{ projects: StudioProject[] }> {
  return apiJson(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchDictionary(): Promise<{ entries: DictionaryEntry[] }> {
  return apiJson('/api/dictionary');
}

export async function saveDictionaryApi(
  entries: DictionaryEntry[]
): Promise<{ entries: DictionaryEntry[] }> {
  return apiJson('/api/dictionary', {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

export async function fetchTemplates(): Promise<{ templates: VoiceTemplate[] }> {
  return apiJson('/api/templates');
}

export async function saveTemplateApi(
  template: VoiceTemplate
): Promise<{ templates: VoiceTemplate[] }> {
  return apiJson('/api/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function deleteTemplateApi(id: string): Promise<{ templates: VoiceTemplate[] }> {
  return apiJson(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchHistory(): Promise<{ history: HistoryItem[] }> {
  return apiJson('/api/history');
}
