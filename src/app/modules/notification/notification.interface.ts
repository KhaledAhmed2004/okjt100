import { Model, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'PREFERENCE_CARD_CREATED',
  'EVENT_SCHEDULED',
  'GENERAL',
  'ADMIN',
  'SYSTEM',
  'MESSAGE',
  'REMINDER',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationResourceType = 'PreferenceCard' | 'Event' | 'User' | string;

export type NotificationLink = {
  label: string;
  url: string;
};

export type INotification = {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  subtitle?: string;

  resourceType?: NotificationResourceType;
  resourceId?: string;

  link?: NotificationLink;
  metadata?: Record<string, unknown>;

  isRead?: boolean;
  readAt?: Date | null;
  deletedAt?: Date | null;

  icon?: string;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Notification = INotification;
export type NotificationModel = Model<INotification, Record<string, unknown>>;
