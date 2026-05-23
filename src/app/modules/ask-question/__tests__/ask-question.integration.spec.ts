/**
 * Integration tests for AskQuestionService
 *
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks NotificationBuilder to avoid sending real notifications.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { AskQuestionService } from '../ask-question.service';
import AskQuestion from '../ask-question.model';
import { User } from '../../user/user.model';

// ── Test helpers ─────────────────────────────────────────────────────────────

let mongod: MongoMemoryServer;

/** Create a minimal User document with required fields. */
async function createUser(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  return User.create({
    name: `Test User ${tag}`,
    role: 'BROTHER',
    email: `test-${tag}@example.com`,
    password: 'password123',
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
  });
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

describe('AskQuestionService', () => {
  describe('submitQuestionIntoDB', () => {
    it('successfully creates a new question', async () => {
      const user = await createUser('submit');
      const payload = {
        userId: user._id,
        userRole: user.role as 'BROTHER' | 'SISTER',
        question: 'What is the best way to learn integration testing?',
      };

      const result = await AskQuestionService.submitQuestionIntoDB(payload as any);

      expect(result).toBeDefined();
      expect(result.question).toBe(payload.question);
      expect(result.userId.toString()).toBe(user._id.toString());
      expect(result.status).toBe('pending');
      expect(result.answers).toHaveLength(0);
    });
  });

  describe('getMyQuestionsFromDB', () => {
    it('returns only questions belonging to the specified user', async () => {
      const userA = await createUser('a');
      const userB = await createUser('b');

      await AskQuestion.create({
        userId: userA._id,
        userRole: userA.role,
        question: 'Question from User A',
      });
      await AskQuestion.create({
        userId: userB._id,
        userRole: userB.role,
        question: 'Question from User B',
      });

      const result = await AskQuestionService.getMyQuestionsFromDB(
        userA._id.toString(),
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].question).toBe('Question from User A');
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getAllQuestionsFromDB', () => {
    it('returns all questions with user info populated', async () => {
      const user = await createUser('all');
      await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Global question?',
      });

      const result = await AskQuestionService.getAllQuestionsFromDB({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].question).toBe('Global question?');
      expect(result.data[0].userId).toBeDefined();
      // Verify population (userId should have name and email)
      const populatedUser = result.data[0].userId as any;
      expect(populatedUser.name).toBe(user.name);
      expect(populatedUser.email).toBe(user.email);
    });
  });

  describe('getQuestionMetricsFromDB', () => {
    it('returns metrics with correct structure', async () => {
      const user = await createUser('metrics');
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      // Create some questions in different periods
      await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Current month pending',
        status: 'pending',
        createdAt: now,
      });
      await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Current month answered',
        status: 'answered',
        createdAt: now,
      });
      await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Last month answered',
        status: 'answered',
        createdAt: lastMonth,
      });

      const result = await AskQuestionService.getQuestionMetricsFromDB();

      expect(result).toHaveProperty('totalQuestions');
      expect(result).toHaveProperty('answeredQuestions');
      expect(result).toHaveProperty('pendingQuestions');
      expect(result.totalQuestions.value).toBe(3);
      expect(result.answeredQuestions.value).toBe(2);
      expect(result.pendingQuestions.value).toBe(1);
    });
  });

  describe('answerQuestionInDB', () => {
    it('successfully answers a pending question and sends notification', async () => {
      const user = await createUser('answer');
      const question = await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Pending question?',
      });

      const answerText = 'This is the answer.';
      const result = await AskQuestionService.answerQuestionInDB(
        (question as any)._id.toString(),
        answerText,
      );

      expect(result.status).toBe('answered');
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0].text).toBe(answerText);
      expect(result.answers[0].version).toBe(1);
      expect(result.answers[0].isActive).toBe(true);

      // Verify notification was sent
      const NotificationBuilder = (await import('../../../builder/NotificationBuilder/NotificationBuilder')).default;
      expect(NotificationBuilder).toHaveBeenCalled();
    });

    it('adds a new version and deactivates old answer when re-answering', async () => {
      const user = await createUser('re-answer');
      const question = await AskQuestion.create({
        userId: user._id,
        userRole: user.role,
        question: 'Original question?',
        status: 'answered',
        answers: [
          {
            version: 1,
            text: 'First answer',
            isActive: true,
            createdAt: new Date(),
          },
        ],
      });

      const newAnswerText = 'Second improved answer.';
      const result = await AskQuestionService.answerQuestionInDB(
        (question as any)._id.toString(),
        newAnswerText,
      );

      expect(result.answers).toHaveLength(2);
      expect(result.answers[0].isActive).toBe(false);
      expect(result.answers[1].isActive).toBe(true);
      expect(result.answers[1].text).toBe(newAnswerText);
      expect(result.answers[1].version).toBe(2);

      // Verify NO notification was sent for re-answer
      const NotificationBuilder = (await import('../../../builder/NotificationBuilder/NotificationBuilder')).default;
      vi.clearAllMocks(); // Clear call from setup if any
      await AskQuestionService.answerQuestionInDB(
        (question as any)._id.toString(),
        'Third answer',
      );
      expect(NotificationBuilder).not.toHaveBeenCalled();
    });

    it('throws 404 when question does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        AskQuestionService.answerQuestionInDB(fakeId, 'Some answer'),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Question not found',
      });
    });

    it('throws 400 when question ID is invalid', async () => {
      await expect(
        AskQuestionService.answerQuestionInDB('invalid-id', 'Some answer'),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });
  // ── JUMMAH role tests ──────────────────────────────────────────────────────

  describe('JUMMAH role — submit and retrieve questions', () => {
    /** Helper: create a minimal JUMMAH user (no revertDate / verificationImage / verificationVideo). */
    async function createJummahUser(suffix?: string) {
      const tag = suffix ?? `${Date.now()}-${Math.random()}`;
      return User.create({
        name: `Jummah User ${tag}`,
        role: 'JUMMAH',
        email: `jummah-${tag}@example.com`,
        password: 'password123',
        dateOfBirth: new Date('1995-06-15'),
        profileImage: '/default-avatar.svg',
        // revertDate / verificationImage / verificationVideo are intentionally omitted
      });
    }

    it('JUMMAH user can submit a question (model accepts JUMMAH userRole)', async () => {
      const user = await createJummahUser('submit');

      const result = await AskQuestionService.submitQuestionIntoDB({
        userId: user._id as any,
        userRole: 'JUMMAH',
        question: 'What time is Jummah prayer at the local mosque?',
      });

      expect(result).toBeDefined();
      expect(result.userRole).toBe('JUMMAH');
      expect(result.question).toBe('What time is Jummah prayer at the local mosque?');
      expect(result.status).toBe('pending');
      expect(result.answers).toHaveLength(0);
    });

    it('JUMMAH user can submit a question with an optional image', async () => {
      const user = await createJummahUser('img');

      const result = await AskQuestionService.submitQuestionIntoDB({
        userId: user._id as any,
        userRole: 'JUMMAH',
        question: 'Is this prayer position correct?',
        imageUrl: 'https://example.com/prayer-position.jpg',
      });

      expect(result.imageUrl).toBe('https://example.com/prayer-position.jpg');
      expect(result.status).toBe('pending');
    });

    it('JUMMAH user can retrieve only their own questions via getMyQuestionsFromDB', async () => {
      const jummahUser  = await createJummahUser('mine');
      const brotherUser = await createUser('other');

      await AskQuestion.create({
        userId: jummahUser._id,
        userRole: 'JUMMAH',
        question: 'My Jummah question',
      });
      await AskQuestion.create({
        userId: brotherUser._id,
        userRole: 'BROTHER',
        question: 'Brother question (not mine)',
      });

      const result = await AskQuestionService.getMyQuestionsFromDB(
        jummahUser._id.toString(),
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].question).toBe('My Jummah question');
      expect(result.pagination.total).toBe(1);
    });

    it('getAllQuestionsFromDB returns JUMMAH, BROTHER, and SISTER questions together', async () => {
      const jummahUser  = await createJummahUser('all-j');
      const brotherUser = await createUser('all-b');

      await AskQuestion.create({
        userId: jummahUser._id,
        userRole: 'JUMMAH',
        question: 'Jummah question for admin',
      });
      await AskQuestion.create({
        userId: brotherUser._id,
        userRole: 'BROTHER',
        question: 'Brother question for admin',
      });

      const result = await AskQuestionService.getAllQuestionsFromDB({});

      expect(result.data).toHaveLength(2);
      const roles = result.data.map((q: any) => q.userRole);
      expect(roles).toContain('JUMMAH');
      expect(roles).toContain('BROTHER');
    });

    it('getAllQuestionsFromDB can filter by userRole=JUMMAH', async () => {
      const jummahUser  = await createJummahUser('filter-j');
      const brotherUser = await createUser('filter-b');

      await AskQuestion.create({
        userId: jummahUser._id,
        userRole: 'JUMMAH',
        question: 'Only this should appear',
      });
      await AskQuestion.create({
        userId: brotherUser._id,
        userRole: 'BROTHER',
        question: 'Should be filtered out',
      });

      const result = await AskQuestionService.getAllQuestionsFromDB({ userRole: 'JUMMAH' });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).userRole).toBe('JUMMAH');
      expect(result.data[0].question).toBe('Only this should appear');
    });

    it('admin can answer a JUMMAH question and notification is sent', async () => {
      const user = await createJummahUser('answer');
      const question = await AskQuestion.create({
        userId: user._id,
        userRole: 'JUMMAH',
        question: 'How many rakats in Jummah prayer?',
      });

      const result = await AskQuestionService.answerQuestionInDB(
        (question as any)._id.toString(),
        'Jummah prayer consists of 2 rakats.',
      );

      expect(result.status).toBe('answered');
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0].text).toBe('Jummah prayer consists of 2 rakats.');
      expect(result.answers[0].version).toBe(1);
      expect(result.answers[0].isActive).toBe(true);

      const NotificationBuilder = (
        await import('../../../builder/NotificationBuilder/NotificationBuilder')
      ).default;
      expect(NotificationBuilder).toHaveBeenCalled();
    });

    it('model rejects an unrecognised userRole (e.g. "GUEST")', async () => {
      const user = await createJummahUser('bad-role');

      await expect(
        AskQuestion.create({
          userId: user._id,
          userRole: 'GUEST', // invalid
          question: 'Should be rejected by schema',
        }),
      ).rejects.toThrow();
    });
  });
});

