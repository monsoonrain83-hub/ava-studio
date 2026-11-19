import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { REAL_PREBUILT_VOICES } from '../src/data/catalog.ts';
import type {
  DiacritizeDiffItem,
  DialogueTurn,
  DiscoveredModel,
  ModelsDiscoveryResponse,
  PauseSuggestion,
  RealVoiceId,
} from '../src/types/studio.ts';

function getClient(apiVersion = 'v1beta'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('کلید دسترسی Gemini در محیط سرور پیکربندی نشده است.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isApiKeyConfigured(): boolean {
  const k = process.env.GEMINI_API_KEY;
  return Boolean(k && k.trim() && k !== 'MY_GEMINI_API_KEY');
}

export function translateGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('کلید دسترسی')) return msg;
  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid')) {
    return 'کلید API معتبر نیست یا دسترسی لازم را ندارد. لطفاً تنظیمات کلید در پنل Secrets را بررسی کنید.';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return 'سهمیه درخواست یا محدودیت نرخ فراخوانی (Rate Limit) تکمیل شده است. کمی صبر کنید یا از مدل سبک‌تر استفاده نمایید.';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return 'سرویس مدل در این لحظه با ترافیک بالا روبه‌رو است (503). لطفاً چند لحظه بعد دوباره تلاش کنید.';
  }
  if (lower.includes('404') || lower.includes('not_found') || lower.includes('not found')) {
    return 'مدل انتخاب‌شده در این محیط در دسترس نیست. حالت انتخاب خودکار مدل را فعال کنید یا مدل دیگری برگزینید.';
  }
  if (lower.includes('timeout') || lower.includes('econnreset') || lower.includes('fetch failed')) {
    return 'خطا در برقراری ارتباط شبکه با سرویس سنتز گفتار. لطفاً دوباره تلاش کنید.';
  }
  return `خطا در پردازش هوش مصنوعی: ${msg}`;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('resource_exhausted') ||
        msg.includes('unavailable') ||
        msg.includes('timeout');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 700 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

let cachedDiscovery: { data: ModelsDiscoveryResponse; expiresAt: number } | null = null;

const KNOWN_CATALOG_MODELS: Omit<DiscoveredModel, 'availableInEnv' | 'verifiedByListApi'>[] = [
  {
    id: 'gemini-3.8-flash-lite-tts',
    displayName: 'Gemini 3.8 Flash Lite TTS',
    family: 'tts',
    supportsAudioOutput: true,
    supportsMultiSpeaker: false,
    supportsVoiceDesign: false,
    supportsStreamingPcm: true,
    qualityTierFa: 'کیفیت بالا و پایدار (پیشنهادی عمومی)',
    latencyEstimateFa: 'سریع (تخمین ۱ تا ۳ ثانیه)',
    relativeCostEstimateFa: 'اقتصادی (تخمین پایین)',
    notesFa: 'مدل استاندارد تبدیل متن به گفتار تک‌گوینده با خروجی WAV 24kHz و جریان PCM.',
  },
  {
    id: 'gemini-3.8-flash-tts',
    displayName: 'Gemini 3.8 Flash TTS',
    family: 'tts',
    supportsAudioOutput: true,
    supportsMultiSpeaker: true,
    supportsVoiceDesign: true,
    supportsStreamingPcm: true,
    qualityTierFa: 'پرچم‌دار طراحی صدا و دیالوگ',
    latencyEstimateFa: 'متوسط (تخمین ۲ تا ۵ ثانیه)',
    relativeCostEstimateFa: 'متوسط (تخمین استاندارد)',
    notesFa: 'پشتیبانی از دیالوگ دوگوینده همزمان، طراحی لحن (Voice Design)، مکث و واکنش صوتی (<breath>، |mhm|).',
  },
  {
    id: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    family: 'text',
    supportsAudioOutput: false,
    supportsMultiSpeaker: false,
    supportsVoiceDesign: false,
    supportsStreamingPcm: false,
    qualityTierFa: 'مدل اصلی پردازش زبان فارسی',
    latencyEstimateFa: 'سریع (تخمین ۱ تا ۲ ثانیه)',
    relativeCostEstimateFa: 'اقتصادی (تخمین پایین)',
    notesFa: 'مخصوص اعراب‌گذاری هوشمند زمینه‌محور، تشخیص ابهام تلفظی و پیشنهاد مکث.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    family: 'text',
    supportsAudioOutput: false,
    supportsMultiSpeaker: false,
    supportsVoiceDesign: false,
    supportsStreamingPcm: false,
    qualityTierFa: 'مدل سبک پشتیبان متن',
    latencyEstimateFa: 'بسیار سریع (تخمین کمتر از ۱ ثانیه)',
    relativeCostEstimateFa: 'بسیار اقتصادی (تخمین پایین)',
    notesFa: 'جایگزین سریع برای پردازش‌های متنی سبک در صورت نیاز.',
  },
];

