"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionValidation = void 0;
const zod_1 = require("zod");
const sendRequestZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string({ required_error: 'Receiver user ID is required' }),
    }),
});
const respondToRequestZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        connectionId: zod_1.z.string({ required_error: 'Connection ID is required' }),
    }),
    body: zod_1.z.object({
        action: zod_1.z.enum(['ACCEPT', 'REJECT'], { required_error: 'Action must be ACCEPT or REJECT' }),
    }),
});
const connectionIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        connectionId: zod_1.z.string({ required_error: 'Connection ID is required' }),
    }),
});
const statusCheckZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string({ required_error: 'User ID is required' }),
    }),
});
exports.ConnectionValidation = {
    sendRequestZodSchema,
    respondToRequestZodSchema,
    connectionIdParamSchema,
    statusCheckZodSchema,
};
