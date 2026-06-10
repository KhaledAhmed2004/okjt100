import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { PrayerStepModel, SalahConfigModel } from './namaz.model';
import { TSalahType } from './namaz.interface';

/**
 * Base URL for the islamic.app API (v1 — quran.com-compatible).
 *
 * Endpoints used:
 *   GET /v1/chapters                                  → list all 114 surahs
 *   GET /v1/chapters/{id}                             → single chapter metadata
 *   GET /v1/verses/by_chapter/{id}
 *       ?words=true&translations=22                   → full surah text + translation + word-by-word
 *
 * Translation ID 22 = Yusuf Ali (English) — widely recognised, freely available.
 * Word-by-word audio paths are relative to https://audio.qurancdn.com/
 */
const ISLAMIC_APP_BASE_URL = 'https://api.islamic.app/v1';
const TRANSLATION_ID = 22; // Yusuf Ali (English)
const AXIOS_TIMEOUT_MS = 10_000;

// ── Public: proxy surah list ──────────────────────────────────────────────────

/**
 * Returns the list of all 114 surahs.
 * The raw `{ data: { chapters: [...] } }` envelope from islamic.app is
 * passed through unchanged so the frontend can access `data.chapters`.
 */
const getSurahList = async () => {
  try {
    const response = await axios.get(`${ISLAMIC_APP_BASE_URL}/chapters`, {
      timeout: AXIOS_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      'Islamic App API is currently unavailable',
    );
  }
};

// ── Private: fetch full surah data for a single chapter ──────────────────────

const fetchSurahData = async (surahNumber: number) => {
  // ── 1. Chapter metadata (name) ───────────────────────────────────────────
  const chapterRes = await axios.get(
    `https://api.quran.com/api/v4/chapters/${surahNumber}`,
    { timeout: AXIOS_TIMEOUT_MS },
  );
  const chapter = chapterRes.data?.chapter;
  const surahName: string = chapter?.name_simple ?? `Surah ${surahNumber}`;

  // ── 2. Verses with words + translation + audio ───────────────────────────
  // 131 = Clear Quran Translation, 7 = Mishary Alafasy Audio
  const versesRes = await axios.get(
    `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}`,
    {
      params: {
        words: true,
        translations: 131,
        audio: 7,
        fields: 'text_uthmani',
        per_page: 286, // max verses in any surah
      },
      timeout: AXIOS_TIMEOUT_MS,
    },
  );
  const rawVerses: any[] = versesRes.data?.verses ?? [];

  // ── 3. Build verses array ─────────────────────────────────────────────────
  const verses = rawVerses.map((v: any) => {
    // Combine word transliterations to make the full verse transliteration
    const transliteration = (v.words ?? [])
      .filter((w: any) => w.char_type_name === 'word')
      .map((w: any) => (w.transliteration?.text ?? '').trim())
      .filter(Boolean)
      .join(' ');

    const translation = Array.isArray(v.translations) && v.translations.length > 0
      ? v.translations[0].text?.replace(/<[^>]+>/g, '').trim()
      : (v.words ?? [])
          .map((w: any) => w.translation?.text)
          .filter(Boolean)
          .join(' ');

    const audioUrl = v.audio?.url
      ? `https://verses.quran.foundation/${v.audio.url}`
      : null;

    return {
      verseNumber: v.verse_number,
      verseKey: v.verse_key,
      arabicText: (v.text_uthmani ?? '').trim(),
      transliteration,
      translation,
      audioUrl,
    };
  });

  return {
    surahName,
    verses,
  };
};

// ── Admin: upsert per-rakat salah config ─────────────────────────────────────

/**
 * Accepts an array of { rakat, surahNumber } entries.
 * For each entry, fetches full surah data from islamic.app, then upserts
 * the SalahConfig document for the given salahType.
 *
 * 502 guard: the entire fetch phase runs before any DB write. If any
 * external API call fails, the existing config document is left unchanged.
 */
const upsertSalahConfig = async (
  salahType: TSalahType,
  rakats: { rakat: number; surahNumber: number }[],
) => {
  let rakatConfigs: {
    rakat: number;
    surahNumber: number;
    surahName: string;
    verses: {
      verseNumber: number;
      verseKey: string;
      arabicText: string;
      transliteration: string;
      translation: string;
      audioUrl: string | null;
    }[];
  }[];

  try {
    rakatConfigs = await Promise.all(
      rakats.map(async ({ rakat, surahNumber }) => {
        const surahData = await fetchSurahData(surahNumber);
        return { rakat, surahNumber, ...surahData };
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      'Islamic App API is currently unavailable',
    );
  }

  // Sort by rakat number for deterministic storage
  rakatConfigs.sort((a, b) => a.rakat - b.rakat);

  const saved = await SalahConfigModel.findOneAndUpdate(
    { salahType },
    { $set: { rakats: rakatConfigs } },
    { upsert: true, new: true, runValidators: true },
  );

  return saved;
};

// ── Admin: get all salah configs ─────────────────────────────────────────────

const getAllSalahConfigs = async () => {
  return SalahConfigModel.find({});
};

// ── Public: build prayer guide ───────────────────────────────────────────────

/**
 * Returns the 14-step prayer guide for the given salahType.
 *
 * The "additional-surah" placeholder step is replaced with the per-rakat
 * config from SalahConfig.rakats. If no config exists, the placeholder
 * returns rakats: [] so the frontend can gracefully show "not configured".
 */
const getPrayerGuide = async (salahType: TSalahType) => {
  const steps = await PrayerStepModel.find({}).sort({ order: 1 }).lean();
  const config = await SalahConfigModel.findOne({ salahType }).lean();

  return steps.map((step) => {
    if (!step.isPlaceholder) return step;

    if (config && config.rakats.length > 0) {
      return {
        ...step,
        rakats: config.rakats,
      };
    }

    return {
      ...step,
      rakats: [],
    };
  });
};

export const NamazService = {
  getSurahList,
  fetchSurahData,
  upsertSalahConfig,
  getAllSalahConfigs,
  getPrayerGuide,
};
