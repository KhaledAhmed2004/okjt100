import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import { fileHandler } from '../../middlewares/fileHandler';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import { idempotency } from '../../middlewares/idempotency';
import { verifyCaptcha } from '../../middlewares/captcha';
import express from 'express';

const router = express.Router();

// --- Public / General ---

// Create new user (Public Registration)
router.post(
  '/',
  rateLimitMiddleware({
    windowMs: 3600_000, // 1 hour
    max: 5,
    routeName: 'registration',
  }),
  idempotency('registration'),
  fileHandler([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
    { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
    { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
  ], { maxFileSizeMB: 100 }),
  validateRequest(UserValidation.createUserZodSchema),
  verifyCaptcha(),
  UserController.createUser,
);

// Re-verification of a REJECTED account. PUBLIC (no auth) because
// REJECTED users are blocked by both login and the auth middleware —
// the only recovery path is the one-time token they received by email
// when the admin rejected them. Accepts the new verification artefacts
// (image + video, optional profileImage) as multipart.
router.post(
  '/reverify',
  rateLimitMiddleware({
    windowMs: 3600_000, // 1 hour
    max: 5,
    routeName: 'reverify',
  }),
  idempotency('reverify'),
  fileHandler(
    [
      { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
      { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
      { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
    ],
    { maxFileSizeMB: 100 },
  ),
  validateRequest(UserValidation.reverifyAccountZodSchema),
  UserController.reverifyAccount,
);

// Public user details (Authenticated users only) — rate limited
router.get(
  '/:userId/user',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-details',
  }),
  validateRequest(UserValidation.getUserDetailsZodSchema),
  UserController.getUserDetailsById,
);

// --- Self Management (User/Doctor) ---

// Fetch own profile details
router.get(
  '/profile',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  UserController.getUserProfile,
);

// Update own profile
router.patch(
  '/profile',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  fileHandler([{ name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' }]),
  validateRequest(UserValidation.updateUserZodSchema),
  UserController.updateProfile,
);

// Mark onboarding as completed
router.patch(
  '/complete-onboarding',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  UserController.completeOnboarding,
);

// Request account self-deletion (soft-delete with 30-day recovery window).
// Restore happens through POST /auth/restore-account.
router.delete(
  '/me',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  idempotency('account-delete'),
  validateRequest(UserValidation.deleteAccountZodSchema),
  UserController.requestAccountDeletion,
);

// Email-change: 2-step OTP flow. Step 1 — request: validates current
// password, stores pending newEmail + 6-digit OTP, sends OTP to NEW
// address and a heads-up to the OLD address.
router.post(
  '/me/email-change/request',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  idempotency('email-change-request'),
  validateRequest(UserValidation.requestEmailChangeZodSchema),
  UserController.requestEmailChange,
);

// Email-change: Step 2 — confirm. Verifies the OTP, commits the new
// email, bumps tokenVersion (every JWT under the old email becomes
// invalid), and clears the refresh cookie.
router.post(
  '/me/email-change/confirm',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  idempotency('email-change-confirm'),
  validateRequest(UserValidation.confirmEmailChangeZodSchema),
  UserController.confirmEmailChange,
);

// GDPR data export — returns everything the system stores about the
// requesting user as a JSON envelope.
router.post(
  '/me/data-export',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  idempotency('data-export'),
  UserController.exportMyData,
);

// Sessions — list every device this user has logged in from. Returns
// metadata only; never the raw FCM/APNs token.
router.get(
  '/me/sessions',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  UserController.listMySessions,
);

// Revoke EVERY session (logout-all-devices). Bumps tokenVersion so
// every issued JWT becomes invalid. Fixed path — must be declared
// before `:tokenId` so Express doesn't match `revoke-all` as an id.
router.post(
  '/me/sessions/revoke-all',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  idempotency('sessions-revoke-all'),
  UserController.revokeAllMySessions,
);

// Revoke ONE specific session by its subdoc id. Only removes that
// device from push delivery; the JWT remains valid until natural
// expiry (short-lived).
router.delete(
  '/me/sessions/:tokenId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(UserValidation.revokeSessionZodSchema),
  UserController.revokeMySession,
);

export const UserRoutes = router;
