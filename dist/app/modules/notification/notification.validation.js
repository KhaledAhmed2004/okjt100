"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markReadSchema = exports.paramIdSchema = exports.listNotificationsSchema = void 0;
const zod_1 = require("zod");
exports.listNotificationsSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        cursor: zod_1.z.string().min(1).optional(),
        limit: zod_1.z
            .string()
            .regex(/^\d+$/)
            .optional(),
        unread: zod_1.z.enum(['true', 'false']).optional(),
    })
        .optional(),
});
exports.paramIdSchema = zod_1.z.object({
    params: zod_1.z.object({ notificationId: zod_1.z.string().min(1) }),
});
exports.markReadSchema = zod_1.z.object({
    params: zod_1.z.object({ notificationId: zod_1.z.string().min(1) }),
    body: zod_1.z
        .object({ read: zod_1.z.boolean().default(true) })
        .optional(),
});
