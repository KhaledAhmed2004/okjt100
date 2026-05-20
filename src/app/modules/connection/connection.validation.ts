import { z } from 'zod';

const sendConnectionRequestSchema = z.object({
  body: z.object({
    receiverId: z.string({ required_error: 'Receiver user ID is required' }),
  }),
});

// Single reusable schema for all action endpoints that only need :connectionId in params
const connectionIdParamSchema = z.object({
  params: z.object({
    connectionId: z.string({ required_error: 'Connection ID is required' }),
  }),
});

export const ConnectionValidation = {
  sendConnectionRequestSchema,
  connectionIdParamSchema,
};