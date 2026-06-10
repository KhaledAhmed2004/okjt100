// Feature: namaz-duwa, Property 3: Seed error resilience
// Validates: Requirements 1.4

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { PRAYER_STEPS, runSeed, BulkWriteModel } from '../../scripts/seed-namaz';

const STEP_KEYS = PRAYER_STEPS.map((s) => s.stepKey);

describe('Property 3: Seed error resilience', () => {
  it(
    'for any subset of steps that fail to write, the remaining steps are present after the seed finishes',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.subarray(STEP_KEYS),
          async (failingKeys) => {
            // In-memory store to track what was "written"
            const written: string[] = [];

            // Mock model: throws for any step in failingKeys, records the rest
            const mockModel: BulkWriteModel = {
              bulkWrite: async (ops) => {
                // Each call receives a single-element array per the seed loop
                const op = (ops as Array<{
                  updateOne: { filter: { stepKey: string }; update: unknown; upsert: boolean };
                }>)[0];
                const stepKey = op.updateOne.filter.stepKey;

                if (failingKeys.includes(stepKey)) {
                  throw new Error(`Simulated write failure for step: ${stepKey}`);
                }

                written.push(stepKey);
                return {};
              },
            };

            // Run the seed with the mock model
            const succeeded = await runSeed(PRAYER_STEPS, mockModel);

            // The steps that should have succeeded
            const expectedSucceeded = STEP_KEYS.filter((k) => !failingKeys.includes(k));

            // Every non-failing step must be in the succeeded array
            for (const key of expectedSucceeded) {
              expect(succeeded).toContain(key);
            }

            // The written store must also contain every non-failing step
            for (const key of expectedSucceeded) {
              expect(written).toContain(key);
            }

            // Failing steps must NOT appear in succeeded or written
            for (const key of failingKeys) {
              expect(succeeded).not.toContain(key);
              expect(written).not.toContain(key);
            }

            // Reset for next iteration
            written.length = 0;
          },
        ),
        { numRuns: 100 },
      );
    },
    30_000, // generous timeout for 100 iterations
  );
});
