import type {
  DictionaryEntry,
  RealVoiceInfo,
  SpeakingStyle,
  SpeechControlsConfig,
  VoicePersona,
} from '../types/studio';

/** The five actual prebuilt voice IDs used by the Gemini TTS voice picker. */
export const REAL_PREBUILT_VOICES: RealVoiceInfo[] = [
  { id: 'Kore', labelFa: 'کوره (Kore)', timbreNoteFa: 'صدای رسا و متعادل؛ مناسب خبر و تحلیل', supportedModels: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] },
  { id: 'Puck', labelFa: 'پاک (Puck)', timbreNoteFa: 'سرزنده و محاوره‌ای؛ مناسب پادکست', supportedModels: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] },
  { id: 'Charon', labelFa: 'شارون (Charon)', timbreNoteFa: 'لحن آرام و جدی؛ مناسب روایت مستند', supportedModels: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] },
  { id: 'Fenrir', labelFa: 'فنریر (Fenrir)', timbreNoteFa: 'بیان پرانرژی؛ مناسب گزارش میدانی', supportedModels: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] },
  { id: 'Zephyr', labelFa: 'زفیر (Zephyr)', timbreNoteFa: 'بیان نرم؛ مناسب روایت و ادبیات', supportedModels: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] },
];

/** Personas are prompt presets mapped to prebuilt voices, not synthesized clones. */
export const VOICE_PERSONAS: VoicePersona[] = [
  { id: 'yalda', displayNameFa: 'یلدا', mappedVoiceId: 'Kore', roleSummaryFa: 'گوینده تحلیل‌های هواشناسی', qualities: ['علمی', 'جدی', 'خبری'], recommendedStyleId: 'synoptic-analysis', styleDirectionEn: 'Read Persian meteorological analysis clearly and naturally, with precise scientific terminology and controlled emphasis. Avoid dramatization.', isCustomVoiceSupported: false },
  { id: 'arman', displayNameFa: 'آرمان', mappedVoiceId: 'Kore', roleSummaryFa: 'گوینده خبر رسمی', qualities: ['خبری', 'جدی'], recommendedStyleId: 'formal-news', styleDirectionEn: 'Use a professional Persian newscast delivery, steady pace, concise pauses, confident articulation.', isCustomVoiceSupported: false },
  { id: 'mehrad', displayNameFa: 'مهراد', mappedVoiceId: 'Zephyr', roleSummaryFa: 'راوی شعر و ادبیات', qualities: ['شاعرانه', 'آرام', 'گرم'], recommendedStyleId: 'persian-poetry', styleDirectionEn: 'Deliver literary Persian with natural cadence and expressive but restrained poetic pauses.', isCustomVoiceSupported: false },
  { id: 'sara', displayNameFa: 'سارا', mappedVoiceId: 'Puck', roleSummaryFa: 'میزبان پادکست', qualities: ['محاوره‌ای', 'گرم', 'پرشتاب'], recommendedStyleId: 'friendly-podcast', styleDirectionEn: 'Speak conversational Persian naturally, like a knowledgeable podcast host, with fluid phrasing.', isCustomVoiceSupported: false },
  { id: 'dariush', displayNameFa: 'داریوش', mappedVoiceId: 'Charon', roleSummaryFa: 'راوی مستند علمی', qualities: ['مستند', 'علمی', 'آرام'], recommendedStyleId: 'science-documentary', styleDirectionEn: 'Narrate Persian scientific documentary text in a calm, authoritative and accessible manner.', isCustomVoiceSupported: false },
  { id: 'nima', displayNameFa: 'نیما', mappedVoiceId: 'Fenrir', roleSummaryFa: 'خبرنگار میدانی', qualities: ['خبری', 'پرشتاب'], recommendedStyleId: 'field-report', styleDirectionEn: 'Deliver concise Persian field reports with clear energy, without exaggerated urgency.', isCustomVoiceSupported: false },
  { id: 'nazanin', displayNameFa: 'نازنین', mappedVoiceId: 'Zephyr', roleSummaryFa: 'راوی داستان', qualities: ['داستانی', 'گرم'], recommendedStyleId: 'storytelling', styleDirectionEn: 'Narrate Persian stories warmly with expressive phrasing and stable character voices.', isCustomVoiceSupported: false },
  { id: 'behzad', displayNameFa: 'بهزاد', mappedVoiceId: 'Charon', roleSummaryFa: 'گوینده هشدارهای جوی', qualities: ['جدی', 'خبری', 'علمی'], recommendedStyleId: 'weather-warning', styleDirectionEn: 'Announce Persian weather warnings decisively, with strong clarity and without alarmist delivery.', isCustomVoiceSupported: false },
];

