// Feature: namaz-duwa, Property 2: Seed field completeness
// Validates: Requirements 1.3

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { PRAYER_STEPS, runSeed, BulkWriteModel } from '../../scripts/seed-namaz';
import { PrayerStepModel } from '../../app/modules/namaz/namaz.model';

describe('Property 2: Seed field completeness', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed once before running all property iterations — the property only
    // needs to verify DB state after a single seed, not re-seed per iteration.
    const model: BulkWriteModel = {
      bulkWrite: (ops) => PrayerStepModel.bulkWrite(ops as Parameters<typeof PrayerStepModel.bulkWrite>[0]),
    };
    await runSeed(PRAYER_STEPS, model);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it(
    'for any non-placeholder PrayerStep after seeding, arabicText, transliteration, and translation are non-empty strings',
    async () => {
      const nonPlaceholderSteps = PRAYER_STEPS.filter((s) => !s.isPlaceholder);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonPlaceholderSteps),
          async (seedStep) => {
            // Fetch the corresponding document from the DB
            const dbStep = await PrayerStepModel.findOne(
              { stepKey: seedStep.stepKey },
            ).lean();

            expect(dbStep).not.toBeNull();

            // arabicText must be a non-empty string
            expect(typeof dbStep!.arabicText).toBe('string');
            expect(dbStep!.arabicText.trim().length).toBeGreaterThan(0);

            // transliteration must be a non-empty string
            expect(typeof dbStep!.transliteration).toBe('string');
            expect(dbStep!.transliteration.trim().length).toBeGreaterThan(0);

            // translation must be a non-empty string
            expect(typeof dbStep!.translation).toBe('string');
            expect(dbStep!.translation.trim().length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000, // generous timeout for 100 iterations
  );
});
