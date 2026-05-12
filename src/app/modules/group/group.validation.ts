import { z } from 'zod';

const createGroupZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Group name is required' }),
    description: z.string({ required_error: 'Description is required' }),
    userType: z.enum(['Male', 'Female'], { required_error: 'User type is required' }),
    categoryId: z.string({ required_error: 'Category ID is required' }),
  }),
});

const createPostZodSchema = z.object({
  body: z.object({
    content: z.string({ required_error: 'Post content is required' }),
    attachments: z.array(z.string()).optional(),
  }),
});

const addCommentZodSchema = z.object({
  body: z.object({
    comment: z.string({ required_error: 'Comment is required' }),
    parentCommentId: z.string().optional(),
  }),
});

const updatePostZodSchema = z.object({
  body: z.object({
    content: z.string().optional(),
    attachments: z.array(z.string()).optional(),
  }),
});

const updateCommentZodSchema = z.object({
  body: z.object({
    comment: z.string({ required_error: 'Comment is required' }),
  }),
});

export const GroupValidation = {
  createGroupZodSchema,
  createPostZodSchema,
  addCommentZodSchema,
  updatePostZodSchema,
  updateCommentZodSchema,
};
