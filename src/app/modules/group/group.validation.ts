import { z } from 'zod';
import { USER_ROLES } from '../../../enums/user';

const createGroupZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Group name is required' }),
    description: z.string({ required_error: 'Description is required' }),
    userType: z.enum([USER_ROLES.BROTHER, USER_ROLES.SISTER], { required_error: 'User type is required' }),
    category: z.string({ required_error: 'Category name is required' }),
  }),
});

const createPostZodSchema = z.object({
  body: z.object({
    content: z.string({ required_error: 'Post content is required' }),
    attachments: z.array(z.string()).max(5, 'Maximum 5 attachments allowed').optional(),
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
    attachments: z.array(z.string()).max(5, 'Maximum 5 attachments allowed').optional(),
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
