export type StudioTab =
  | 'studio'
  | 'editor'
  | 'diacritize'
  | 'voices'
  | 'voice-design'
  | 'styles'
  | 'dictionary'
  | 'timing'
  | 'audio-editor'
  | 'projects'
  | 'settings';

export type RealVoiceId = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface RealVoiceInfo {
  id: RealVoiceId;
  labelFa: string;
  timbreNoteFa: string;
  supportedModels: string[];
}

export interface VoicePersona {
  id: string;
  displayNameFa: string;
  mappedVoiceId: RealVoiceId;
  roleSummaryFa: string;
  qualities: ('گرم' | 'جدی' | 'خبری' | 'داستانی' | 'مستند' | 'پرشتاب' | 'آرام' | 'علمی' | 'شاعرانه' | 'محاوره‌ای')[];
  recommendedStyleId: string;
  styleDirectionEn: string;
  isCustomVoiceSupported: false;
}

export interface SpeakingStyle {
  id: string;
  nameFa: string;
  categoryFa: 'خبری و میدانی' | 'هواشناسی و اقلیم' | 'مستند و علمی' | 'داستانی و ادبی' | 'پادکست و محاوره' | 'احساسی و نمایشی';
  descriptionFa: string;
  stylePromptEn: string;
  recommendedPacing: 'slow' | 'normal' | 'fast';
  recommendedPauseMs: number;
  supportsBackchannelHint?: boolean;
}

export type DictionaryCategory =
  | 'هواشناسی و اقلیم'
  | 'نام‌های خاص ایرانی'
  | 'شهرها و روستاها'
  | 'واژگان خارجی'
  | 'مخفف‌ها'
  | 'تاریخ و اعداد'
  | 'واحدهای علمی';

export interface DictionaryEntry {
  id: string;
  original: string;
  spokenForm: string;
  phoneticHint?: string;
  category: DictionaryCategory;
  priority: number;
  acronymMode: 'as-is' | 'spell-out' | 'expand';
  scope: 'global' | 'project';
  enabled: boolean;
  notes?: string;
}

export interface DiacritizeDiffItem {
  id: string;
  index: number;
  original: string;
  suggested: string;
  reasonFa: string;
  confidence: 'high' | 'medium' | 'low';
  changed: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  finalText: string;
}

export interface PauseSuggestion {
  id: string;
  targetPhrase: string;
  suggestedText: string;
  reasonFa: string;
  applied: boolean;
}

export interface SpeechControlsConfig {
  modelId: string;
  autoModel: boolean;
  voiceId: RealVoiceId;
  personaId: string;
  styleId: string;
  customStylePrompt: string;
  // Native controls vs prompt-level vs post-processing
  speedMultiplier: number; // Post-process pitch-preserving atempo (0.65 - 1.5)
  sentencePauseMs: number; // Post/Prompt pause control
  paragraphPauseMs: number; // Post-process silence insertion
  emotionalIntensity: 'low' | 'medium' | 'high'; // Prompt-level
  expressiveness: 'restrained' | 'balanced' | 'expressive'; // Prompt-level
  outputGainDb: number; // Post-process dB gain
  normalizeLoudness: boolean; // Post-process EBU R128 -16 LUFS
  targetLufs: number;
  punctuationSensitivity: 'strict' | 'natural'; // Prompt-level
}

export interface DialogueTurn {
  id: string;
  speakerLabel: string;
  voiceId: RealVoiceId;
  personaId: string;
  stylePrompt: string;
  text: string;
  pauseAfterMs: number;
}

export interface DiscoveredModel {
  id: string;
  displayName: string;
  family: 'tts' | 'text' | 'live' | 'transcribe';
  availableInEnv: boolean;
  verifiedByListApi: boolean;
  supportsAudioOutput: boolean;
  supportsMultiSpeaker: boolean;
  supportsVoiceDesign: boolean;
  supportsStreamingPcm: boolean;
  qualityTierFa: string;
  latencyEstimateFa: string;
  relativeCostEstimateFa: string;
  notesFa: string;
}

export interface ModelsDiscoveryResponse {
  apiConfigured: boolean;
  discoverySource: 'live-api' | 'verified-fallback';
  discoveredAt: string;
  models: DiscoveredModel[];
  realVoices: RealVoiceInfo[];
  customVoiceCloningSupported: boolean;
  customVoiceNoteFa: string;
  errorFa?: string;
}

export interface LoudnessMetrics {
  integratedLufs: number;
  truePeakDb: number;
  loudnessRangeLu: number;
}

export interface AudioArtifact {
  id: string;
  parentId?: string;
  title: string;
  modelUsed: string;
  voiceId: RealVoiceId;
  personaNameFa: string;
  styleNameFa: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  waveformPeaks: number[];
  loudness?: LoudnessMetrics;
  createdAt: string;
  textPreview: string;
  segmentMarkers?: { label: string; startSec: number; endSec: number }[];
  estimatedTokens?: number;
  estimatedCostUsd?: number;
  isEdited?: boolean;
}

export interface AudioEditOperations {
  trimStartSec?: number;
  trimEndSec?: number;
  speed?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  insertSilenceAtSec?: number;
  insertSilenceDurationSec?: number;
  removeLongSilences?: boolean;
  normalizeLufs?: number | null;
  peakLimitDb?: number | null;
  volumeDb?: number;
  noiseReduce?: boolean;
}

export type ExportFormat = 'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg';

export interface ExportOptions {
  format: ExportFormat;
  mp3BitrateKbps: 128 | 192 | 256 | 320;
  sampleRate: 16000 | 22050 | 24000 | 44100 | 48000;
  channels: 1 | 2;
  filename: string;
  titleMeta?: string;
  artistMeta?: string;
}

export interface JobChunk {
  index: number;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  audioId?: string;
  durationSec?: number;
  errorFa?: string;
  attempts: number;
}

export interface SynthesisJob {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'partial';
  totalChunks: number;
  completedChunks: number;
  chunks: JobChunk[];
  modelId: string;
  voiceId: RealVoiceId;
  stylePrompt: string;
  pauseBetweenChunksMs: number;
  crossfadeMs: number;
  targetDurationSec?: number | null;
  tolerancePercent?: number;
  autoTimeStretch?: boolean;
  finalAudioId?: string;
  finalDurationSec?: number;
  appliedSpeedFactor?: number;
  feasibilityWarningFa?: string;
  createdAt: string;
  updatedAt: string;
  errorFa?: string;
}

export interface StudioProject {
  id: string;
  title: string;
  originalText: string;
  processedText: string;
  approvedText: string;
  speechReadyText: string;
  controls: SpeechControlsConfig;
  targetDurationSec: number | null;
  lastAudioId?: string;
  favorite: boolean;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

export interface VoiceTemplate {
  id: string;
  nameFa: string;
  descriptionFa: string;
  controls: Partial<SpeechControlsConfig>;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  audioId: string;
  projectTitle: string;
  modelUsed: string;
  voiceId: RealVoiceId;
  personaNameFa: string;
  styleNameFa: string;
  durationSec: number;
  charCount: number;
  estimatedCostUsd: number;
  createdAt: string;
  textSnippet: string;
}
