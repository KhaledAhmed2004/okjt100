import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { NotificationController } from './notification.controller';
import validateRequest from '../../middlewares/validateRequest';
import {
  listNotificationsSchema,
  markReadSchema,
  paramIdSchema,
} from './notification.validation';

const router = express.Router();

// Notification list + unread count
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(listNotificationsSchema),
  NotificationController.listMyNotifications
);

// Mark specific notification as read
router.patch(
  '/:notificationId/read',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(markReadSchema),
  NotificationController.markRead
);

// Mark all notifications as read
router.patch(
  '/read-all',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  NotificationController.markAllRead
);

// Delete notification
router.delete(
  '/:notificationId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(paramIdSchema),
  NotificationController.deleteNotification
);

export const NotificationRoutes = router;


