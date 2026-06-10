// Feature: namaz-duwa, Property 4: surahNumber input validation
// Validates: Requirements 2.1, 2.8

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { NamazValidation } from '../../app/modules/namaz/namaz.validation';

const { upsertSalahConfigBodySchema } = NamazValidation;

/**
 * Wraps a value in the shape the schema expects: { body: { surahNumber: value } }
 */
function buildInput(value: unknown) {
  return { body: { surahNumber: value } };
}

describe('Property 4: surahNumber input validation', () => {
  it(
    'any integer outside [1, 114] is rejected by the schema (returns success: false)',
    () => {
      fc.assert(
        fc.property(
          fc.integer().filter(n => n < 1 || n > 114),
          (outOfRange) => {
            const result = upsertSalahConfigBodySchema.safeParse(buildInput(outOfRange));
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'any string value for surahNumber is rejected by the schema (returns success: false)',
    () => {
      fc.assert(
        fc.property(
          fc.string(),
          (str) => {
            const result = upsertSalahConfigBodySchema.safeParse(buildInput(str));
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'any non-integer float for surahNumber is rejected by the schema (returns success: false)',
    () => {
      fc.assert(
        fc.property(
          fc.float({ noNaN: true }).filter(n => !Number.isInteger(n)),
          (nonInteger) => {
            const result = upsertSalahConfigBodySchema.safeParse(buildInput(nonInteger));
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'absent surahNumber (undefined) is rejected by the schema (returns success: false)',
    () => {
      const result = upsertSalahConfigBodySchema.safeParse({ body: {} });
      expect(result.success).toBe(false);
    },
  );

  it(
    'null surahNumber is rejected by the schema (returns success: false)',
    () => {
      const result = upsertSalahConfigBodySchema.safeParse(buildInput(null));
      expect(result.success).toBe(false);
    },
  );
});
