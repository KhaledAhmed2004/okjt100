import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';
import QueryBuilder from '../../builder/QueryBuilder';
import { INotification } from './notification.interface';
import { Notification } from './notification.model';
import { SentNotification } from './sentNotification.model';
import { User } from '../user/user.model';
import { USER_ROLES } from '../../../enums/user';

// get notifications
const getNotificationFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>
) => {
  const notificationQuery = new QueryBuilder<INotification>(
    Notification.find({ receiver: user.id }),
    query
  )
    .search(['title', 'text'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await notificationQuery.modelQuery;
  const pagination = await notificationQuery.getPaginationInfo();

  // Format data to match the requested structure
  const formattedData = data.map((item: any) => {
    const doc = item.toObject();
    return {
      id: doc._id,
      type: doc.type,
      title: doc.title,
      text: doc.text,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
      resource: doc.resourceType ? {
        type: doc.resourceType,
        id: doc.resourceId
      } : null
    };
  });

  const unreadCount = await Notification.countDocuments({
    receiver: user.id,
    isRead: false,
  });

  return {
    data: formattedData,
    pagination,
    unreadCount,
  };
};

const markNotificationAsReadIntoDB = async (
  notificationId: string,
  userId: string
) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, receiver: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }

  return notification;
};

const markAllNotificationsAsRead = async (userId: string) => {
  const result = await Notification.updateMany(
    { receiver: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return {
    modifiedCount: result.modifiedCount,
    message: 'All notifications marked as read',
  };
};

// Send notification via NotificationBuilder + save sent record
const sendAdminNotification = async (
  title: string,
  text: string,
  audience: string,
) => {
  const builder = new NotificationBuilder()
    .setTitle(title)
    .setText(text)
    .setType('ADMIN')
    .viaDatabase()
    .viaSocket()
    .viaPush();

  if (audience === 'ALL') {
    // Target all common user roles
    const users = await User.find({
      role: { $in: [USER_ROLES.BROTHER, USER_ROLES.SISTER] },
    }).select('_id');
    builder.toMany(users.map(u => u._id));
  } else if ([USER_ROLES.BROTHER, USER_ROLES.SISTER].includes(audience as USER_ROLES)) {
    // Dynamic role targeting (restricted to BROTHER and SISTER)
    builder.toRole(audience);
  } else {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid audience type');
  }

  const result = await builder.sendNow();
  const recipientCount = result.sent.database || result.sent.socket || 0;

  // Save sent record for history
  await SentNotification.create({
    title,
    text,
    audience,
    recipientCount,
  });

  return { recipientCount };
};

// Get sent notification history
const getSentHistory = async (query: Record<string, unknown>) => {
  const sentQuery = new QueryBuilder(
    SentNotification.find(),
    query,
  )
    .search(['title', 'text'])
    .filter()
    .sort()
    .paginate();

  const data = await sentQuery.modelQuery;
  const pagination = await sentQuery.getPaginationInfo();
  return { pagination, data };
};

export const NotificationService = {
  getNotificationFromDB,
  markNotificationAsReadIntoDB,
  markAllNotificationsAsRead,
  sendAdminNotification,
  getSentHistory,
};
