import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DEFAULT_DICTIONARY_ENTRIES,
  DEFAULT_SPEECH_CONTROLS,
  SAMPLE_PERSIAN_SCRIPTS,
} from '../src/data/catalog.ts';
import type {
  AudioArtifact,
  DictionaryEntry,
  HistoryItem,
  StudioProject,
  VoiceTemplate,
} from '../src/types/studio.ts';

const DATA_ROOT = path.resolve(process.cwd(), 'data');
export const AUDIO_DIR = path.join(DATA_ROOT, 'audio');
export const PREVIEWS_DIR = path.join(AUDIO_DIR, 'previews');
export const TMP_DIR = path.join(DATA_ROOT, 'tmp');

const PROJECTS_FILE = path.join(DATA_ROOT, 'projects.json');
const DICTIONARY_FILE = path.join(DATA_ROOT, 'dictionary.json');
const TEMPLATES_FILE = path.join(DATA_ROOT, 'templates.json');
const HISTORY_FILE = path.join(DATA_ROOT, 'history.json');
const ARTIFACTS_FILE = path.join(DATA_ROOT, 'artifacts.json');

export function ensureStorageDirs() {
  for (const dir of [DATA_ROOT, AUDIO_DIR, PREVIEWS_DIR, TMP_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function sanitizeId(id: string): string {
  const clean = path.basename(String(id || '').trim());
  if (!/^[a-zA-Z0-9_-]{3,96}$/.test(clean)) {
    throw new Error('شناسه فایل یا رکورد معتبر نیست.');
  }
  return clean;
}

export function newId(prefix = 'id'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function getAudioPath(id: string): string {
  const safe = sanitizeId(id);
  return path.join(AUDIO_DIR, `${safe}.wav`);
}

export function getPreviewAudioPath(voiceId: string): string {
  const safe = sanitizeId(`preview-${voiceId}`);
  return path.join(PREVIEWS_DIR, `${safe}.wav`);
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureStorageDirs();
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, fallback);
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureStorageDirs();
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

const DEFAULT_PROJECT: StudioProject = {
  id: 'proj-default-weather',
  title: 'بولتن هواشناسی نمونه',
  originalText: SAMPLE_PERSIAN_SCRIPTS[0].text,
  processedText: SAMPLE_PERSIAN_SCRIPTS[0].text,
  approvedText: SAMPLE_PERSIAN_SCRIPTS[0].text,
  speechReadyText: SAMPLE_PERSIAN_SCRIPTS[0].text,
  controls: DEFAULT_SPEECH_CONTROLS,
  targetDurationSec: null,
  favorite: true,
  tags: ['هواشناسی', 'نمونه'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TEMPLATES: VoiceTemplate[] = [
  {
    id: 'tpl-synoptic-weather',
    nameFa: 'بولتن تحلیلی هواشناسی (یلدا)',
    descriptionFa: 'مناسب تحلیل مدل‌های ECMWF/GFS با لحن علمی و متعادل',
    controls: {
      voiceId: 'Kore',
      personaId: 'yalda',
      styleId: 'synoptic-analysis',
      speedMultiplier: 1.0,
      normalizeLoudness: true,
      targetLufs: -16,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl-formal-news',
    nameFa: 'بخش خبری رسمی (آرمان)',
    descriptionFa: 'گویندگی خبر رسمی با ریتم استاندارد و نرمال‌سازی پخش',
    controls: {
      voiceId: 'Kore',
      personaId: 'arman',
      styleId: 'formal-news',
      speedMultiplier: 1.02,
      normalizeLoudness: true,
      targetLufs: -16,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl-poetry-mehrad',
    nameFa: 'دکلمه و شعر فارسی (مهراد)',
    descriptionFa: 'ریتم آرام، مکث‌های عروضی و طنین ملایم',
    controls: {
      voiceId: 'Zephyr',
      personaId: 'mehrad',
      styleId: 'persian-poetry',
      speedMultiplier: 0.94,
      sentencePauseMs: 520,
      paragraphPauseMs: 850,
      normalizeLoudness: true,
      targetLufs: -18,
    },
    createdAt: new Date().toISOString(),
  },
];

export function listProjects(): StudioProject[] {
  return readJson<StudioProject[]>(PROJECTS_FILE, [DEFAULT_PROJECT]);
}

export function saveProjects(projects: StudioProject[]): StudioProject[] {
  writeJson(PROJECTS_FILE, projects);
  return projects;
}

export function listDictionary(): DictionaryEntry[] {
  return readJson<DictionaryEntry[]>(DICTIONARY_FILE, DEFAULT_DICTIONARY_ENTRIES);
}

export function saveDictionary(entries: DictionaryEntry[]): DictionaryEntry[] {
  writeJson(DICTIONARY_FILE, entries);
  return entries;
}

export function listTemplates(): VoiceTemplate[] {
  return readJson<VoiceTemplate[]>(TEMPLATES_FILE, DEFAULT_TEMPLATES);
}

export function saveTemplates(templates: VoiceTemplate[]): VoiceTemplate[] {
  writeJson(TEMPLATES_FILE, templates);
  return templates;
}

export function listHistory(): HistoryItem[] {
  return readJson<HistoryItem[]>(HISTORY_FILE, []);
}

export function appendHistory(item: HistoryItem): HistoryItem[] {
  const current = listHistory();
  const next = [item, ...current].slice(0, 200);
  writeJson(HISTORY_FILE, next);
  return next;
}

export function listArtifacts(): AudioArtifact[] {
  return readJson<AudioArtifact[]>(ARTIFACTS_FILE, []);
}

export function getArtifactMeta(id: string): AudioArtifact | undefined {
  const safe = sanitizeId(id);
  return listArtifacts().find((a) => a.id === safe);
}

export function saveArtifactMeta(artifact: AudioArtifact): AudioArtifact {
  const current = listArtifacts().filter((a) => a.id !== artifact.id);
  const next = [artifact, ...current].slice(0, 250);
  writeJson(ARTIFACTS_FILE, next);
  return artifact;
}
