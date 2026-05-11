import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { NotificationService } from './notification.service';
import { JwtPayload } from 'jsonwebtoken';

const listMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await NotificationService.listForUser(
    (user as any).id,
    req.query as any,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'OK',
    meta: result.meta,
    data: result.data,
  });
});

const markAllRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await NotificationService.markAllRead((user as any).id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All notifications marked as read',
    data: result,
  });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const read = req.body?.read ?? true;
  const result = await NotificationService.markRead(
    req.params.notificationId,
    (user as any).id,
    read,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: read
      ? 'Notification marked as read'
      : 'Notification marked as unread',
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  await NotificationService.deleteById(
    req.params.notificationId,
    (user as any).id,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notification deleted',
    data: null,
  });
});

export const NotificationController = {
  listMyNotifications,
  markAllRead,
  markRead,
  deleteNotification,
};
