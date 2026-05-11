"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModel = exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const notification_interface_1 = require("./notification.interface");
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: notification_interface_1.NOTIFICATION_TYPES,
        required: true,
    },
    title: { type: String, required: true },
    subtitle: { type: String },
    resourceType: { type: String },
    resourceId: { type: String },
    link: {
        label: { type: String },
        url: { type: String },
    },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    icon: { type: String },
    expiresAt: { type: Date },
}, { timestamps: true });
// Covers list (sort by createdAt desc, filter by deletedAt:null) and unread count
NotificationSchema.index({ userId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, deletedAt: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ resourceType: 1, resourceId: 1 });
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
exports.NotificationModel = exports.Notification;
