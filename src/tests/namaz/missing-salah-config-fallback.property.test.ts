// Feature: namaz-duwa, Property 10: Missing SalahConfig falls back gracefully
// Validates: Requirements 3.5

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { PRAYER_STEPS } from '../../scripts/seed-namaz';
import { PrayerStepModel, SalahConfigModel } from '../../app/modules/namaz/namaz.model';
import { NamazService } from '../../app/modules/namaz/namaz.service';
import { TSalahType } from '../../app/modules/namaz/namaz.interface';

describe('Property 10: Missing SalahConfig falls back gracefully', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed all 14 PrayerStep documents — no SalahConfig is inserted
    for (const step of PRAYER_STEPS) {
      await PrayerStepModel.bulkWrite([{
        updateOne: { filter: { stepKey: step.stepKey }, update: { $set: step }, upsert: true },
      }]);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it(
    'for any salahType with no SalahConfig, getPrayerGuide returns 14 steps with rakats:[] on additional-surah',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TSalahType>('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'),
          async (salahType) => {
            // Guarantee no SalahConfig exists
            await SalahConfigModel.deleteMany({});

            // Must not throw
            const guide = await NamazService.getPrayerGuide(salahType);

            // Exactly 14 steps returned
            expect(guide).toHaveLength(14);

            // Find the placeholder (additional-surah) step
            const placeholderStep = guide.find(
              (step: any) => step.isPlaceholder === true,
            ) as Record<string, unknown> | undefined;

            expect(placeholderStep).toBeDefined();
            expect(placeholderStep!.stepKey).toBe('additional-surah');

            // rakats must be an empty array (new per-rakat interface)
            expect(Array.isArray(placeholderStep!.rakats)).toBe(true);
            expect((placeholderStep!.rakats as unknown[])).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );
});
