import path from 'path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export interface ImportedDocumentResult {
  filename: string;
  format: string;
  text: string;
  srtCues?: { index: number; start: string; end: string; text: string }[];
  warningsFa: string[];
  isLikelyScannedPdf?: boolean;
  pageCount?: number;
}

function parseSrtContent(raw: string): {
  plainText: string;
  cues: { index: number; start: string; end: string; text: string }[];
} {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const blocks = normalized.split(/\n{2,}/);
  const cues: { index: number; start: string; end: string; text: string }[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    let indexNum = cues.length + 1;
    if (/^\d+$/.test(lines[0])) {
      indexNum = parseInt(lines[0], 10);
      timeLineIdx = 1;
    }
    const timeLine = lines[timeLineIdx];
    const match = timeLine?.match(
      /^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!match) continue;
    const textLines = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (textLines) {
      cues.push({
        index: indexNum,
        start: match[1].replace(',', '.'),
        end: match[2].replace(',', '.'),
        text: textLines,
      });
    }
  }

  return {
    plainText: cues.map((c) => c.text).join('\n'),
    cues,
  };
}

export async function parseUploadedDocument(
  buffer: Buffer,
  originalName: string
): Promise<ImportedDocumentResult> {
  const ext = path.extname(originalName).toLowerCase();
  const warningsFa: string[] = [];

  if (ext === '.txt' || ext === '.md') {
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '').trim();
    if (!text) {
      warningsFa.push('فایل متنی انتخاب‌شده خالی است.');
    }
    return {
      filename: originalName,
      format: ext.replace('.', '').toUpperCase(),
      text,
      warningsFa,
    };
  }

  if (ext === '.srt') {
    const raw = buffer.toString('utf-8');
    const { plainText, cues } = parseSrtContent(raw);
    if (cues.length === 0) {
      warningsFa.push('ساختار زمان‌بندی استاندارد SRT در فایل یافت نشد؛ متن خام بررسی شود.');
      return {
        filename: originalName,
        format: 'SRT',
        text: raw.trim(),
        warningsFa,
      };
    }
    return {
      filename: originalName,
      format: 'SRT',
      text: plainText,
      srtCues: cues,
      warningsFa,
    };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (result.messages?.length) {
      warningsFa.push(`برخی عناصر غیرمتنی DOCX نادیده گرفته شدند (${result.messages.length} مورد).`);
    }
    if (!text) {
      warningsFa.push('متن قابل استخراجی در فایل DOCX یافت نشد.');
    }
    return {
      filename: originalName,
      format: 'DOCX',
      text,
      warningsFa,
    };
  }

  if (ext === '.pdf') {
    const uint8 = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    const { totalPages, text: extracted } = await extractText(pdf, { mergePages: true });
    const cleanText = (extracted || '').trim();
    const avgCharsPerPage = totalPages > 0 ? cleanText.length / totalPages : cleanText.length;
    const isLikelyScannedPdf = cleanText.length < 25 || (totalPages >= 1 && avgCharsPerPage < 20);

    if (isLikelyScannedPdf) {
      warningsFa.push(
        'این فایل PDF به نظر می‌رسد اسکن‌شده (تصویری) است یا فاقد لایه متن قابل استخراج است. برای جلوگیری از افت محتوا، متن آن خالی یا ناقص گزارش می‌شود؛ لطفاً از نسخه متنی یا ابزار OCR استفاده کنید.'
      );
    }

    return {
      filename: originalName,
      format: 'PDF',
      text: cleanText,
      warningsFa,
      isLikelyScannedPdf,
      pageCount: totalPages,
    };
  }

  throw new Error('فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: TXT، MD، SRT، DOCX، PDF');
}
