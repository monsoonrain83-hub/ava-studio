import React, { useState } from 'react';
import { Download, FileText, Info, X } from 'lucide-react';
import { downloadExportedAudio } from '../services/api';
import type { AudioArtifact, ExportFormat, ExportOptions } from '../types/studio';

interface ExportModalProps {
  artifact: AudioArtifact;
  onClose: () => void;
}

function toSrtTimestamp(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export const ExportModal: React.FC<ExportModalProps> = ({ artifact, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('mp3');
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(192);
  const [sampleRate, setSampleRate] = useState<16000 | 22050 | 24000 | 44100 | 48000>(24000);
  const [channels, setChannels] = useState<1 | 2>(1);
  const [filename, setFilename] = useState(
    artifact.title.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_') || 'ava-studio'
  );
  const [downloading, setDownloading] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  const handleExport = async () => {
    setDownloading(true);
    setErrorFa(null);
    try {
      const opts: ExportOptions = {
        format,
        mp3BitrateKbps: mp3Bitrate,
        sampleRate,
        channels,
        filename,
        titleMeta: artifact.title,
        artistMeta: `آوا استودیو - ${artifact.personaNameFa}`,
      };
      await downloadExportedAudio(artifact.id, opts);
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در دریافت خروجی.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSubtitle = (subFormat: 'srt' | 'vtt') => {
    if (!artifact.segmentMarkers?.length) return;
    let content = '';
    if (subFormat === 'vtt') {
      content = 'WEBVTT\n\n';
      artifact.segmentMarkers.forEach((seg, idx) => {
        content += `${idx + 1}\n${toSrtTimestamp(seg.startSec).replace(',', '.')} --> ${toSrtTimestamp(seg.endSec).replace(',', '.')}\n${seg.label}\n\n`;
      });
    } else {
      artifact.segmentMarkers.forEach((seg, idx) => {
        content += `${idx + 1}\n${toSrtTimestamp(seg.startSec)} --> ${toSrtTimestamp(seg.endSec)}\n${seg.label}\n\n`;
      });
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || 'subtitles'}.${subFormat}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h2 id="export-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            خروجی و دانلود فایل صوتی
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره خروجی"
            className="studio-focus p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              نام فایل خروجی
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                فرمت صوتی
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="mp3">MP3 (سازگار و فشرده)</option>
                <option value="wav">WAV (بدون افت - PCM)</option>
                <option value="flac">FLAC (فشرده‌سازی بدون افت)</option>
                <option value="m4a">M4A / AAC</option>
                <option value="ogg">OGG / Opus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                نرخ نمونه‌برداری (Sample Rate)
              </label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value) as 16000 | 22050 | 24000 | 44100 | 48000)}
                className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
              >
                <option value={24000}>24000 Hz (نرخ بومی مدل)</option>
                <option value={44100}>44100 Hz (استاندارد CD)</option>
                <option value={48000}>48000 Hz (ویدیو و پخش)</option>
                <option value={22050}>22050 Hz</option>
                <option value={16000}>16000 Hz (تلفنی/سبک)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {format === 'mp3' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  نرخ بیت MP3
                </label>
                <select
                  value={mp3Bitrate}
                  onChange={(e) => setMp3Bitrate(Number(e.target.value) as 128 | 192 | 256 | 320)}
                  className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
                >
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps (پیشنهادی)</option>
                  <option value={256}>256 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                کانال صوتی
              </label>
              <select
                value={channels}
                onChange={(e) => setChannels(Number(e.target.value) as 1 | 2)}
                className="studio-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value={1}>مونو (تک‌کاناله - بومی گفتار)</option>
                <option value={2}>استریو (دوکاناله)</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
            <span>
              صوت پایه با نرخ نمونه‌برداری بومی 24kHz تولید شده است؛ انتخاب نرخ نمونه‌برداری یا بیت‌ریت بالاتر صرفاً برای سازگاری با نرم‌افزارهای تدوین است و کیفیت اصلی تولیدشده را افزایش نمی‌دهد.
            </span>
          </div>

          {artifact.segmentMarkers && artifact.segmentMarkers.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                زیرنویس زمان‌بندی‌شده بر پایه قطعات واقعی:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSubtitle('srt')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>SRT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSubtitle('vtt')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>VTT</span>
                </button>
              </div>
            </div>
          )}

          {errorFa && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
              {errorFa}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="studio-focus px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={handleExport}
            className="studio-focus inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'در حال رمزگذاری...' : `دانلود ${format.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
