import { Schema, model } from 'mongoose';
import { IPrayerStep, ISalahConfig, IVerse, IRakatConfig } from './namaz.interface';

const VerseSchema = new Schema<IVerse>(
  {
    verseNumber:     { type: Number, required: true },
    verseKey:        { type: String, required: true },
    arabicText:      { type: String, required: true },
    transliteration: { type: String, required: true },
    translation:     { type: String, required: true },
    audioUrl:        { type: String, default: null },
  },
  { _id: false },
);

const PrayerStepSchema = new Schema<IPrayerStep>(
  {
    stepKey:         { type: String, required: true, unique: true },
    order:           { type: Number, required: true },
    stepName:        { type: String, required: true },
    arabicText:      { type: String, required: function() { return !this.isPlaceholder; } },
    transliteration: { type: String, required: function() { return !this.isPlaceholder; } },
    translation:     { type: String, required: function() { return !this.isPlaceholder; } },
    isPlaceholder:   { type: Boolean, default: false },
    verses:          { type: [VerseSchema], default: undefined },
  },
  { timestamps: true },
);

PrayerStepSchema.index({ order: 1 });



const RakatConfigSchema = new Schema<IRakatConfig>(
  {
    rakat:           { type: Number, required: true, min: 1 },
    surahNumber:     { type: Number, required: true, min: 1, max: 114 },
    surahName:       { type: String, required: true },
    verses:          { type: [VerseSchema], default: [] },
  },
  { _id: false },
);

const SalahConfigSchema = new Schema<ISalahConfig>(
  {
    salahType: {
      type: String,
      enum: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
      required: true,
      unique: true,
    },
    // Per-rakat surah assignments — replaces the old single surahNumber field
    rakats: { type: [RakatConfigSchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const PrayerStepModel = model<IPrayerStep>('PrayerStep', PrayerStepSchema);
export const SalahConfigModel = model<ISalahConfig>('SalahConfig', SalahConfigSchema);
