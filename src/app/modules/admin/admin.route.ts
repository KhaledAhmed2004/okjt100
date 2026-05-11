import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { AdminController } from './admin.controller';
import { UserController } from '../user/user.controller';
import validateRequest from '../../middlewares/validateRequest';
import { UserValidation } from '../user/user.validation';

const router = express.Router();

// --- Dashboard Metrics ---

router.get(
  '/growth-metrics',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getDashboardStats,
);

// Preference cards monthly trend (each month’s count)
router.get(
  '/preference-cards/trends/monthly',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getPreferenceCardMonthly,
);

// Active subscriptions monthly trend (each month’s count)
router.get(
  '/subscriptions/trends/monthly',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getActiveSubscriptionMonthly,
);

// --- User Management (Admin Only) ---

// Get user growth statistics
router.get(
  '/users/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUsersStats,
);

// List all users with stats (Admin)
router.get(
  '/users',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getAllUserRoles,
);

// Get specific user details by ID (Admin)
router.get(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUserById,
);

// Admin: Update any user (Update fields including specialty, role, status)
router.patch(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.adminUpdateUserZodSchema),
  UserController.adminUpdateUser,
);

// Admin: Delete user permanently
router.delete(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.deleteUser,
);

export const AdminRoutes = router;