export const SPEAKING_STYLES: SpeakingStyle[] = [
  { id: 'synoptic-analysis', nameFa: 'تحلیل سینوپتیکی', categoryFa: 'هواشناسی و اقلیم', descriptionFa: 'تحلیل دقیق نقشه‌ها و الگوهای جوی با لحن طبیعی', stylePromptEn: 'Speak fluent Persian like an experienced meteorologist analyzing synoptic charts. Use confident but conversational delivery. Pronounce scientific terms precisely, with short natural pauses.', recommendedPacing: 'normal', recommendedPauseMs: 350 },
  { id: 'seasonal-outlook', nameFa: 'چشم‌انداز فصلی', categoryFa: 'هواشناسی و اقلیم', descriptionFa: 'تبیین عدم‌قطعیت و سناریوهای اقلیمی', stylePromptEn: 'Present a Persian seasonal forecast with measured confidence. Distinguish probability and certainty, articulate climate indices, and avoid categorical predictions.', recommendedPacing: 'normal', recommendedPauseMs: 420 },
  { id: 'weather-warning', nameFa: 'هشدار مخاطرات جوی', categoryFa: 'هواشناسی و اقلیم', descriptionFa: 'خوانش محکم و واضح هشدارهای جوی', stylePromptEn: 'Read Persian meteorological warnings clearly, seriously and with understandable urgency. Keep all numbers and locations intelligible, without dramatic exaggeration.', recommendedPacing: 'normal', recommendedPauseMs: 450 },
  { id: 'weather-bulletin', nameFa: 'بولتن پیش‌بینی هوا', categoryFa: 'هواشناسی و اقلیم', descriptionFa: 'خبر کوتاه و روان برای عموم', stylePromptEn: 'Deliver a fluent Persian weather bulletin in a friendly broadcast tone. Highlight places, timing, and forecast uncertainties naturally.', recommendedPacing: 'normal', recommendedPauseMs: 330 },
  { id: 'formal-news', nameFa: 'خبر رسمی', categoryFa: 'خبری و میدانی', descriptionFa: 'صدای حرفه‌ای و منظم خبر', stylePromptEn: 'Read formal Persian news with clean articulation, even pacing and professional emphasis, never monotonous.', recommendedPacing: 'normal', recommendedPauseMs: 350 },
  { id: 'field-report', nameFa: 'گزارش میدانی', categoryFa: 'خبری و میدانی', descriptionFa: 'روایت زنده، دقیق و پرانرژی', stylePromptEn: 'Speak Persian as an on-scene reporter: vivid and energetic, but controlled and precise with names and numbers.', recommendedPacing: 'fast', recommendedPauseMs: 250 },
  { id: 'interview', nameFa: 'گفت‌وگوی خبری', categoryFa: 'خبری و میدانی', descriptionFa: 'بیان پرسش‌ها و پاسخ‌ها با مکث طبیعی', stylePromptEn: 'Read a Persian interview in a natural conversational rhythm, with distinct question intonation and concise pauses.', recommendedPacing: 'normal', recommendedPauseMs: 360, supportsBackchannelHint: true },
  { id: 'science-documentary', nameFa: 'مستند علمی', categoryFa: 'مستند و علمی', descriptionFa: 'آموزش دقیق با روایت روشن', stylePromptEn: 'Narrate a Persian science documentary with precise scientific diction, accessible explanations and a calm authoritative tone.', recommendedPacing: 'normal', recommendedPauseMs: 430 },
  { id: 'classroom', nameFa: 'آموزش تخصصی', categoryFa: 'مستند و علمی', descriptionFa: 'ارائه درس تخصصی با تأکید بر مفاهیم', stylePromptEn: 'Teach technical Persian material in an engaging lecture style. Pause briefly after definitions and complex terms, without reading excessively slowly.', recommendedPacing: 'normal', recommendedPauseMs: 480 },
  { id: 'explanatory', nameFa: 'توضیح ساده', categoryFa: 'مستند و علمی', descriptionFa: 'تبدیل مفهوم سخت به بیان قابل‌فهم', stylePromptEn: 'Explain complex Persian scientific ideas in a natural, friendly, exact tone with readable sentence rhythm.', recommendedPacing: 'normal', recommendedPauseMs: 400 },
  { id: 'storytelling', nameFa: 'داستان‌گویی', categoryFa: 'داستانی و ادبی', descriptionFa: 'روایت تصویری با تغییر آهنگ متناسب', stylePromptEn: 'Tell a Persian story naturally with expressive narrative rhythm, delicate emotional variation and coherent pacing.', recommendedPacing: 'normal', recommendedPauseMs: 440 },
  { id: 'persian-poetry', nameFa: 'دکلمه شعر فارسی', categoryFa: 'داستانی و ادبی', descriptionFa: 'مکث مناسب وزن شعر و معنا', stylePromptEn: 'Recite Persian poetry with clear imagery, gentle measured pauses, awareness of poetic cadence, and no theatrical overacting.', recommendedPacing: 'slow', recommendedPauseMs: 650 },
  { id: 'audiobook', nameFa: 'کتاب صوتی', categoryFa: 'داستانی و ادبی', descriptionFa: 'روایت طولانی و یکدست', stylePromptEn: 'Narrate Persian audiobook prose smoothly over long passages with stable timbre, moderate pauses and intelligible phrasing.', recommendedPacing: 'normal', recommendedPauseMs: 480 },
  { id: 'friendly-podcast', nameFa: 'پادکست دوستانه', categoryFa: 'پادکست و محاوره', descriptionFa: 'بیان صمیمی، روان و بدون کش‌دادن کلمات', stylePromptEn: 'Speak Persian like two knowledgeable friends in a lively podcast. Natural contractions and rhythm, no forced radio voice, no slow theatrical delivery.', recommendedPacing: 'normal', recommendedPauseMs: 300, supportsBackchannelHint: true },
  { id: 'debate', nameFa: 'بحث و گفت‌وگو', categoryFa: 'پادکست و محاوره', descriptionFa: 'مناسب پرسش و پاسخ و گفتگوهای دو نفره', stylePromptEn: 'Use a clear, spontaneous-sounding Persian discussion style, separating turns naturally and keeping energy balanced.', recommendedPacing: 'normal', recommendedPauseMs: 320, supportsBackchannelHint: true },
  { id: 'short-social', nameFa: 'ویدئوی کوتاه', categoryFa: 'پادکست و محاوره', descriptionFa: 'ریتم پرانرژی برای ریلز و ویدئو', stylePromptEn: 'Deliver a short Persian social video voice-over with brisk, natural and highly intelligible emphasis.', recommendedPacing: 'fast', recommendedPauseMs: 240 },
  { id: 'warm-empathy', nameFa: 'روایت همدلانه', categoryFa: 'احساسی و نمایشی', descriptionFa: 'بیان گرم و آرام، بدون اغراق', stylePromptEn: 'Read Persian empathetically and warmly with delicate emotion, avoiding affected sadness and exaggerated vocal cues.', recommendedPacing: 'slow', recommendedPauseMs: 540 },
  { id: 'dramatic', nameFa: 'روایت نمایشی', categoryFa: 'احساسی و نمایشی', descriptionFa: 'تأکید روایی برای متن نمایشی', stylePromptEn: 'Narrate dramatic Persian prose with controlled emotional contrasts and clear delivery; never distort facts.', recommendedPacing: 'normal', recommendedPauseMs: 460 },
];

