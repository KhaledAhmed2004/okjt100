import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../app';
import { User } from './user.model';
import { Connection } from '../connection/connection.model';
import { jwtHelper } from '../../../helpers/jwtHelper';
import config from '../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';

vi.mock('../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
}));

vi.mock('../../../helpers/captchaHelper', () => ({
  captchaHelper: {
    verify: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../../helpers/authHelpers', () => ({
  sendVerificationOTP: vi.fn().mockResolvedValue(true),
}));

let replSet: MongoMemoryReplSet;

async function createAuthUser(role: USER_ROLES, status: USER_STATUS = USER_STATUS.ACTIVE) {
  const user = await User.create({
    name: `Test ${role}`,
    role,
    email: `test-${role}-${Math.random()}@example.com`,
    password: 'password123',
    isVerified: true,
    status,
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
  });

  const token = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    config.jwt.jwt_secret as Secret,
    '1h'
  );

  return { user, token };
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create();
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Connection.deleteMany({});
});

describe('User Profile APIs', () => {
  describe('Admin View: GET /api/v1/users/:userId', () => {
    it('allows Admin to get any user by ID', async () => {
      const { token: adminToken } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const { user: targetUser } = await createAuthUser(USER_ROLES.BROTHER);

      const response = await request(app)
        .get(`/api/v1/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(targetUser.email);
    });

    it('forbids regular user from accessing Admin-only endpoint', async () => {
      const { token: brotherToken } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: targetBrother } = await createAuthUser(USER_ROLES.BROTHER);

      const response = await request(app)
        .get(`/api/v1/users/${targetBrother._id}`)
        .set('Authorization', `Bearer ${brotherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("You don't have permission to access this API");
    });
  });

  describe('Public View: GET /api/v1/users/:userId/public', () => {
    it('allows User (BROTHER) to get another BROTHER profile', async () => {
      const { token: brotherToken } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: targetBrother } = await createAuthUser(USER_ROLES.BROTHER);

      const response = await request(app)
        .get(`/api/v1/users/${targetBrother._id}/public`)
        .set('Authorization', `Bearer ${brotherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(targetBrother.name);
      // Sensitive fields should be missing (email is not selected in getUserDetailsByIdFromDB)
      expect(response.body.data.email).toBeUndefined();
    });

    it('forbids User (BROTHER) to get a SISTER profile', async () => {
      const { token: brotherToken } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: targetSister } = await createAuthUser(USER_ROLES.SISTER);

      const response = await request(app)
        .get(`/api/v1/users/${targetSister._id}/public`)
        .set('Authorization', `Bearer ${brotherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("You don't have permission to view this profile");
    });

    it('returns 404 for non-active user when requested by regular user', async () => {
      const { token: brotherToken } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: pendingUser } = await createAuthUser(USER_ROLES.BROTHER, USER_STATUS.PENDING);

      const response = await request(app)
        .get(`/api/v1/users/${pendingUser._id}/public`)
        .set('Authorization', `Bearer ${brotherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it('returns profile details with connection: null when no connection exists', async () => {
      const { token: brotherToken } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: targetBrother } = await createAuthUser(USER_ROLES.BROTHER);

      const response = await request(app)
        .get(`/api/v1/users/${targetBrother._id}/public`)
        .set('Authorization', `Bearer ${brotherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connection).toBeNull();
    });

    it('returns profile details with connection status PENDING and direction OUTGOING when a request is sent by requester', async () => {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: userB } = await createAuthUser(USER_ROLES.BROTHER);

      const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
      const connection = await Connection.create({
        sender: userA._id,
        receiver: userB._id,
        connectionKey,
        status: 'PENDING',
      });

      const response = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connection).toBeDefined();
      expect(response.body.data.connection.status).toBe('PENDING');
      expect(response.body.data.connection.direction).toBe('OUTGOING');
      expect(response.body.data.connection.id).toBe(connection._id.toString());
    });

    it('returns profile details with connection status PENDING and direction INCOMING when a request is received by requester', async () => {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: userB } = await createAuthUser(USER_ROLES.BROTHER);

      const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
      const connection = await Connection.create({
        sender: userB._id,
        receiver: userA._id,
        connectionKey,
        status: 'PENDING',
      });

      const response = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connection).toBeDefined();
      expect(response.body.data.connection.status).toBe('PENDING');
      expect(response.body.data.connection.direction).toBe('INCOMING');
      expect(response.body.data.connection.id).toBe(connection._id.toString());
    });

    it('returns profile details with connection status ACCEPTED and omitted direction when connection is accepted', async () => {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER);
      const { user: userB } = await createAuthUser(USER_ROLES.BROTHER);

      const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
      const fakeChatId = new mongoose.Types.ObjectId();
      const connection = await Connection.create({
        sender: userA._id,
        receiver: userB._id,
        connectionKey,
        status: 'ACCEPTED',
        chatId: fakeChatId,
      });

      const response = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connection).toBeDefined();
      expect(response.body.data.connection.status).toBe('ACCEPTED');
      expect(response.body.data.connection.direction).toBeUndefined();
      expect(response.body.data.connection.id).toBe(connection._id.toString());
      expect(response.body.data.connection.chatId).toBe(fakeChatId.toString());
    });
  });
});
