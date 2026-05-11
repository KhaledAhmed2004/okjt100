import { z } from 'zod';

const createKhutbaZodSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    mosqueName: z.string().min(1, 'Mosque name is required'),
    imam: z.string().min(1, 'Imam name is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    description: z.string().optional(),
    duration: z.string().optional().transform(val => val ? Number(val) : undefined),
  }),
});

const updateKhutbaZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    mosqueName: z.string().optional(),
    imam: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    description: z.string().optional(),
    duration: z.string().optional().transform(val => val ? Number(val) : undefined),
  }),
});

export const KhutbaValidation = {
  createKhutbaZodSchema,
  updateKhutbaZodSchema,
};
