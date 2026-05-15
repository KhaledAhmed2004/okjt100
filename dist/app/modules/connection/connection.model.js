"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
const mongoose_1 = require("mongoose");
const connectionSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED'],
        default: 'PENDING',
    },
    chatId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Chat',
    },
    respondedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Compound unique index to prevent duplicate connection requests between the same two users
// We handle direction logic in the service (A->B and B->A are both blocked if one exists)
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });
// Indexes for fast pending request lookups
connectionSchema.index({ receiver: 1, status: 1 });
connectionSchema.index({ sender: 1, status: 1 });
exports.Connection = (0, mongoose_1.model)('Connection', connectionSchema);
