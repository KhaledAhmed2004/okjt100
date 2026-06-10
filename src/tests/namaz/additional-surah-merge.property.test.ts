// Feature: namaz-duwa, Property 9: Additional Surah step is correctly merged from SalahConfig
// Validates: Requirements 3.3, 3.4

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { PRAYER_STEPS } from '../../scripts/seed-namaz';
import { PrayerStepModel, SalahConfigModel } from '../../app/modules/namaz/namaz.model';
import { NamazService } from '../../app/modules/namaz/namaz.service';
import { TSalahType } from '../../app/modules/namaz/namaz.interface';

// Arbitrary for a single rakat entry with full surah data
const rakatDataArb = (rakat: number) =>
  fc.record({
    rakat: fc.constant(rakat),
    surahNumber: fc.integer({ min: 1, max: 114 }),
    surahName: fc.string({ minLength: 1, maxLength: 50 }),
    verses: fc.array(
      fc.record({
        verseNumber: fc.integer({ min: 1 }),
        verseKey: fc.string({ minLength: 1 }),
        arabicText: fc.string({ minLength: 1 }),
        transliteration: fc.string({ minLength: 1 }),
        translation: fc.string({ minLength: 1 }),
        audioUrl: fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
      }),
      { minLength: 1, maxLength: 5 }
    ),
  });

// Generate a valid SalahConfig with 1 or 2 rakats
const validSalahConfigArbitrary = fc.record({
  salahType: fc.constantFrom<TSalahType>('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'),
  rakats: fc.oneof(
    fc.tuple(rakatDataArb(1)).map(([r]) => [r]),
    fc.tuple(rakatDataArb(1), rakatDataArb(2)).map(([r1, r2]) => [r1, r2]),
  ),
});

async function seedPrayerSteps(): Promise<void> {
  for (const step of PRAYER_STEPS) {
    await PrayerStepModel.bulkWrite([{
      updateOne: { filter: { stepKey: step.stepKey }, update: { $set: step }, upsert: true },
    }]);
  }
}

describe('Property 9: Additional Surah step is correctly merged from SalahConfig', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await seedPrayerSteps();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it(
    'for any salahType with a stored SalahConfig, index 4 has stepKey "additional-surah" with rakats[] correctly merged',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validSalahConfigArbitrary,
          async (config) => {
            await SalahConfigModel.deleteMany({});

            // Pre-insert SalahConfig (per-rakat shape)
            await SalahConfigModel.create({ salahType: config.salahType, rakats: config.rakats });

            const guide = await NamazService.getPrayerGuide(config.salahType);

            expect(guide).toHaveLength(14);

            const additionalSurahStep = guide[4] as Record<string, unknown>;
            expect(additionalSurahStep.stepKey).toBe('additional-surah');

            // rakats array must be present and have the same length as the config
            const rakats = additionalSurahStep.rakats as any[];
            expect(Array.isArray(rakats)).toBe(true);
            expect(rakats).toHaveLength(config.rakats.length);

            // Each rakat entry must match the stored config
            for (const configRakat of config.rakats) {
              const matched = rakats.find((r: any) => r.rakat === configRakat.rakat);
              expect(matched).toBeDefined();
              expect(matched.surahName).toBe(configRakat.surahName);
              expect(matched.verses).toHaveLength(configRakat.verses.length);
              expect(matched.verses[0].arabicText).toBe(configRakat.verses[0].arabicText);
              expect(matched.verses[0].transliteration).toBe(configRakat.verses[0].transliteration);
              expect(matched.verses[0].translation).toBe(configRakat.verses[0].translation);
              expect(matched.verses[0].audioUrl).toBe(configRakat.verses[0].audioUrl);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    120_000,
  );
});