export async function discoverModels(forceRefresh = false): Promise<ModelsDiscoveryResponse> {
  if (!forceRefresh && cachedDiscovery && cachedDiscovery.expiresAt > Date.now()) {
    return cachedDiscovery.data;
  }

  const configured = isApiKeyConfigured();
  if (!configured) {
    return {
      apiConfigured: false,
      discoverySource: 'verified-fallback',
      discoveredAt: new Date().toISOString(),
      models: KNOWN_CATALOG_MODELS.map((m) => ({
        ...m,
        availableInEnv: false,
        verifiedByListApi: false,
      })),
      realVoices: REAL_PREBUILT_VOICES,
      customVoiceCloningSupported: false,
      customVoiceNoteFa:
        'کلید API تنظیم نشده است؛ امکان بررسی زنده مدل‌ها و ساخت صدای اختصاصی وجود ندارد.',
      errorFa: 'کلید دسترسی Gemini در سرور تنظیم نشده است.',
    };
  }

  try {
    const ai = getClient();
    const listedNames = new Set<string>();
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      if (m?.name) {
        listedNames.add(m.name.replace(/^models\//, ''));
      }
    }

    const models: DiscoveredModel[] = KNOWN_CATALOG_MODELS.map((known) => {
      const inList = listedNames.has(known.id);
      return {
        ...known,
        verifiedByListApi: inList,
        // Even if models.list filters preview/specialized endpoints, SDK-documented 3.8 TTS & 4-hydrogen remain callable; mark clearly
        availableInEnv: inList || known.id.startsWith('gemini-3.8-') || known.id === 'gemini-4-hydrogen' || known.id === 'gemini-3.1-flash-lite',
      };
    });

    // Surface any additional real TTS models discovered in ai.models.list() (e.g., gemini-2.5-*-tts)
    for (const rawName of listedNames) {
      if (
        rawName.includes('tts') &&
        !models.some((m) => m.id === rawName)
      ) {
        models.push({
          id: rawName,
          displayName: rawName,
          family: 'tts',
          availableInEnv: true,
          verifiedByListApi: true,
          supportsAudioOutput: true,
          supportsMultiSpeaker: rawName.includes('pro') || rawName.includes('flash-tts'),
          supportsVoiceDesign: rawName.includes('3.8-flash-tts'),
          supportsStreamingPcm: true,
          qualityTierFa: 'کشف‌شده از API زنده',
          latencyEstimateFa: 'تخمین بسته به طول متن',
          relativeCostEstimateFa: 'بر اساس تعرفه مدل',
          notesFa: 'این شناسه مدل مستقیماً توسط فهرست زنده API در این محیط برگردانده شده است.',
        });
      }
    }

    const result: ModelsDiscoveryResponse = {
      apiConfigured: true,
      discoverySource: listedNames.size > 0 ? 'live-api' : 'verified-fallback',
      discoveredAt: new Date().toISOString(),
      models,
      realVoices: REAL_PREBUILT_VOICES,
      customVoiceCloningSupported: false,
      customVoiceNoteFa:
        'در نسخه فعلی API گوگل جمینای، شناسه‌های صدای پیش‌ساخته واقعی شامل ۵ صدای رسمی (Kore، Puck، Charon، Fenrir، Zephyr) است و امکان ثبت یا کلون صدای اختصاصی با شناسه پایدار ارائه نشده است. پرسونای فارسی به همراه دستور سبک روی مدل‌های پشتیبانی‌شده اجرا می‌شود.',
    };

    cachedDiscovery = {
      data: result,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return result;
  } catch (err) {
    const result: ModelsDiscoveryResponse = {
      apiConfigured: true,
      discoverySource: 'verified-fallback',
      discoveredAt: new Date().toISOString(),
      models: KNOWN_CATALOG_MODELS.map((m) => ({
        ...m,
        availableInEnv: true,
        verifiedByListApi: false,
      })),
      realVoices: REAL_PREBUILT_VOICES,
      customVoiceCloningSupported: false,
      customVoiceNoteFa:
        'کشف خودکار فهرست مدل‌ها با خطا روبه‌رو شد؛ مدل‌های مستندشده SDK با بررسی زمان اجرا استفاده می‌شوند.',
      errorFa: translateGeminiError(err),
    };
    return result;
  }
}

export interface TtsSynthesisResult {
  wavBuffer: Buffer;
  modelUsed: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export async function synthesizeSingleSpeaker(params: {
  modelId: string;
  autoModel: boolean;
  text: string;
  voiceId: RealVoiceId;
  stylePrompt?: string;
}): Promise<TtsSynthesisResult> {
  const ai = getClient();
  const primaryModel = params.modelId || 'gemini-3.8-flash-lite-tts';
  const fallbackModel =
    primaryModel === 'gemini-3.8-flash-lite-tts'
      ? 'gemini-3.8-flash-tts'
      : 'gemini-3.8-flash-lite-tts';

  const runWithModel = async (modelToUse: string): Promise<TtsSynthesisResult> => {
    const part: { text: string; speechMetadata?: { style?: string } } = {
      text: params.text,
    };
    if (params.stylePrompt && params.stylePrompt.trim()) {
      part.speechMetadata = { style: params.stylePrompt.trim() };
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: 'user', parts: [part] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: params.voiceId || 'Kore',
              },
            },
          },
        },
      })
    );

    const parts = response.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('پاسخ صوتی معتبری از مدل دریافت نشد.');
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    const estimatedTokens = Math.max(10, Math.ceil(params.text.length / 3));
    const ratePerMillion = modelToUse.includes('lite') ? 0.5 : 1.5;
    const estimatedCostUsd = Number(((estimatedTokens / 1_000_000) * ratePerMillion).toFixed(6));

    return {
      wavBuffer,
      modelUsed: modelToUse,
      estimatedTokens,
      estimatedCostUsd,
    };
  };

  try {
    return await runWithModel(primaryModel);
  } catch (err) {
    if (params.autoModel && fallbackModel !== primaryModel) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('404') || msg.includes('not_found') || msg.includes('not found') || msg.includes('unsupported')) {
        return await runWithModel(fallbackModel);
      }
    }
    throw err;
  }
}

