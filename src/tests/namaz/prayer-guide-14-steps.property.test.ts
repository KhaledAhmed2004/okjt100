// Feature: namaz-duwa, Property 8: Prayer guide returns 14 ordered steps with all required fields
// Validates: Requirements 3.2, 3.7

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { PRAYER_STEPS } from '../../scripts/seed-namaz';
import { PrayerStepModel } from '../../app/modules/namaz/namaz.model';
import { NamazService } from '../../app/modules/namaz/namaz.service';
import { TSalahType } from '../../app/modules/namaz/namaz.interface';

describe('Property 8: Prayer guide returns 14 ordered steps with all required fields', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed all 14 PrayerStep documents once before property runs
    for (const step of PRAYER_STEPS) {
      await PrayerStepModel.bulkWrite([
        {
          updateOne: {
            filter: { stepKey: step.stepKey },
            update: { $set: step },
            upsert: true,
          },
        },
      ]);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it(
    'for any valid salahType, getPrayerGuide returns exactly 14 ordered steps with all required fields',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TSalahType>('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'),
          async (salahType) => {
            const guide = await NamazService.getPrayerGuide(salahType);

            // Assert exactly 14 steps are returned
            expect(guide).toHaveLength(14);

            // Assert steps are ordered 1–14
            for (let i = 0; i < guide.length; i++) {
              expect(guide[i].order).toBe(i + 1);
            }

            // Assert every step has all required fields
            for (const step of guide) {
              expect(step).toHaveProperty('stepKey');
              expect(typeof step.stepKey).toBe('string');
              expect(step.stepKey.length).toBeGreaterThan(0);

              expect(step).toHaveProperty('stepName');
              expect(typeof step.stepName).toBe('string');
              expect(step.stepName.length).toBeGreaterThan(0);

              expect(step).toHaveProperty('arabicText');
              expect(typeof step.arabicText).toBe('string');

              expect(step).toHaveProperty('transliteration');
              expect(typeof step.transliteration).toBe('string');

              expect(step).toHaveProperty('translation');
              expect(typeof step.translation).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );
});
