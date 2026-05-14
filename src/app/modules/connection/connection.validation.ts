import { z } from 'zod';

const sendRequestZodSchema = z.object({
  params: z.object({
    userId: z.string({ required_error: 'Receiver user ID is required' }),
  }),
});

const respondToRequestZodSchema = z.object({
  params: z.object({
    connectionId: z.string({ required_error: 'Connection ID is required' }),
  }),
  body: z.object({
    action: z.enum(['ACCEPT', 'REJECT'], { required_error: 'Action must be ACCEPT or REJECT' }),
  }),
});

const connectionIdParamSchema = z.object({
  params: z.object({
    connectionId: z.string({ required_error: 'Connection ID is required' }),
  }),
});

const statusCheckZodSchema = z.object({
  params: z.object({
    userId: z.string({ required_error: 'User ID is required' }),
  }),
});

export const ConnectionValidation = {
  sendRequestZodSchema,
  respondToRequestZodSchema,
  connectionIdParamSchema,
  statusCheckZodSchema,
};