export const DEFAULT_SPEECH_CONTROLS: SpeechControlsConfig = {
  modelId: 'gemini-3.8-flash-lite-tts',
  autoModel: true,
  voiceId: 'Kore',
  personaId: 'yalda',
  styleId: 'synoptic-analysis',
  customStylePrompt: '',
  speedMultiplier: 1,
  sentencePauseMs: 350,
  paragraphPauseMs: 700,
  emotionalIntensity: 'medium',
  expressiveness: 'balanced',
  outputGainDb: 0,
  normalizeLoudness: true,
  targetLufs: -16,
  punctuationSensitivity: 'natural',
};

export interface SamplePersianScript {
  id: string;
  titleFa: string;
  text: string;
  personaId: string;
  styleId: string;
}

export const SAMPLE_PERSIAN_SCRIPTS: SamplePersianScript[] = [
  {
    id: 'sample-weather',
    titleFa: 'بولتن هواشناسی ایران',
    text: 'بررسی تازه‌ترین نقشه‌های پیش‌بینی نشان می‌دهد که از اواخر هفته، با عبور یک ناوه از تراز میانی جو، در برخی مناطق غربی و شمالی کشور افزایش ابر، رگبار و وزش باد پیش‌بینی می‌شود. زمان و شدت بارش‌ها با نزدیک‌شدن به روزهای آینده دقیق‌تر خواهد شد.',
    personaId: 'yalda', styleId: 'weather-bulletin',
  },
  {
    id: 'sample-synoptic',
    titleFa: 'تحلیل سینوپتیکی',
    text: 'در تراز پانصد هکتوپاسکال، گسترش ناوه به سمت شرق مدیترانه می‌تواند شرایط صعود دینامیکی را در غرب منطقه تقویت کند. با این حال، وقوع بارش موثر به مقدار رطوبت قابل انتقال در لایه‌های پایین و وضعیت پایداری جو وابسته است.',
    personaId: 'yalda', styleId: 'synoptic-analysis',
  },
  {
    id: 'sample-seasonal',
    titleFa: 'چشم‌انداز بارش فصلی',
    text: 'خروجی پیش‌بینی فصلی تنها یک تصویر احتمالاتی از شرایط آینده ارائه می‌کند. ناهنجاری مثبت بارش در یک مدل به معنی وقوع قطعی بارندگی سنگین نیست و لازم است میزان توافق اعضای همادی و مهارت پیش‌بینی مدل نیز بررسی شود.',
    personaId: 'dariush', styleId: 'seasonal-outlook',
  },
  {
    id: 'sample-podcast',
    titleFa: 'پادکست اقلیم',
    text: 'وقتی از ال‌نینو حرف می‌زنیم، در واقع داریم درباره تغییرات گسترده دمای آب و گردش جو در اقیانوس آرام استوایی صحبت می‌کنیم. اثر این پدیده روی ایران مستقیم و یکسان نیست و به فصل، مسیر سامانه‌های بارشی و سایر شاخص‌های اقلیمی هم بستگی دارد.',
    personaId: 'sara', styleId: 'friendly-podcast',
  },
  {
    id: 'sample-news',
    titleFa: 'بخش خبری کوتاه',
    text: 'سازمان‌های هواشناسی برای ارزیابی تغییرات جوی از داده‌های مشاهده‌ای، تصاویر ماهواره‌ای و خروجی مدل‌های پیش‌بینی عددی استفاده می‌کنند. توصیه می‌شود پیش از تصمیم‌گیری، آخرین اطلاعیه‌های رسمی بررسی شود.',
    personaId: 'arman', styleId: 'formal-news',
  },
];

