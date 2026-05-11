import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z
    .object({
      cursor: z.string().min(1).optional(),
      limit: z
        .string()
        .regex(/^\d+$/)
        .optional(),
      unread: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

export const paramIdSchema = z.object({
  params: z.object({ notificationId: z.string().min(1) }),
});

export const markReadSchema = z.object({
  params: z.object({ notificationId: z.string().min(1) }),
  body: z
    .object({ read: z.boolean().default(true) })
    .optional(),
});
