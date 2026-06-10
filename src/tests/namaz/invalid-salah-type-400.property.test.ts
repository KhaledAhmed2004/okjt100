// Feature: namaz-duwa, Property 7: Invalid salahType path parameter returns 400 on all routes
// Validates: Requirements 2.7, 3.6

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { NamazValidation } from '../../app/modules/namaz/namaz.validation';

const { salahTypeParamSchema } = NamazValidation;

const VALID_SALAH_TYPES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/**
 * Wraps a salahType value in the shape the schema expects: { params: { salahType: value } }
 */
function buildInput(value: unknown) {
  return { params: { salahType: value } };
}

describe('Property 7: Invalid salahType path parameter returns 400 on all routes', () => {
  it(
    'any string not in VALID_SALAH_TYPES is rejected by salahTypeParamSchema (returns success: false)',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !VALID_SALAH_TYPES.includes(s as any)),
          (invalidType) => {
            const result = salahTypeParamSchema.safeParse(buildInput(invalidType));
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
