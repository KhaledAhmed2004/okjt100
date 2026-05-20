import { z } from 'zod';

const getPrayerTimesZodSchema = z.object({
  query: z.object({
    latitude: z.preprocess(
      (val) => (val ? parseFloat(val as string) : undefined),
      z.number({
        required_error: 'Latitude is required',
        invalid_type_error: 'Latitude must be a valid number',
      })
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
    ),
    longitude: z.preprocess(
      (val) => (val ? parseFloat(val as string) : undefined),
      z.number({
        required_error: 'Longitude is required',
        invalid_type_error: 'Longitude must be a valid number',
      })
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
    ),
    date: z.string().optional().refine(
      (val) => {
        if (!val) return true;
        return !isNaN(Date.parse(val));
      },
      {
        message: 'Invalid date format. Please use a valid date string (e.g., YYYY-MM-DD)',
      }
    ),
    timezone: z.string().optional(),
    method: z.string().optional(),
    madhab: z.enum(['Hanafi', 'Shafi']).optional(),
  }),
});

export const PrayerTimeValidation = {
  getPrayerTimesZodSchema,
};