export async function synthesizeDualSpeakerNative(params: {
  turns: DialogueTurn[];
}): Promise<TtsSynthesisResult> {
  const ai = getClient();
  const uniqueSpeakers = Array.from(
    new Map(
      params.turns.map((t) => [t.speakerLabel.trim(), t.voiceId])
    ).entries()
  );

  if (uniqueSpeakers.length !== 2) {
    throw new Error('حالت بومی چندگوینده فقط دقیقاً با ۲ گوینده مجزا پشتیبانی می‌شود.');
  }

  const parts = params.turns.map((turn) => ({
    text: `${turn.speakerLabel.trim()}: ${turn.text.trim()}`,
    speechMetadata: {
      speaker: turn.speakerLabel.trim(),
      style: turn.stylePrompt?.trim() || 'Natural Iranian Persian dialogue',
    },
  }));

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: uniqueSpeakers.map(([speaker, voiceName]) => ({
              speaker,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            })),
          },
        },
      },
    })
  );

  const respParts = response.candidates?.[0]?.content?.parts || [];
  const audioPart = respParts.find((p) => p.inlineData?.data);
  const base64Audio = audioPart?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('فایل صوتی از مدل دیالوگ دوگوینده دریافت نشد.');
  }

  const totalChars = params.turns.reduce((acc, t) => acc + t.text.length, 0);
  const estimatedTokens = Math.max(20, Math.ceil(totalChars / 3));

  return {
    wavBuffer: Buffer.from(base64Audio, 'base64'),
    modelUsed: 'gemini-3.8-flash-tts',
    estimatedTokens,
    estimatedCostUsd: Number(((estimatedTokens / 1_000_000) * 1.5).toFixed(6)),
  };
}

