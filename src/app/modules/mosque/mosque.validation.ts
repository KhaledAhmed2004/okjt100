import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const prayerTimesSchema = z.object({
  fajr: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  dhuhr: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  asr: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  maghrib: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  isha: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  jummah: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const createMosqueZodSchema = z.object({
  body: z.object({
    mosqueName: z.string().min(1, 'Mosque name is required'),
    address: z.string().min(1, 'Address is required'),
    area: z.string().min(1, 'Area is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    website: z.string().url('Invalid website URL').optional(),
    location: locationSchema,
    prayerTimes: prayerTimesSchema,
  }),
});

const updateMosqueZodSchema = z.object({
  params: z.object({
    mosqueId: z.string({
      required_error: 'Mosque ID is required',
    }),
  }),
  body: z.object({
    mosqueName: z.string().optional(),
    address: z.string().optional(),
    area: z.string().optional(),
    phoneNumber: z.string().optional(),
    website: z.string().url('Invalid website URL').optional(),
    location: locationSchema.optional(),
    prayerTimes: prayerTimesSchema.partial().optional(),
  }),
});

export const MosqueValidation = {
  createMosqueZodSchema,
  updateMosqueZodSchema,
};
