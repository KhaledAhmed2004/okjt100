import express from 'express';
import auth from '../../middlewares/auth';
import { ChatController } from './chat.controller';
import { USER_ROLES } from '../../../enums/user';
const router = express.Router();

// ============ SHARED ROUTES (Student / Tutor / Admin) ============

// Create or get a chat with another user
router.post(
  '/:otherUserId',
  auth(USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.SUPER_ADMIN),
  ChatController.createChat
);

// Get all chats for the logged-in user
router.get(
  '/',
  auth(USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.SUPER_ADMIN),
  ChatController.getChat
);

export const ChatRoutes = router;
