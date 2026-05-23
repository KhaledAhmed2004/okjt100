import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { UserValidation } from '../user.validation';

// ── Mocks (must come before any local imports) ────────────────────────────────

// emailHelper.enqueue — sends real emails in production; we never want that
// in a test environment, so stub it to a no-op.
vi.mock('../../../helpers/emailHelper', () => ({
  emailHelper: {
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
}));

// sendVerificationOTP is called by resendVerifyEmail; suppress it too so
// none of our setup helpers accidentally try to open a mailer connection.
vi.mock('../../../helpers/authHelpers', () => ({
  sendVerificationOTP: vi.fn().mockResolvedValue(undefined),
}));

// config — override only the values that the AuthService reads at runtime
// so JWT signing actually works in a test environment without a real .env file.
vi.mock('../../../config', () => ({
  default: {
    jwt: {
      jwt_secret: 'test-secret-jummah-integration',
      jwt_expire_in: '1h',
      jwt_refresh_secret: 'test-refresh-secret-jummah',
      jwt_refresh_expire_in: '7d',
    },
    bcrypt_salt_rounds: '10',
  },
}));

// ── Imports (must come AFTER vi.mock blocks) ──────────────────────────────────
import { AuthService } from '../../auth/auth.service';
import { User } from '../user.model';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { OTP_TTL_MS } from '../../../../config/auth.constants';

// ── Shared test state ─────────────────────────────────────────────────────────
let replSet: MongoMemoryReplSet;

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Directly inserts a JUMMAH user into the DB with a live OTP so we can
 * call verifyEmailToDB without going through the HTTP registration flow.
 * This mirrors how the connection tests create users — directly via the model.
 */
async function createJummahWithOtp(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  const otp = '123456';

  const user = await User.create({
    name: `Jummah User ${tag}`,
    role: USER_ROLES.JUMMAH,
    email: `jummah-${tag}@example.com`,
    password: 'Password@123',
    dateOfBirth: new Date('1995-06-15'),
    profileImage: '/default-avatar.svg',
    status: USER_STATUS.PENDING,
    isVerified: false,
    // Embedded OTP — mirroring what sendVerificationOTP writes to the DB
    authentication: {
      oneTimeCode: otp,
      expireAt: new Date(Date.now() + OTP_TTL_MS),
      isResetPassword: false,
    },
  });

  return { user, otp };
}

/**
 * Directly inserts a BROTHER user into the DB with a live OTP.
 * Includes the full set of fields that BROTHER / SISTER require.
 */
async function createBrotherWithOtp(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  const otp = '654321';

  const user = await User.create({
    name: `Brother User ${tag}`,
    role: USER_ROLES.BROTHER,
    email: `brother-${tag}@example.com`,
    password: 'Password@123',
    dateOfBirth: new Date('1992-03-10'),
    revertDate: new Date('2018-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
    status: USER_STATUS.PENDING,
    isVerified: false,
    authentication: {
      oneTimeCode: otp,
      expireAt: new Date(Date.now() + OTP_TTL_MS),
      isResetPassword: false,
    },
  });

  return { user, otp };
}

/**
 * Directly inserts a SISTER user into the DB with a live OTP.
 */
async function createSisterWithOtp(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  const otp = '789012';

  const user = await User.create({
    name: `Sister User ${tag}`,
    role: USER_ROLES.SISTER,
    email: `sister-${tag}@example.com`,
    password: 'Password@123',
    dateOfBirth: new Date('1998-11-20'),
    revertDate: new Date('2019-06-15'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/sis-img.jpg',
    verificationVideo: 'https://example.com/sis-vid.mp4',
    status: USER_STATUS.PENDING,
    isVerified: false,
    authentication: {
      oneTimeCode: otp,
      expireAt: new Date(Date.now() + OTP_TTL_MS),
      isResetPassword: false,
    },
  });

  return { user, otp };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('User Role Integration — JUMMAH vs BROTHER/SISTER', () => {

  // ── 1. Mongoose Schema Validation ──────────────────────────────────────────
  describe('Mongoose Schema Validators', () => {
    it('JUMMAH: successfully creates a user with only name, email, password, and dateOfBirth', async () => {
      const user = await User.create({
        name: 'Valid Jummah',
        role: USER_ROLES.JUMMAH,
        email: 'valid-jummah@example.com',
        password: 'Password@123',
        dateOfBirth: new Date('1998-05-10'),
        profileImage: '/default-avatar.svg',
      });

      console.log('--- JUMMAH schema creation ---\n', JSON.stringify({
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
      }, null, 2));

      expect(user.role).toBe(USER_ROLES.JUMMAH);
      expect(user.status).toBe(USER_STATUS.PENDING);
      expect(user.isVerified).toBe(false);
      // These fields must NOT be present/required for JUMMAH
      expect(user.revertDate).toBeUndefined();
      expect(user.verificationImage).toBeUndefined();
      expect(user.verificationVideo).toBeUndefined();
    });

    it('JUMMAH: rejects creation when dateOfBirth is missing', async () => {
      await expect(
        User.create({
          name: 'Missing DOB Jummah',
          role: USER_ROLES.JUMMAH,
          email: 'nodob-jummah@example.com',
          password: 'Password@123',
          profileImage: '/default-avatar.svg',
          // dateOfBirth intentionally omitted
        })
      ).rejects.toThrow(/dateOfBirth|Path `dateOfBirth` is required/i);
    });

    it('BROTHER: successfully creates a user with all required fields', async () => {
      const user = await User.create({
        name: 'Valid Brother',
        role: USER_ROLES.BROTHER,
        email: 'valid-brother@example.com',
        password: 'Password@123',
        dateOfBirth: new Date('1993-08-25'),
        revertDate: new Date('2017-12-01'),
        profileImage: '/default-avatar.svg',
        verificationImage: 'https://example.com/bro-img.jpg',
        verificationVideo: 'https://example.com/bro-vid.mp4',
      });

      expect(user.role).toBe(USER_ROLES.BROTHER);
      expect(user.revertDate).toBeDefined();
      expect(user.verificationImage).toBeDefined();
      expect(user.verificationVideo).toBeDefined();
    });

    it('BROTHER: rejects creation when revertDate is missing', async () => {
      await expect(
        User.create({
          name: 'No RevertDate Brother',
          role: USER_ROLES.BROTHER,
          email: 'no-revert-brother@example.com',
          password: 'Password@123',
          dateOfBirth: new Date('1993-08-25'),
          profileImage: '/default-avatar.svg',
          verificationImage: 'https://example.com/img.jpg',
          verificationVideo: 'https://example.com/vid.mp4',
          // revertDate intentionally omitted
        })
      ).rejects.toThrow(/revertDate|Path `revertDate` is required/i);
    });

    it('BROTHER: rejects creation when verificationImage is missing', async () => {
      await expect(
        User.create({
          name: 'No Img Brother',
          role: USER_ROLES.BROTHER,
          email: 'no-img-brother@example.com',
          password: 'Password@123',
          dateOfBirth: new Date('1993-08-25'),
          revertDate: new Date('2017-01-01'),
          profileImage: '/default-avatar.svg',
          // verificationImage intentionally omitted
          verificationVideo: 'https://example.com/vid.mp4',
        })
      ).rejects.toThrow(/verificationImage|Path `verificationImage` is required/i);
    });

    it('BROTHER: rejects creation when verificationVideo is missing', async () => {
      await expect(
        User.create({
          name: 'No Vid Brother',
          role: USER_ROLES.BROTHER,
          email: 'no-vid-brother@example.com',
          password: 'Password@123',
          dateOfBirth: new Date('1993-08-25'),
          revertDate: new Date('2017-01-01'),
          profileImage: '/default-avatar.svg',
          verificationImage: 'https://example.com/img.jpg',
          // verificationVideo intentionally omitted
        })
      ).rejects.toThrow(/verificationVideo|Path `verificationVideo` is required/i);
    });

    it('SISTER: rejects creation when revertDate is missing', async () => {
      await expect(
        User.create({
          name: 'No RevertDate Sister',
          role: USER_ROLES.SISTER,
          email: 'no-revert-sister@example.com',
          password: 'Password@123',
          dateOfBirth: new Date('1997-03-15'),
          profileImage: '/default-avatar.svg',
          verificationImage: 'https://example.com/sis-img.jpg',
          verificationVideo: 'https://example.com/sis-vid.mp4',
          // revertDate intentionally omitted
        })
      ).rejects.toThrow(/revertDate|Path `revertDate` is required/i);
    });
  });

  // ── 2. JUMMAH Email Verification → Auto-Activation + Auto-Login ────────────
  describe('verifyEmailToDB — JUMMAH (auto-activate + auto-login)', () => {
    it('sets status to ACTIVE and returns tokens immediately upon OTP verification', async () => {
      const { user, otp } = await createJummahWithOtp('verify-active');

      const result = await AuthService.verifyEmailToDB({
        email: user.email as string,
        otp,
      });

      console.log('--- JUMMAH verifyEmail Response ---\n', JSON.stringify(result, null, 2));

      // Must return auth tokens (auto-login)
      expect(result.tokens).toBeDefined();
      expect(result.tokens).not.toBeNull();
      expect(result.tokens?.accessToken).toBeDefined();
      expect(result.tokens?.refreshToken).toBeDefined();

      // Confirm the DB record was updated correctly
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.isVerified).toBe(true);
      expect(updatedUser?.status).toBe(USER_STATUS.ACTIVE);

      // OTP must be cleared from DB (single-use)
      const withAuth = await User.findById(user._id).select('+authentication');
      expect((withAuth as any).authentication?.oneTimeCode).toBeNull();
    });

    it('does NOT return "pending admin approval" message for JUMMAH', async () => {
      const { user, otp } = await createJummahWithOtp('no-admin-msg');

      const result = await AuthService.verifyEmailToDB({
        email: user.email as string,
        otp,
      });

      // The "pending admin approval" message is only sent for BROTHER/SISTER
      expect(result.message).not.toContain('admin approval');
    });

    it('throws 400 when OTP is expired for JUMMAH', async () => {
      const tag = `${Date.now()}-expired`;
      const otp = '000000';

      await User.create({
        name: `Expired OTP Jummah ${tag}`,
        role: USER_ROLES.JUMMAH,
        email: `expired-jummah-${tag}@example.com`,
        password: 'Password@123',
        dateOfBirth: new Date('1995-06-15'),
        profileImage: '/default-avatar.svg',
        status: USER_STATUS.PENDING,
        isVerified: false,
        authentication: {
          oneTimeCode: otp,
          // Expired 10 minutes ago
          expireAt: new Date(Date.now() - 10 * 60 * 1000),
          isResetPassword: false,
        },
      });

      await expect(
        AuthService.verifyEmailToDB({ email: `expired-jummah-${tag}@example.com`, otp })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired verification code',
      });
    });

    it('throws 400 when OTP is wrong for JUMMAH', async () => {
      const { user } = await createJummahWithOtp('wrong-otp');

      await expect(
        AuthService.verifyEmailToDB({
          email: user.email as string,
          otp: '999999', // wrong OTP
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired verification code',
      });
    });
  });

  // ── 3. BROTHER Email Verification → PENDING (awaits admin approval) ─────────
  describe('verifyEmailToDB — BROTHER (stays PENDING, no tokens)', () => {
    it('keeps status PENDING and returns NO tokens after OTP verification', async () => {
      const { user, otp } = await createBrotherWithOtp('pending-check');

      const result = await AuthService.verifyEmailToDB({
        email: user.email as string,
        otp,
      });

      console.log('--- BROTHER verifyEmail Response ---\n', JSON.stringify(result, null, 2));

      // BROTHER must NOT receive auth tokens — they need admin approval first
      expect(result.tokens).toBeNull();

      // Message must mention admin approval
      expect(result.message).toContain('admin approval');

      // DB: isVerified = true but status must remain PENDING
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.isVerified).toBe(true);
      expect(updatedUser?.status).toBe(USER_STATUS.PENDING);
    });

    it('returns the user email and verification status in the response data', async () => {
      const { user, otp } = await createBrotherWithOtp('data-shape');

      const result = await AuthService.verifyEmailToDB({
        email: user.email as string,
        otp,
      });

      expect(result.data).toBeDefined();
      expect((result.data as any).email).toBe(user.email);
      expect((result.data as any).isVerified).toBe(true);
      expect((result.data as any).status).toBe(USER_STATUS.PENDING);
    });
  });

  // ── 4. SISTER Email Verification → PENDING (awaits admin approval) ──────────
  describe('verifyEmailToDB — SISTER (stays PENDING, no tokens)', () => {
    it('keeps status PENDING and returns NO tokens after OTP verification', async () => {
      const { user, otp } = await createSisterWithOtp('sister-pending');

      const result = await AuthService.verifyEmailToDB({
        email: user.email as string,
        otp,
      });

      console.log('--- SISTER verifyEmail Response ---\n', JSON.stringify(result, null, 2));

      // SISTER must NOT receive auth tokens
      expect(result.tokens).toBeNull();

      // Message must mention admin approval
      expect(result.message).toContain('admin approval');

      // DB: isVerified = true, status stays PENDING
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.isVerified).toBe(true);
      expect(updatedUser?.status).toBe(USER_STATUS.PENDING);
    });
  });

  // ── 5. Zod Schema Validation (via UserValidation schemas) ──────────────────
  describe('Zod createUserZodSchema Validation', () => {
    it('JUMMAH: validates successfully with only name, email, password, dateOfBirth', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'Test Jummah',
          email: 'test-jummah@example.com',
          password: 'Password@123',
          role: USER_ROLES.JUMMAH,
          dateOfBirth: new Date('2000-01-15').toISOString(),
        },
      });

      console.log('--- Zod JUMMAH validation result ---\n', JSON.stringify(result, null, 2));

      expect(result.success).toBe(true);
    });

    it('JUMMAH: validates without revertDate (revertDate not required for JUMMAH)', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'No RevertDate Jummah',
          email: 'norevert-jummah@example.com',
          password: 'Password@123',
          role: USER_ROLES.JUMMAH,
          dateOfBirth: new Date('1999-07-22').toISOString(),
          // revertDate NOT provided — should still pass
        },
      });

      expect(result.success).toBe(true);
    });

    it('JUMMAH: fails validation when dateOfBirth is missing', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'No DOB Jummah',
          email: 'nodob-jummah@example.com',
          password: 'Password@123',
          role: USER_ROLES.JUMMAH,
          // dateOfBirth intentionally omitted
        },
      });

      expect(result.success).toBe(false);
      const issues = (result as any).error.issues;
      const dobIssue = issues.find((i: any) => i.path.includes('dateOfBirth'));
      expect(dobIssue).toBeDefined();
    });

    it('BROTHER: fails Zod validation when revertDate is missing', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'Brother No Revert',
          email: 'no-revert@example.com',
          password: 'Password@123',
          role: USER_ROLES.BROTHER,
          dateOfBirth: new Date('1993-08-25').toISOString(),
          verificationImage: 'https://example.com/img.jpg',
          verificationVideo: 'https://example.com/vid.mp4',
          // revertDate intentionally omitted
        },
      });

      expect(result.success).toBe(false);
      const issues = (result as any).error.issues;
      const revertIssue = issues.find((i: any) => i.path.includes('revertDate'));
      expect(revertIssue).toBeDefined();
      expect(revertIssue.message).toContain('Revert date is required');
    });

    it('SISTER: fails Zod validation when revertDate is missing', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'Sister No Revert',
          email: 'sis-no-revert@example.com',
          password: 'Password@123',
          role: USER_ROLES.SISTER,
          dateOfBirth: new Date('1997-03-15').toISOString(),
          verificationImage: 'https://example.com/sis-img.jpg',
          verificationVideo: 'https://example.com/sis-vid.mp4',
          // revertDate intentionally omitted
        },
      });

      expect(result.success).toBe(false);
      const issues = (result as any).error.issues;
      const revertIssue = issues.find((i: any) => i.path.includes('revertDate'));
      expect(revertIssue).toBeDefined();
      expect(revertIssue.message).toContain('Revert date is required');
    });

    it('BROTHER: validates successfully with all required fields', () => {
      const result = UserValidation.createUserZodSchema.safeParse({
        body: {
          name: 'Full Brother',
          email: 'full-brother@example.com',
          password: 'Password@123',
          role: USER_ROLES.BROTHER,
          dateOfBirth: new Date('1993-08-25').toISOString(),
          revertDate: new Date('2017-01-01').toISOString(),
          verificationImage: 'https://example.com/img.jpg',
          verificationVideo: 'https://example.com/vid.mp4',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 6. Status Transition Sanity ───────────────────────────────────────────
  describe('Status transitions after email verification', () => {
    it('JUMMAH ends in ACTIVE while BROTHER ends in PENDING after the same OTP flow', async () => {
      const { user: jummahUser, otp: jummahOtp } = await createJummahWithOtp('side-by-side-j');
      const { user: brotherUser, otp: brotherOtp } = await createBrotherWithOtp('side-by-side-b');

      // Verify both
      await AuthService.verifyEmailToDB({ email: jummahUser.email as string, otp: jummahOtp });
      await AuthService.verifyEmailToDB({ email: brotherUser.email as string, otp: brotherOtp });

      const freshJummah = await User.findById(jummahUser._id);
      const freshBrother = await User.findById(brotherUser._id);

      expect(freshJummah?.status).toBe(USER_STATUS.ACTIVE);
      expect(freshBrother?.status).toBe(USER_STATUS.PENDING);
    });

    it('JUMMAH returns tokens while SISTER returns null tokens after OTP flow', async () => {
      const { user: jummahUser, otp: jummahOtp } = await createJummahWithOtp('token-compare-j');
      const { user: sisterUser, otp: sisterOtp } = await createSisterWithOtp('token-compare-s');

      const jummahResult = await AuthService.verifyEmailToDB({
        email: jummahUser.email as string,
        otp: jummahOtp,
      });

      const sisterResult = await AuthService.verifyEmailToDB({
        email: sisterUser.email as string,
        otp: sisterOtp,
      });

      // JUMMAH → has tokens
      expect(jummahResult.tokens).toBeDefined();
      expect(jummahResult.tokens?.accessToken).toBeDefined();

      // SISTER → no tokens
      expect(sisterResult.tokens).toBeNull();
    });
  });
});
