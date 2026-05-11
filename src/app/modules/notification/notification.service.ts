import { NotificationModel } from './notification.model';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { sendNotifications } from './notificationsHelper';
import { Types } from 'mongoose';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type Cursor = { createdAt: string; _id: string };

const encodeCursor = (createdAt: Date, id: Types.ObjectId | string): string =>
  Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), _id: id.toString() }),
  ).toString('base64url');

const decodeCursor = (raw: string): Cursor => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed?.createdAt || !parsed?._id) throw new Error('shape');
    return parsed as Cursor;
  } catch {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
};

type ListQuery = { cursor?: string; limit?: string; unread?: string };

const listForUser = async (userId: string, query: ListQuery = {}) => {
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const baseMatch: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    deletedAt: null,
  };

  const listMatch: Record<string, unknown> = { ...baseMatch };
  if (query.unread === 'true') listMatch.isRead = false;

  if (query.cursor) {
    const c = decodeCursor(query.cursor);
    const cursorDate = new Date(c.createdAt);
    listMatch.$or = [
      { createdAt: { $lt: cursorDate } },
      {
        createdAt: cursorDate,
        _id: { $lt: new Types.ObjectId(c._id) },
      },
    ];
  }

  // Fetch limit + 1 to detect hasMore without a count query.
  const rows = await NotificationModel.find(listMatch)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor(last.createdAt as Date, last._id as Types.ObjectId)
      : null;

  const unreadCount = await NotificationModel.countDocuments({
    ...baseMatch,
    isRead: false,
  });

  return {
    data: page,
    meta: { limit, nextCursor, hasMore, unreadCount },
  };
};

const markAllRead = async (userId: string) => {
  const result = await NotificationModel.updateMany(
    { userId: new Types.ObjectId(userId), isRead: false, deletedAt: null },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return { updated: result.modifiedCount };
};

const markRead = async (id: string, userId: string, read = true) => {
  const doc = await NotificationModel.findById(id);
  if (!doc || doc.deletedAt) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }
  if (doc.userId?.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed');
  }

  doc.isRead = read;
  doc.readAt = read ? new Date() : null;
  await doc.save();
  return { _id: doc._id, isRead: doc.isRead, readAt: doc.readAt };
};

const deleteById = async (id: string, userId: string) => {
  const doc = await NotificationModel.findById(id);
  if (!doc) throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  if (doc.userId?.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not allowed');
  }

  // Idempotent: re-deleting an already soft-deleted row is a no-op success.
  if (!doc.deletedAt) {
    doc.deletedAt = new Date();
    await doc.save();
  }
  return null;
};

const createForPreferenceCard = async (params: {
  userId: string;
  cardId: string;
  cardTitle: string;
  surgeonName?: string;
  procedure?: string;
}) => {
  const subtitle = params.surgeonName && params.procedure
    ? `${params.surgeonName} — ${params.procedure}`
    : params.cardTitle;

  return sendNotifications({
    userId: new Types.ObjectId(params.userId),
    type: 'PREFERENCE_CARD_CREATED',
    title: 'New Card Added',
    subtitle,
    link: { label: 'View Card', url: `/cards/${params.cardId}` },
    resourceType: 'PreferenceCard',
    resourceId: params.cardId,
    isRead: false,
    icon: 'card',
  });
};

const createForEventScheduled = async (params: {
  userId: string;
  eventId: string;
  title: string;
  whenText?: string;
}) => {
  return sendNotifications({
    userId: new Types.ObjectId(params.userId),
    type: 'EVENT_SCHEDULED',
    title: 'Event Scheduled',
    subtitle: `${params.title}${params.whenText ? ' on ' + params.whenText : ''}`,
    link: { label: 'View Event', url: `/events/${params.eventId}` },
    resourceType: 'Event',
    resourceId: params.eventId,
    isRead: false,
    icon: 'calendar',
  });
};

export const NotificationService = {
  listForUser,
  markAllRead,
  markRead,
  deleteById,
  createForPreferenceCard,
  createForEventScheduled,
};
