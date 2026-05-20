"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionValidation = exports.checkConnectionStatusParamsSchema = exports.getConnectionByIdParamsSchema = exports.respondToConnectionRequestSchema = exports.sendConnectionRequestSchema = void 0;
const zod_1 = require("zod");
const connection_constants_1 = require("./connection.constants");
exports.sendConnectionRequestSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string({ required_error: 'Receiver user ID is required' }),
    }),
});
exports.respondToConnectionRequestSchema = zod_1.z.object({
    params: zod_1.z.object({
        connectionId: zod_1.z.string({ required_error: 'Connection ID is required' }),
    }),
    body: zod_1.z.object({
        action: zod_1.z.nativeEnum(connection_constants_1.CONNECTION_ACTION, {
            required_error: 'Action must be ACCEPT or REJECT',
        }),
    }),
});
exports.getConnectionByIdParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        connectionId: zod_1.z.string({ required_error: 'Connection ID is required' }),
    }),
});
exports.checkConnectionStatusParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string({ required_error: 'User ID is required' }),
    }),
});
exports.ConnectionValidation = {
    sendConnectionRequestSchema: exports.sendConnectionRequestSchema,
    respondToConnectionRequestSchema: exports.respondToConnectionRequestSchema,
    getConnectionByIdParamsSchema: exports.getConnectionByIdParamsSchema,
    checkConnectionStatusParamsSchema: exports.checkConnectionStatusParamsSchema,
};