export const DEFAULT_DICTIONARY_ENTRIES: DictionaryEntry[] = [
  { id: 'term-enso', original: 'ENSO', spokenForm: 'اِن‌سو', category: 'هواشناسی و اقلیم', priority: 50, acronymMode: 'expand', scope: 'global', enabled: true, notes: 'شاخص نوسان جنوبی ال‌نینو' },
  { id: 'term-elnino', original: 'El Niño', spokenForm: 'اِل نینیو', category: 'هواشناسی و اقلیم', priority: 45, acronymMode: 'expand', scope: 'global', enabled: true },
  { id: 'term-lanina', original: 'La Niña', spokenForm: 'لا نینیا', category: 'هواشناسی و اقلیم', priority: 45, acronymMode: 'expand', scope: 'global', enabled: true },
  { id: 'term-ecmwf', original: 'ECMWF', spokenForm: 'ای سی اِم دَبلیو اِف', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-gfs', original: 'GFS', spokenForm: 'جی اِف اِس', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-mjo', original: 'MJO', spokenForm: 'اِم جی اُ', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-iod', original: 'IOD', spokenForm: 'آی اُ دی', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-qbo', original: 'QBO', spokenForm: 'کیو بی اُ', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-pdo', original: 'PDO', spokenForm: 'پی دی اُ', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-nao', original: 'NAO', spokenForm: 'اِن اِی اُ', category: 'مخفف‌ها', priority: 40, acronymMode: 'spell-out', scope: 'global', enabled: true },
  { id: 'term-cape', original: 'CAPE', spokenForm: 'کِیپ', category: 'مخفف‌ها', priority: 40, acronymMode: 'expand', scope: 'global', enabled: true },
  { id: 'term-cin', original: 'CIN', spokenForm: 'سین', category: 'مخفف‌ها', priority: 40, acronymMode: 'expand', scope: 'global', enabled: true },
  { id: 'term-hpa', original: 'hPa', spokenForm: 'هکتوپاسکال', category: 'واحدهای علمی', priority: 55, acronymMode: 'expand', scope: 'global', enabled: true },
  { id: 'term-mm', original: 'mm', spokenForm: 'میلی‌متر', category: 'واحدهای علمی', priority: 35, acronymMode: 'expand', scope: 'global', enabled: true },
];
