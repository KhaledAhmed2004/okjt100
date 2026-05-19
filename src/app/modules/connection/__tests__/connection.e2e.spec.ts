/**
 * E2E tests for Connection module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks NotificationBuilder, Redis, and global Socket.io.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Connection } from '../connection.model';
import { CONNECTION_STATUS, CONNECTION_ACTION } from '../connection.constants';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../builder/NotificationBuilder/NotificationBuilder', () => {
  const mockSend = vi.fn().mockResolvedValue({ success: true });
  const mockBuilder = {
    to: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setType: vi.fn().mockReturnThis(),
    setResource: vi.fn().mockReturnThis(),
    viaAll: vi.fn().mockReturnThis(),
    send: mockSend,
  };
  return {
    default: vi.fn().mockImplementation(() => mockBuilder),
  };
});

vi.mock('../../notification/notificationsHelper', () => ({
  sendNotifications: vi.fn().mockResolvedValue(true),
}));

// Mock Redis to prevent connection issues
vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    mget: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
  },
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

let replSet: MongoMemoryReplSet;

/** Create a verified user and return its document and a valid JWT. */
async function createAuthUser(role: string = USER_ROLES.BROTHER, nameSuffix = 'user') {
  const user = await User.create({
    name: `Test ${role} ${nameSuffix}`,
    role,
    email: `test-${role}-${nameSuffix}-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
    tokenVersion: 0,
  });

  const token = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    config.jwt.jwt_secret as Secret,
    '1h',
  );

  return { user, token };
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Connection.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();

  // Mock global io
  (global as any).io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Connection E2E Tests', () => {
  describe('POST /api/v1/connections/request/:userId', () => {
    it('successfully sends a connection request', async () => {
      const { user: sender, token: senderToken } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      const response = await request(app)
        .post(`/api/v1/connections/request/${receiver._id}`)
        .set('Authorization', `Bearer ${senderToken}`);

      console.log('POST /api/v1/connections/request/:userId Request:\n', JSON.stringify({
        params: { userId: receiver._id.toString() },
        query: {},
        body: {},
      }, null, 2));
      console.log('POST /api/v1/connections/request/:userId Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sender).toBe(sender._id.toString());
      expect(response.body.data.receiver).toBe(receiver._id.toString());
      expect(response.body.data.status).toBe(CONNECTION_STATUS.PENDING);
    });

    it('returns 400 when trying to connect with yourself', async () => {
      const { user, token } = await createAuthUser(USER_ROLES.BROTHER, 'self');

      const response = await request(app)
        .post(`/api/v1/connections/request/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      console.log('POST /api/v1/connections/request/:userId (SELF) Request:\n', JSON.stringify({
        params: { userId: user._id.toString() },
        query: {},
        body: {},
      }, null, 2));
      console.log('POST /api/v1/connections/request/:userId (SELF) Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You cannot connect with yourself');
    });
  });

  describe('GET /api/v1/connections/status/:userId', () => {
    it('returns connection status between users', async () => {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER, 'userA');
      const { user: userB } = await createAuthUser(USER_ROLES.SISTER, 'userB');

      // Create a pending request
      await Connection.create({
        sender: userA._id,
        receiver: userB._id,
        connectionKey: `${userA._id}_${userB._id}`,
        status: CONNECTION_STATUS.PENDING,
      });

      const response = await request(app)
        .get(`/api/v1/connections/status/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      console.log('GET /api/v1/connections/status/:userId Request:\n', JSON.stringify({
        params: { userId: userB._id.toString() },
        query: {},
        body: {},
      }, null, 2));
      console.log('GET /api/v1/connections/status/:userId Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING_SENT');
    });
  });

  describe('GET /api/v1/connections/pending', () => {
    it('retrieves pending connection requests', async () => {
      const { user: sender } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver, token: receiverToken } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      // Create a pending request
      await Connection.create({
        sender: sender._id,
        receiver: receiver._id,
        connectionKey: `${sender._id}_${receiver._id}`,
        status: CONNECTION_STATUS.PENDING,
      });

      const response = await request(app)
        .get('/api/v1/connections/pending?type=received')
        .set('Authorization', `Bearer ${receiverToken}`);

      console.log('GET /api/v1/connections/pending Request:\n', JSON.stringify({
        params: {},
        query: { type: 'received' },
        body: {},
      }, null, 2));
      console.log('GET /api/v1/connections/pending Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sender.id).toBe(sender._id.toString());
    });
  });

  describe('GET /api/v1/connections', () => {
    it('retrieves all accepted connections', async () => {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER, 'userA');
      const { user: userB } = await createAuthUser(USER_ROLES.SISTER, 'userB');

      const chatId = new mongoose.Types.ObjectId();
      // Create an accepted connection
      await Connection.create({
        sender: userA._id,
        receiver: userB._id,
        connectionKey: `${userA._id}_${userB._id}`,
        status: CONNECTION_STATUS.ACCEPTED,
        chatId,
      });

      const response = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`);

      console.log('GET /api/v1/connections Request:\n', JSON.stringify({
        params: {},
        query: {},
        body: {},
      }, null, 2));
      console.log('GET /api/v1/connections Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].chatId).toBe(chatId.toString());
    });
  });

  describe('PATCH /api/v1/connections/:connectionId', () => {
    it('successfully responds (accepts) a connection request', async () => {
      const { user: sender } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver, token: receiverToken } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      const conn = await Connection.create({
        sender: sender._id,
        receiver: receiver._id,
        connectionKey: `${sender._id}_${receiver._id}`,
        status: CONNECTION_STATUS.PENDING,
      });

      const response = await request(app)
        .patch(`/api/v1/connections/${conn._id}`)
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({ action: CONNECTION_ACTION.ACCEPT });

      console.log('PATCH /api/v1/connections/:connectionId (ACCEPT) Request:\n', JSON.stringify({
        params: { connectionId: conn._id.toString() },
        query: {},
        body: { action: CONNECTION_ACTION.ACCEPT },
      }, null, 2));
      console.log('PATCH /api/v1/connections/:connectionId (ACCEPT) Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(CONNECTION_STATUS.ACCEPTED);
      expect(response.body.data.chatId).toBeDefined();
    });

    it('successfully responds (rejects) a connection request', async () => {
      const { user: sender } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver, token: receiverToken } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      const conn = await Connection.create({
        sender: sender._id,
        receiver: receiver._id,
        connectionKey: `${sender._id}_${receiver._id}`,
        status: CONNECTION_STATUS.PENDING,
      });

      const response = await request(app)
        .patch(`/api/v1/connections/${conn._id}`)
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({ action: CONNECTION_ACTION.REJECT });

      console.log('PATCH /api/v1/connections/:connectionId (REJECT) Request:\n', JSON.stringify({
        params: { connectionId: conn._id.toString() },
        query: {},
        body: { action: CONNECTION_ACTION.REJECT },
      }, null, 2));
      console.log('PATCH /api/v1/connections/:connectionId (REJECT) Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();

      // Check DB
      const dbCheck = await Connection.findById(conn._id);
      expect(dbCheck).toBeNull();
    });
  });

  describe('DELETE /api/v1/connections/:connectionId/request', () => {
    it('successfully cancels a pending request', async () => {
      const { user: sender, token: senderToken } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      const conn = await Connection.create({
        sender: sender._id,
        receiver: receiver._id,
        connectionKey: `${sender._id}_${receiver._id}`,
        status: CONNECTION_STATUS.PENDING,
      });

      const response = await request(app)
        .delete(`/api/v1/connections/${conn._id}/request`)
        .set('Authorization', `Bearer ${senderToken}`);

      console.log('DELETE /api/v1/connections/:connectionId/request Request:\n', JSON.stringify({
        params: { connectionId: conn._id.toString() },
        query: {},
        body: {},
      }, null, 2));
      console.log('DELETE /api/v1/connections/:connectionId/request Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const dbCheck = await Connection.findById(conn._id);
      expect(dbCheck).toBeNull();
    });
  });

  describe('DELETE /api/v1/connections/:connectionId', () => {
    it('successfully removes an accepted connection', async () => {
      const { user: sender, token: senderToken } = await createAuthUser(USER_ROLES.BROTHER, 'sender');
      const { user: receiver } = await createAuthUser(USER_ROLES.SISTER, 'receiver');

      const conn = await Connection.create({
        sender: sender._id,
        receiver: receiver._id,
        connectionKey: `${sender._id}_${receiver._id}`,
        status: CONNECTION_STATUS.ACCEPTED,
        chatId: new mongoose.Types.ObjectId(),
      });

      const response = await request(app)
        .delete(`/api/v1/connections/${conn._id}`)
        .set('Authorization', `Bearer ${senderToken}`);

      console.log('DELETE /api/v1/connections/:connectionId Request:\n', JSON.stringify({
        params: { connectionId: conn._id.toString() },
        query: {},
        body: {},
      }, null, 2));
      console.log('DELETE /api/v1/connections/:connectionId Response:\n', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const dbCheck = await Connection.findById(conn._id);
      expect(dbCheck).toBeNull();
    });
  });
});
