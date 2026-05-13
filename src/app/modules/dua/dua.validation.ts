import { z } from 'zod';

const createDuaZodSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    waqt: z.enum(['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'], {
      required_error: 'Waqt is required',
    }),
    details: z.string().min(1, 'Details are required'),
    audio: z.string({ required_error: 'Audio file is required' }),
  }),
});

const updateDuaZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    waqt: z.enum(['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha']).optional(),
    details: z.string().optional(),
    audio: z.string().optional(),
  }),
});

export const DuaValidation = {
  createDuaZodSchema,
  updateDuaZodSchema,
};
