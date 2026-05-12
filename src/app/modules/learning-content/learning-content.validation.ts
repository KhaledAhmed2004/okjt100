import { z } from 'zod';

const createLearningContentZodSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }),
    description: z.string({
      required_error: 'Description is required',
    }),
    videoUrl: z.string({
      required_error: 'Video URL is required',
    }),
    category: z.string({
      required_error: 'Category is required',
    }),
  }),
});

const updateLearningContentZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    videoUrl: z.string().optional(),
    category: z.string().optional(),
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
