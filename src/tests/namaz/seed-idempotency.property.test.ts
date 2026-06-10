// Feature: namaz-duwa, Property 1: Seed idempotency
// Validates: Requirements 1.2

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';

import { PRAYER_STEPS } from '../../scripts/seed-namaz';
import { PrayerStepModel } from '../../app/modules/namaz/namaz.model';

/**
 * Replicates the seed logic from seed-namaz.ts (without the connect/disconnect
 * boilerplate) so we can call it multiple times inside a single test.
 */
async function runSeedOnce(): Promise<void> {
  for (const step of PRAYER_STEPS) {
    const op = {
      updateOne: {
        filter: { stepKey: step.stepKey },
        update: { $set: step },
        upsert: true,
      },
    };
    try {
      await PrayerStepModel.bulkWrite([op]);
    } catch (err) {
      console.error(`[test-seed] Failed to seed step: ${step.stepKey}`, err);
      // continue — mirrors real seed behaviour
    }
  }
}

describe('Property 1: Seed idempotency', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Wipe the collection before each property run so every iteration starts fresh
  beforeEach(async () => {
    await PrayerStepModel.deleteMany({});
  });

  it(
    'running the seed N times [2, 20] always leaves exactly 14 PrayerStep documents with no duplicates',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 20 }),
          async (runCount) => {
            // Reset to a clean state for each generated example
            await PrayerStepModel.deleteMany({});

            // Run the seed runCount times
            for (let i = 0; i < runCount; i++) {
              await runSeedOnce();
            }

            // Assert total count is exactly 14
            const totalCount = await PrayerStepModel.countDocuments({});
            expect(totalCount).toBe(14);

            // Assert no duplicates by checking unique stepKeys
            const allSteps = await PrayerStepModel.find({}, { stepKey: 1 }).lean();
            const stepKeys = allSteps.map((s) => s.stepKey as string);
            const uniqueKeys = new Set(stepKeys);
            expect(uniqueKeys.size).toBe(14);

            // Assert all 14 expected stepKeys are present
            const expectedKeys = PRAYER_STEPS.map((s) => s.stepKey);
            for (const key of expectedKeys) {
              expect(uniqueKeys.has(key)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000, // generous timeout for 100 iterations × up to 20 seed runs each
  );
});
