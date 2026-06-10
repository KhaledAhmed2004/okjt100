import { Document } from 'mongoose';

export type TSalahType = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface IPrayerStep extends Document {
  stepKey: string;          // slug identifier, e.g. 'niyyah', 'additional-surah'
  order: number;            // 1–14, used for deterministic sort
  stepName: string;
  arabicText: string;
  transliteration: string;
  translation: string;
  isPlaceholder: boolean;   // true only for 'additional-surah' step
  verses?: IVerse[];        // dynamically fetched verses for steps like 'surah-al-fatihah'
  createdAt: Date;
  updatedAt: Date;
}

export interface IVerse {
  verseNumber: number;
  verseKey: string;
  arabicText: string;
  transliteration: string;
  translation: string;
  audioUrl: string | null;
}

/**
 * Per-rakat surah configuration.
 * Each entry stores the full fetched surah data for a single rakat.
 */
export interface IRakatConfig {
  rakat: number;            // rakat number (1-based, e.g. 1, 2, 3, 4)
  surahNumber: number;      // Quran surah number (1–114)
  surahName: string;
  verses: IVerse[];
}

export interface ISalahConfig extends Document {
  salahType: TSalahType;
  /**
   * Per-rakat surah assignments.
   * Array index does NOT define order — use the `rakat` field.
   * Array length equals the number of rakats configured for this Salah type.
   */
  rakats: IRakatConfig[];
  createdAt: Date;
  updatedAt: Date;
}
