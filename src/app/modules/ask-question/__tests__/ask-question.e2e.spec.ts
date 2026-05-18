/**
 * E2E tests for AskQuestion module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks NotificationBuilder and Redis.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import AskQuestion from '../ask-question.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES } from '../../../../enums/user';

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

let mongod: MongoMemoryServer;

/** Create a verified user and return its document and a valid JWT. */
async function createAuthUser(role: string = USER_ROLES.BROTHER) {
  const user = await User.create({
    name: `Test ${role}`,
    role,
    email: `test-${role}-${Date.now()}@example.com`,
    password: 'password123',
    isVerified: true,
    status: 'ACTIVE',
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
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await AskQuestion.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AskQuestion E2E Tests', () => {
  describe('POST /api/v1/ask-question', () => {
    it('successfully submits a question', async () => {
      const { token } = await createAuthUser();

      const response = await request(app)
        .post('/api/v1/ask-question')
        .set('Authorization', `Bearer ${token}`)
        .field('question', 'How to write E2E tests?');

      console.log('POST /api/v1/ask-question Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.question).toBe('How to write E2E tests?');
    });

    it('returns 401 when no token is provided', async () => {
      const response = await request(app)
        .post('/api/v1/ask-question')
        .field('question', 'Unauthorized?');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/ask-question/my-questions', () => {
    it('returns my questions', async () => {
      const { user, token } = await createAuthUser();
      await AskQuestion.create({
        userId: user._id,
        question: 'My test question',
      });

      const response = await request(app)
        .get('/api/v1/ask-question/my-questions')
        .set('Authorization', `Bearer ${token}`);

      console.log('GET /api/v1/ask-question/my-questions Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].question).toBe('My test question');
    });
  });

  describe('GET /api/v1/ask-question (Admin Only)', () => {
    it('returns all questions for admin', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const userB = await createAuthUser(USER_ROLES.BROTHER);
      
      await AskQuestion.create({
        userId: userB.user._id,
        question: 'Question from User B',
      });

      const response = await request(app)
        .get('/api/v1/ask-question')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].question).toBe('Question from User B');
    });

    it('returns 403 for non-admin user', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);

      const response = await request(app)
        .get('/api/v1/ask-question')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/ask-question/:questionId/answer (Admin Only)', () => {
    it('successfully answers a question', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const userB = await createAuthUser(USER_ROLES.BROTHER);
      const question = await AskQuestion.create({
        userId: userB.user._id,
        question: 'Please answer this',
      });

      const response = await request(app)
        .patch(`/api/v1/ask-question/${question._id}/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: 'This is the answer from E2E test' });

      console.log('PATCH /api/v1/ask-question/:questionId/answer Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('answered');
      expect(response.body.data.answers[0].text).toBe('This is the answer from E2E test');
    });
  });
});
