import { z } from 'zod';
import { CONNECTION_ACTION } from './connection.constants';

export const sendConnectionRequestSchema = z.object({
  params: z.object({
    userId: z.string({ required_error: 'Receiver user ID is required' }),
  }),
});

export const respondToConnectionRequestSchema = z.object({
  params: z.object({
    connectionId: z.string({ required_error: 'Connection ID is required' }),
  }),
  body: z.object({
    action: z.nativeEnum(CONNECTION_ACTION, {
      required_error: 'Action must be ACCEPT or REJECT',
    }),
  }),
});

export const getConnectionByIdParamsSchema = z.object({
  params: z.object({
    connectionId: z.string({ required_error: 'Connection ID is required' }),
  }),
});

export const checkConnectionStatusParamsSchema = z.object({
  params: z.object({
    userId: z.string({ required_error: 'User ID is required' }),
  }),
});

export const ConnectionValidation = {
  sendConnectionRequestSchema,
  respondToConnectionRequestSchema,
  getConnectionByIdParamsSchema,
  checkConnectionStatusParamsSchema,
};