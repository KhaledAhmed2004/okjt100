import { Model, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'ADMIN',
  'SYSTEM',
  'QUESTION_ANSWERED',
  'NEW_QUESTION',
  'POST_LIKED',
  'POST_COMMENTED',
  'COMMENT_REPLIED',
  'CONTENT_LIKED',
  'CONTENT_COMMENTED',
  'NEW_CONTENT',
  'NEW_KHUTBAH',
  'MOSQUE_UPDATE',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationResourceType =
  | 'AskQuestion'
  | 'GroupPost'
  | 'LearningContent'
  | 'Khutbah'
  | 'Mosque'
  | 'User'
  | string;

export type NotificationLink = {
  label: string;
  url: string;
};

export type INotification = {
  _id?: Types.ObjectId;
  receiver: Types.ObjectId;
  type: NotificationType;
  title: string;
  text: string;
  isRead: boolean;
  readAt?: Date | null;
  
  // Polymorphic reference
  resourceType?: NotificationResourceType;
  resourceId?: string;
  
  link?: NotificationLink;
  metadata?: Record<string, unknown>;

  icon?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Notification = INotification;
export type NotificationModel = Model<INotification, Record<string, unknown>>;
