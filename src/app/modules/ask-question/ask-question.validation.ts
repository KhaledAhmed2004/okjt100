import { z } from 'zod';

const submitQuestionZodSchema = z.object({
  body: z.object({
    question: z
      .string({ required_error: 'Question is required' })
      .trim()
      .min(1, 'Question cannot be empty')
      .max(2000, 'Question cannot exceed 2000 characters'),
    image: z.string().optional(),
  }),
});

const answerQuestionZodSchema = z.object({
  body: z.object({
    answer: z.string().min(1, 'Answer is required'),
  }),
});

export const AskQuestionValidation = {
  submitQuestionZodSchema,
  answerQuestionZodSchema,
};
