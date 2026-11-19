import type { DictionaryEntry } from '../types/studio';

const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

export function stripPersianDiacritics(text: string): string {
  return text.replace(DIACRITICS_REGEX, '');
}

export interface NormalizeOptions {
  normalizeArabicChars: boolean;
  normalizeWhitespace: boolean;
  fixPunctuationSpacing: boolean;
  normalizeZwnj: boolean;
}

export function normalizePersianText(text: string, opts: NormalizeOptions): string {
  let out = text;
  if (opts.normalizeArabicChars) {
    out = out
      .replace(/ي/g, 'ی')
      .replace(/ى/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .replace(/ۀ/g, 'ه‌ی')
      .replace(/أ|إ/g, 'ا')
      .replace(/ؤ/g, 'و');
  }
  if (opts.normalizeZwnj) {
    // Collapse repeated ZWNJs and remove ZWNJ adjacent to spaces/newlines
    out = out
      .replace(/\u200C{2,}/g, '\u200C')
      .replace(/\s+\u200C/g, ' ')
      .replace(/\u200C\s+/g, ' ');
  }
  if (opts.fixPunctuationSpacing) {
    // Remove space before Persian/Latin punctuation, ensure space after
    out = out
      .replace(/\s+([،؛؟!.:,])/g, '$1')
      .replace(/([،؛؟!])([^\s\n»"'\)\]])/g, '$1 $2');
  }
  if (opts.normalizeWhitespace) {
    out = out
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
  }
  return out;
}

export function countWordsAndChars(text: string) {
  const clean = text.trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean) : [];
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const sentences = clean
    ? clean
        .split(/(?<=[.!?؟؛\n])\s+/)
        .map((s) => s.trim())
        .filter(Boolean).length
    : 0;
  const paragraphs = clean
    ? clean
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean).length
    : 0;
  return {
    wordCount: words.length,
    charCount: chars,
    charCountNoSpaces: charsNoSpaces,
    sentenceCount: sentences,
    paragraphCount: paragraphs,
  };
}

export function estimateSpeakingDurationSec(
  text: string,
  speedMultiplier = 1.0,
  baseWpm = 140
): number {
  const { wordCount } = countWordsAndChars(text);
  if (wordCount === 0) return 0;
  const effectiveWpm = Math.max(60, baseWpm * Math.max(0.5, speedMultiplier));
  return Math.round((wordCount / effectiveWpm) * 60);
}

export function segmentParagraphsAndSentences(text: string): {
  paragraphs: string[];
  sentences: string[];
} {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences: string[] = [];
  for (const para of paragraphs) {
    const parts = para
      .split(/(?<=[.!?؟؛])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    sentences.push(...parts);
  }
  return { paragraphs, sentences };
}

/**
 * Splits long Persian text at paragraph/sentence boundaries safely under maxCharsPerChunk,
 * guaranteeing no words are lost or duplicated.
 */
export function splitTextIntoChunks(text: string, maxCharsPerChunk = 1200): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxCharsPerChunk) return [trimmed];

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
  };

  for (const para of paragraphs) {
    if (para.length <= maxCharsPerChunk) {
      if (current && current.length + 2 + para.length > maxCharsPerChunk) {
        pushCurrent();
      }
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }

    // Paragraph exceeds maxCharsPerChunk -> split by sentence boundaries
    const sentences = para
      .split(/(?<=[.!?؟؛])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      if (sentence.length <= maxCharsPerChunk) {
        if (current && current.length + 1 + sentence.length > maxCharsPerChunk) {
          pushCurrent();
        }
        current = current ? `${current} ${sentence}` : sentence;
        continue;
      }

      // Very long single sentence -> split cleanly at word boundaries
      pushCurrent();
      const words = sentence.split(/\s+/);
      let line = '';
      for (const word of words) {
        if (line && line.length + 1 + word.length > maxCharsPerChunk) {
          chunks.push(line.trim());
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      if (line.trim()) {
        chunks.push(line.trim());
      }
    }
    pushCurrent();
  }
  pushCurrent();
  return chunks;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPronunciationDictionary(
  text: string,
  entries: DictionaryEntry[]
): {
  speechReadyText: string;
  appliedRules: { original: string; spokenForm: string; count: number }[];
} {
  const active = [...entries]
    .filter((e) => e.enabled && e.original.trim() && e.spokenForm.trim())
    .sort((a, b) => b.priority - a.priority || b.original.length - a.original.length);

  let result = text;
  const appliedRules: { original: string; spokenForm: string; count: number }[] = [];

  for (const entry of active) {
    const orig = entry.original.trim();
    const isAscii = /^[A-Za-z0-9_\-.\s]+$/.test(orig);
    // Avoid expanding acronyms if user set acronymMode to 'as-is' and original looks like an all-caps acronym matching nothing custom
    if (entry.acronymMode === 'as-is' && entry.spokenForm === orig) {
      continue;
    }

    const pattern = isAscii
      ? new RegExp(`(?<![A-Za-z0-9])${escapeRegex(orig)}(?![A-Za-z0-9])`, 'g')
      : new RegExp(`(?<![\\u0600-\\u06FF])${escapeRegex(orig)}(?![\\u0600-\\u06FF])`, 'g');

    let count = 0;
    result = result.replace(pattern, () => {
      count++;
      return entry.spokenForm.trim();
    });

    if (count > 0) {
      appliedRules.push({
        original: orig,
        spokenForm: entry.spokenForm.trim(),
        count,
      });
    }
  }

  return { speechReadyText: result, appliedRules };
}

export function analyzeTargetDurationFeasibility(
  text: string,
  targetDurationSec: number
): {
  wordCount: number;
  requiredWpm: number;
  estimatedNaturalSec: number;
  feasible: boolean;
  severity: 'ok' | 'warning' | 'unrealistic';
  messageFa: string;
} {
  const { wordCount } = countWordsAndChars(text);
  const estimatedNaturalSec = estimateSpeakingDurationSec(text, 1.0, 140);
  if (!targetDurationSec || targetDurationSec <= 0 || wordCount === 0) {
    return {
      wordCount,
      requiredWpm: 0,
      estimatedNaturalSec,
      feasible: true,
      severity: 'ok',
      messageFa: 'مدت زمان هدف تعیین نشده است.',
    };
  }
  const requiredWpm = Math.round((wordCount / targetDurationSec) * 60);
  const ratio = estimatedNaturalSec / targetDurationSec;

  if (requiredWpm > 235 || ratio > 1.65) {
    return {
      wordCount,
      requiredWpm,
      estimatedNaturalSec,
      feasible: false,
      severity: 'unrealistic',
      messageFa: `متن دارای ${wordCount} واژه است؛ برای جا دادن آن در ${targetDurationSec} ثانیه، سرعت تقریبی ${requiredWpm} واژه بر دقیقه لازم است که وضوح گفتار فارسی را کاهش می‌دهد. پیشنهاد می‌شود متن خلاصه‌تر شود یا زمان هدف افزایش یابد.`,
    };
  }
  if (requiredWpm < 75 || ratio < 0.55) {
    return {
      wordCount,
      requiredWpm,
      estimatedNaturalSec,
      feasible: false,
      severity: 'warning',
      messageFa: `با ${wordCount} واژه، سرعت لازم حدود ${requiredWpm} واژه بر دقیقه است (بسیار کندتر از ریتم طبیعی ۱۴۰). استفاده از مکث‌های طبیعی بین جملات یا افزودن متن پیشنهاد می‌شود.`,
    };
  }
  if (requiredWpm > 175 || requiredWpm < 105) {
    return {
      wordCount,
      requiredWpm,
      estimatedNaturalSec,
      feasible: true,
      severity: 'warning',
      messageFa: `سرعت مورد نیاز حدود ${requiredWpm} واژه بر دقیقه است (نزدیک به مرز طبیعی). تنظیم کشش زمانی با حفظ زیربمی (Pitch-preserving) انجام خواهد شد.`,
    };
  }
  return {
    wordCount,
    requiredWpm,
    estimatedNaturalSec,
    feasible: true,
    severity: 'ok',
    messageFa: `زمان‌بندی بسیار متعادل است (حدود ${requiredWpm} واژه بر دقیقه؛ ریتم استاندارد فارسی).`,
  };
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}
