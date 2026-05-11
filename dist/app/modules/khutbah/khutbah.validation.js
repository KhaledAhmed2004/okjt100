"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KhutbaValidation = void 0;
const zod_1 = require("zod");
const createKhutbaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        mosqueName: zod_1.z.string().min(1, 'Mosque name is required'),
        imam: zod_1.z.string().min(1, 'Imam name is required'),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
        description: zod_1.z.string().optional(),
        duration: zod_1.z.string().optional().transform(val => val ? Number(val) : undefined),
    }),
});
const updateKhutbaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        mosqueName: zod_1.z.string().optional(),
        imam: zod_1.z.string().optional(),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
        description: zod_1.z.string().optional(),
        duration: zod_1.z.string().optional().transform(val => val ? Number(val) : undefined),
    }),
});
exports.KhutbaValidation = {
    createKhutbaZodSchema,
    updateKhutbaZodSchema,
};