export async function diacritizePersianText(
  text: string,
  domainHint = 'عمومی و استاندارد فارسی'
): Promise<{
  diacritizedText: string;
  items: DiacritizeDiffItem[];
  modelUsed: string;
}> {
  const ai = getClient();
  const modelId = 'gemini-4-hydrogen';

  const systemInstruction = `شما یک زبان‌شناس متخصص زبان فارسی و مهندس تلفظ گفتار (TTS) هستید.
وظیفه شما اعراب‌گذاری هوشمند و دقیق متن فارسی برای تلفظ صحیح توسط موتور تبدیل متن به گفتار است.
قوانین بسیار مهم:
۱. به هیچ وجه واژه‌ها را تغییر ندهید، حذف نکنید، جایگزین نکنید یا ترتیب کلمات، اعداد، علائم سجاوندی و سطرها را عوض نکنید.
۲. فقط حرکات ضروری فارسی (فتحه‌ ـَ، کسره‌ ـِ، ضمه‌ ـُ، تشدید ـّ، کسره اضافه ـِ، تنوین، یا سکون در موارد مبهم) را به کلمات مبهم، کسره اضافه، واژگان هم‌نگاره (مثل مُهر/مِهر، دَر/دُر، کَرم/کِرم، شَکر/شُکر، گُل/گِل) و نام‌های خاص اضافه کنید.
۳. از اعراب‌گذاری افراطی روی همه حروف خودداری کنید؛ فقط جایی اعراب بگذارید که ابهام تلفظی وجود دارد یا برای آهنگ کسره اضافه و تلفظ دقیق ضروری است.
۴. متن را به صورت آرایه‌ای از واژگان/بخش‌های دقیق به ترتیب متن اصلی برگردانید تا با چسباندن با فاصله، عین ساختار متن حفظ شود. اگر کلمه‌ای نیازی به تغییر ندارد changed را false بگذارید و suggested را دقیقاً برابر original بگذارید.`;

  const prompt = `زمینه متن: ${domainHint}
متن برای اعراب‌گذاری:
"""
${text}
"""`;

  let usedModel = modelId;
  const callTextModel = async (targetModel: string, retries = 0) =>
    withRetry(
      () =>
        ai.models.generateContent({
          model: targetModel,
          contents: prompt,
          config: {
            systemInstruction,
            ...(targetModel === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tokens: {
                  type: Type.ARRAY,
                  description: 'آرایه ترتیبی توکن‌های متن با حفظ کامل نظم واژگان و علائم',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original: { type: Type.STRING },
                      suggested: { type: Type.STRING },
                      changed: { type: Type.BOOLEAN },
                      confidence: {
                        type: Type.STRING,
                        description: 'high یا medium یا low',
                      },
                      reasonFa: {
                        type: Type.STRING,
                        description: 'توضیح کوتاه فارسی علت اعراب یا ابهام‌زدایی (در صورت تغییر)',
                      },
                    },
                    required: ['original', 'suggested', 'changed', 'confidence', 'reasonFa'],
                  },
                },
              },
              required: ['tokens'],
            },
          },
        }),
      retries
    );

  let response;
  try {
    response = await Promise.race([
      callTextModel(modelId, 0),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('primary_timeout')), 5000)
      ),
    ]);
  } catch {
    usedModel = 'gemini-3.1-flash-lite';
    response = await callTextModel(usedModel, 0);
  }

  const parsed = JSON.parse((response.text || '{"tokens":[]}').trim()) as {
    tokens: {
      original: string;
      suggested: string;
      changed: boolean;
      confidence: string;
      reasonFa: string;
    }[];
  };

  const items: DiacritizeDiffItem[] = (parsed.tokens || []).map((t, index) => {
    const conf =
      t.confidence === 'low' || t.confidence === 'medium' || t.confidence === 'high'
        ? t.confidence
        : 'high';
    const isChanged = Boolean(t.changed && t.suggested && t.suggested !== t.original);
    return {
      id: `tok-${index}`,
      index,
      original: t.original,
      suggested: isChanged ? t.suggested : t.original,
      reasonFa: t.reasonFa || (isChanged ? 'ابهام‌زدایی تلفظی' : ''),
      confidence: conf,
      changed: isChanged,
      status: isChanged ? 'pending' : 'accepted',
      finalText: isChanged ? t.suggested : t.original,
    };
  });

  const diacritizedText = items.map((i) => i.finalText).join(' ');

  return {
    diacritizedText,
    items,
    modelUsed: usedModel,
  };
}

export async function suggestNarrationPauses(text: string): Promise<{
  suggestions: PauseSuggestion[];
  modelUsed: string;
}> {
  const ai = getClient();
  let modelId = 'gemini-4-hydrogen';

  const callPause = (targetModel: string, retries = 0) =>
    withRetry(
      () =>
        ai.models.generateContent({
          model: targetModel,
          contents: `برای متن فارسی زیر، حداکثر ۶ پیشنهاد سجاوندی یا مکث نفس‌گیری (ویرگول، مکث کوتاه با خط تیره یا شکست بند) برای گویندگی طبیعی پیشنهاد بده، بدون آنکه واژه‌ها را تغییر دهی:\n\n${text}`,
          config: {
            thinkingConfig:
              targetModel === 'gemini-4-hydrogen'
                ? { thinkingLevel: ThinkingLevel.LOW }
                : { thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      targetPhrase: { type: Type.STRING },
                      suggestedText: { type: Type.STRING },
                      reasonFa: { type: Type.STRING },
                    },
                    required: ['targetPhrase', 'suggestedText', 'reasonFa'],
                  },
                },
              },
              required: ['suggestions'],
            },
          },
        }),
      retries
    );

  let response;
  try {
    response = await Promise.race([
      callPause(modelId, 0),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('primary_timeout')), 8000)
      ),
    ]);
  } catch {
    modelId = 'gemini-3.1-flash-lite';
    response = await callPause(modelId, 1);
  }

  const parsed = JSON.parse((response.text || '{"suggestions":[]}').trim()) as {
    suggestions: { targetPhrase: string; suggestedText: string; reasonFa: string }[];
  };

  return {
    suggestions: (parsed.suggestions || []).map((s, idx) => ({
      id: `pause-${idx}`,
      targetPhrase: s.targetPhrase,
      suggestedText: s.suggestedText,
      reasonFa: s.reasonFa,
      applied: false,
    })),
    modelUsed: modelId,
  };
}
