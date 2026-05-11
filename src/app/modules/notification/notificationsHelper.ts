import { INotification } from './notification.interface';
import { Notification } from './notification.model';
import { User } from '../user/user.model';
import { pushNotificationHelper } from './pushNotificationHelper';

export const sendNotifications = async (data: Partial<INotification>): Promise<INotification> => {
  // Set default expiry to 30 days if not provided
  if (!data.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    data.expiresAt = expiryDate;
  }

  const result = await Notification.create(data);

  const user = await User.findById(data?.userId);

  // Extract raw token strings from the deviceTokens sub-document array.
  const tokens = Array.isArray(user?.deviceTokens)
    ? user!.deviceTokens.map(entry => entry?.token).filter(Boolean) as string[]
    : [];

  if (tokens.length > 0) {
    const message = {
      notification: {
        title: data?.title || 'TBSosick Notification',
        body: data?.subtitle || data?.title || '',
      },
      tokens,
    };

    try {
      await pushNotificationHelper.sendPushNotifications(message);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  //@ts-ignore
  const socketIo = global.io;
  if (socketIo) {
    socketIo.to(`user::${data?.userId}`).emit('notification:new', result);
    // Legacy alias — kept for older mobile clients
    socketIo.emit(`get-notification::${data?.userId}`, result);
  }

  return result;
};

