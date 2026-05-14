import { z } from 'zod';

const createLearningContentZodSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }),
    description: z.string({
      required_error: 'Description is required',
    }),
    category: z.string({
      required_error: 'Category is required',
    }),
    video: z.string({
      required_error: 'Video file is required',
    }),
    durationInSeconds: z.preprocess((val) => (val ? Number(val) : val), z.number().optional()),
  }),
});

const updateLearningContentZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    video: z.string().optional(),
    durationInSeconds: z.preprocess((val) => (val ? Number(val) : val), z.number().optional()),
  }),
});

const addCommentZodSchema = z.object({
  body: z.object({
    comment: z.string({
      required_error: 'Comment is required',
    }),
    parentCommentId: z.string().optional(),
  }),
});

export const LearningContentValidation = {
  createLearningContentZodSchema,
  updateLearningContentZodSchema,
  addCommentZodSchema,
};
