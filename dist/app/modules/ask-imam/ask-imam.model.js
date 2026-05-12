"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const AskImamSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    imageUrl: { type: String },
    status: {
        type: String,
        enum: ['pending', 'answered'],
        default: 'pending',
        required: true,
    },
    answer: { type: String },
    answeredAt: { type: Date },
}, {
    timestamps: true,
});
// Indexes
AskImamSchema.index({ userId: 1 });
AskImamSchema.index({ status: 1 });
AskImamSchema.index({ createdAt: -1 });
const AskImam = (0, mongoose_1.model)('AskImam', AskImamSchema);
exports.default = AskImam;
