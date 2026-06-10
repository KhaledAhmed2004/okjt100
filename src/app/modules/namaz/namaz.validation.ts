import { z } from 'zod';

const VALID_SALAH_TYPES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

const salahTypeParamSchema = z.object({
  params: z.object({
    salahType: z.enum(VALID_SALAH_TYPES, {
      errorMap: () => ({
        message: `salahType must be one of: ${VALID_SALAH_TYPES.join(', ')}`,
      }),
    }),
  }),
});

/**
 * Single rakat entry:
 *   { rakat: 1, surahNumber: 112 }
 */
const rakatEntrySchema = z.object({
  rakat: z
    .number({
      required_error: 'rakat is required',
      invalid_type_error: 'rakat must be a positive integer',
    })
    .int({ message: 'rakat must be a positive integer' })
    .min(1, { message: 'rakat must be at least 1' }),

  surahNumber: z
    .number({
      required_error: 'surahNumber is required',
      invalid_type_error: 'surahNumber must be an integer',
    })
    .int({ message: 'surahNumber must be an integer' })
    .min(1, { message: 'surahNumber must be between 1 and 114' })
    .max(114, { message: 'surahNumber must be between 1 and 114' }),
});

const upsertSalahConfigBodySchema = z.object({
  body: z.object({
    /**
     * Array of per-rakat surah assignments.
     * - At least one entry required
     * - No duplicate rakat numbers allowed
     *
     * Example:
     *   [{ rakat: 1, surahNumber: 112 }, { rakat: 2, surahNumber: 108 }]
     */
    rakats: z
      .array(rakatEntrySchema, {
        required_error: 'rakats is required',
        invalid_type_error: 'rakats must be an array',
      })
      .min(1, { message: 'rakats must contain at least one entry' })
      .refine(
        (entries) => {
          const rakatNumbers = entries.map((e) => e.rakat);
          return new Set(rakatNumbers).size === rakatNumbers.length;
        },
        { message: 'rakats must not contain duplicate rakat numbers' },
      ),
  }),
});

export const NamazValidation = {
  salahTypeParamSchema,
  upsertSalahConfigBodySchema,
};
