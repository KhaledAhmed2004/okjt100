import { Schema, model } from 'mongoose';
import { INotification, NOTIFICATION_TYPES } from './notification.interface';

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
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
    metadata: { type: Schema.Types.Mixed },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },

    icon: { type: String },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

// Covers list (sort by createdAt desc, filter by deletedAt:null) and unread count
NotificationSchema.index({ userId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, deletedAt: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ resourceType: 1, resourceId: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
export const NotificationModel = Notification;
