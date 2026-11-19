import React from 'react';
import {
  CheckCircle2,
  Keyboard,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
  XCircle,
} from 'lucide-react';
import type { ModelsDiscoveryResponse } from '../types/studio';

interface SettingsTabProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  discovery: ModelsDiscoveryResponse | null;
  ffmpegAvailable: boolean;
  onRefreshModels: () => Promise<void>;
  refreshing: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  theme,
  onToggleTheme,
  discovery,
  ffmpegAvailable,
  onRefreshModels,
  refreshing,
}) => {
  return (
    <div className="space-y-6">
      {/* Appearance & Environment Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            ظاهر و تنظیمات رابط کاربری
          </h2>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                پوسته نمایشی (تم روشن / تیره)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                انتخاب شما به صورت خودکار در مرورگر ذخیره می‌شود.
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="studio-focus inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>تغییر به تم روشن</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span>تغییر به تم تیره استودیویی</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">وضعیت کلید Gemini در سرور:</span>
              {discovery?.apiConfigured ? (
                <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>پیکربندی‌شده (امن در سمت سرور)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                  <XCircle className="w-4 h-4" />
                  <span>تنظیم نشده در محیط سرور</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">موتور پردازش صوتی FFmpeg:</span>
              {ffmpegAvailable ? (
                <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>فعال (MP3 / WAV / FLAC / M4A / OGG)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                  <XCircle className="w-4 h-4" />
                  <span>در دسترس نیست</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              میانبرهای صفحه‌کلید
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">ذخیره سریع پروژه در سرور</span>
              <kbd dir="ltr" className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Ctrl + S</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">پخش / توقف روی موج صوتی متمرکز</span>
              <kbd dir="ltr" className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Space</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">عقب / جلو بردن پخش (۲ ثانیه)</span>
              <kbd dir="ltr" className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">← / →</kbd>
            </div>
          </div>
        </section>
      </div>

      {/* Live Discovered Models Matrix */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              مدل‌های کشف‌شده و ماتریس قابلیت‌های واقعی
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              بررسی خودکار از API جمینای؛ زمان تاخیر و هزینه نسبی بر اساس برآورد تقریبی است.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefreshModels}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>بررسی مجدد مدل‌ها</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 px-2 font-medium">شناسه مدل</th>
                <th className="py-2 px-2 font-medium">نقش</th>
                <th className="py-2 px-2 font-medium">وضعیت در محیط</th>
                <th className="py-2 px-2 font-medium">کیفیت / کاربرد</th>
                <th className="py-2 px-2 font-medium">تخمین تاخیر</th>
                <th className="py-2 px-2 font-medium">تخمین هزینه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(discovery?.models || []).map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    <div>{m.id}</div>
                    <div className="text-[11px] font-sans font-normal text-slate-500 mt-0.5">
                      {m.notesFa}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                    {m.family === 'tts' ? 'سنتز گفتار (TTS)' : 'پردازش زبان فارسی'}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`font-semibold ${
                        m.availableInEnv
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {m.availableInEnv
                        ? m.verifiedByListApi
                          ? 'تاییدشده در List API'
                          : 'فعال (مستند SDK)'
                        : 'ناموجود'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                    {m.qualityTierFa}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">
                    {m.latencyEstimateFa}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">
                    {m.relativeCostEstimateFa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Persian Setup, Security & Deployment Guide */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            راهنمای راه‌اندازی، امنیت و استقرار مستقل (Deployment Guide)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-7 text-slate-700 dark:text-slate-300">
          <div className="rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>اصول امنیتی پیاده‌سازی‌شده</span>
            </div>
            <ul className="list-disc pr-4 space-y-1">
              <li>تمامی فراخوانی‌های <span className="font-mono">@google/genai</span> منحصراً در سمت سرور Node.js اجرا می‌شوند و کلید <span className="font-mono">GEMINI_API_KEY</span> هرگز به مرورگر ارسال نمی‌شود.</li>
              <li>اجرای ابزارهای FFmpeg و FFprobe بدون فراخوانی Shell و با <span className="font-mono">execFile</span> انجام می‌شود تا از تزریق دستور جلوگیری شود.</li>
              <li>شناسه‌های فایل و پروژه با regex معتبرسازی می‌شوند تا امکان Path Traversal وجود نداشته باشد.</li>
              <li>آپلود فایل‌ها دارای محدودیت حجم (۱۵ مگابایت) و فهرست سفید فرمت‌های مجاز است.</li>
            </ul>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              دستورات اجرا و استقرار خارج از AI Studio
            </div>
            <pre dir="ltr" className="rounded bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto leading-6">
{`# 1. تنظیم متغیرهای محیطی در سرور
export GEMINI_API_KEY="YOUR_SECRET_KEY"
export PORT=3000

# 2. نصب وابستگی‌ها و ساخت نسخه تولید
npm install
npm run build

# 3. اجرای سرور امن (نیازمند ffmpeg در سیستم)
npm start`}
            </pre>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              هشدار: هرگز فایل HTML استاتیک حاوی کلید API را مستقیماً در هاست عمومی منتشر نکنید؛ همواره درخواست‌ها را از طریق این سرور Node.js مسیریابی کنید.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
