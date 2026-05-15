import { z } from 'zod';

const createKhutbaZodSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    mosqueName: z.string().min(1, 'Mosque name is required'),
    imam: z.string().min(1, 'Imam name is required'),
    date: z.string({ required_error: 'Date is required' }).datetime(),
    description: z.string().optional(),
    audio: z.string({ required_error: 'Audio file is required' }),
    thumbnail: z.string({ required_error: 'Thumbnail image is required' }),
    durationInSeconds: z.preprocess((val) => (val ? Number(val) : val), z.number().optional()),
  }),
});

const updateKhutbaZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    mosqueName: z.string().optional(),
    imam: z.string().optional(),
    date: z.string().datetime().optional(),
    description: z.string().optional(),
    audio: z.string().optional(),
    thumbnail: z.string().optional(),
    durationInSeconds: z.preprocess((val) => (val ? Number(val) : val), z.number().optional()),
  }),
});

export const KhutbaValidation = {
  createKhutbaZodSchema,
  updateKhutbaZodSchema,
};
