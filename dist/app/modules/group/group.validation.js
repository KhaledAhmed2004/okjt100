"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupValidation = void 0;
const zod_1 = require("zod");
const createGroupZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Group name is required' }),
        description: zod_1.z.string({ required_error: 'Description is required' }),
        userType: zod_1.z.enum(['Male', 'Female'], { required_error: 'User type is required' }),
        categoryId: zod_1.z.string({ required_error: 'Category ID is required' }),
    }),
});
const createPostZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string({ required_error: 'Post content is required' }),
        attachments: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const addCommentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        comment: zod_1.z.string({ required_error: 'Comment is required' }),
    }),
});
exports.GroupValidation = {
    createGroupZodSchema,
    createPostZodSchema,
    addCommentZodSchema,
};
