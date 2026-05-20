/**
 * E2E tests for Group module
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
import { Group, GroupMember, GroupPost, PostLike, PostComment } from '../group.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';

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
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  replSet = await MongoMemoryReplSet.create({ 
    replSet: { count: 1 },
    instance: {
      storageEngine: 'wiredTiger', // WiredTiger is more stable for replica sets
    }
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoose.disconnect();
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to allow connections to drain
  if (replSet) {
    await replSet.stop();
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  vi.clearAllMocks();

  // Mock global io
  (global as any).io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Group E2E Tests', () => {
  describe('Full Group Lifecycle & Social Interactions', () => {
    it('comprehensive flow: admin creates group, users join, post, like, comment, and admin manages members/posts', { timeout: 30000 }, async () => {
      // Step 1: Create users
      const { user: admin, token: adminToken } = await createAuthUser(USER_ROLES.SUPER_ADMIN, 'admin');
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER, 'userA');
      const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.BROTHER, 'userB');
      const { user: userC, token: tokenC } = await createAuthUser(USER_ROLES.SISTER, 'userC');

      // --- GROUP CREATION (ADMIN) ---
      const groupData = {
        name: 'Quran Study Circle',
        description: 'A group for brothers to study the Quran together.',
        userType: USER_ROLES.BROTHER,
        category: 'Spiritual',
        coverImage: 'https://example.com/cover.jpg',
      };
      const createGroupResponse = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(groupData);

      logApi('POST', '/api/v1/groups', { body: groupData }, createGroupResponse.body, 'CREATE-GROUP', 'Admin creates a new Quran study group');
      expect(createGroupResponse.status).toBe(201);
      const groupId = createGroupResponse.body.data.id;
      expect(groupId).toBeDefined();

      // --- LIST GROUPS (GENDER ISOLATION CHECK) ---
      // User A (BROTHER) should see the group
      const brotherListResponse = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/groups', {}, brotherListResponse.body, 'LIST-GROUPS-BROTHER', 'User A (BROTHER) fetches group list');
      expect(brotherListResponse.body.data.some((g: any) => g.id === groupId)).toBe(true);

      // User C (SISTER) should NOT see the group (since it is userType: BROTHER)
      const sisterListResponse = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenC}`);
      logApi('GET', '/api/v1/groups', {}, sisterListResponse.body, 'LIST-GROUPS-SISTER', 'User C (SISTER) fetches group list (should be empty/no brother groups)');
      expect(sisterListResponse.body.data.some((g: any) => g.id === groupId)).toBe(false);

      // --- JOIN GROUP ---
      const joinResponse = await request(app)
        .post(`/api/v1/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/groups/:groupId/join`, { params: { groupId } }, joinResponse.body, 'JOIN-GROUP', 'User A joins the group');
      expect(joinResponse.status).toBe(200);
      expect(joinResponse.body.success).toBe(true);

      // User B also joins
      await request(app)
        .post(`/api/v1/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${tokenB}`);

      // --- POST CREATION (WITH ATTACHMENTS) ---
      const postData = {
        content: 'Assalamu alaikum brothers, I just finished reading Surah Al-Kahf.',
        attachments: ['https://example.com/kahf-notes.pdf', 'https://example.com/kahf-audio.mp3'],
      };
      const postResponse = await request(app)
        .post(`/api/v1/groups/${groupId}/posts`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(postData);
      logApi('POST', `/api/v1/groups/:groupId/posts`, { params: { groupId }, body: postData }, postResponse.body, 'CREATE-POST', 'User A creates a post with attachments');
      expect(postResponse.status).toBe(201);
      const postId = postResponse.body.data.id;
      expect(postId).toBeDefined();
      expect(postResponse.body.data.attachments).toHaveLength(2);

      // --- UPDATE POST ---
      const updatePostData = { content: 'Updated: I just finished reading Surah Al-Kahf and started Surah Maryam.' };
      const updatePostResponse = await request(app)
        .patch(`/api/v1/groups/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(updatePostData);
      logApi('PATCH', `/api/v1/groups/posts/:postId`, { params: { postId }, body: updatePostData }, updatePostResponse.body, 'UPDATE-POST', 'User A updates their post');
      expect(updatePostResponse.status).toBe(200);
      expect(updatePostResponse.body.data.content).toBe(updatePostData.content);

      // --- LIKE POST ---
      const likeResponse = await request(app)
        .post(`/api/v1/groups/posts/${postId}/like`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/groups/posts/:postId/like`, { params: { postId } }, likeResponse.body, 'LIKE-POST', 'User B likes User A\'s post');
      expect(likeResponse.status).toBe(200);
      expect(likeResponse.body.message).toContain('liked');

      // --- ADD COMMENT ---
      const commentData = {
        comment: 'Wa alaikum assalam! MashAllah.',
      };
      const commentResponse = await request(app)
        .post(`/api/v1/groups/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send(commentData);
      logApi('POST', `/api/v1/groups/posts/:postId/comments`, { params: { postId }, body: commentData }, commentResponse.body, 'ADD-COMMENT', 'User B comments on User A\'s post');
      expect(commentResponse.status).toBe(201);
      const commentId = commentResponse.body.data.id;
      expect(commentId).toBeDefined();

      // --- REPLY TO COMMENT (NESTED) ---
      const replyData = {
        comment: 'MashAllah brother! Which Tafsir are you following?',
        parentCommentId: commentId,
      };
      const replyResponse = await request(app)
        .post(`/api/v1/groups/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(replyData);
      logApi('POST', `/api/v1/groups/posts/:postId/comments`, { params: { postId }, body: replyData }, replyResponse.body, 'REPLY-COMMENT', 'User A replies to User B\'s comment');
      expect(replyResponse.status).toBe(201);
      expect(replyResponse.body.data.parentCommentId).toBe(commentId);

      // --- UPDATE COMMENT ---
      const updateCommentData = { comment: 'Wa alaikum assalam! MashAllah, beautiful Surah.' };
      const updateCommentResponse = await request(app)
        .patch(`/api/v1/groups/comments/${commentId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send(updateCommentData);
      logApi('PATCH', `/api/v1/groups/comments/:commentId`, { params: { commentId }, body: updateCommentData }, updateCommentResponse.body, 'UPDATE-COMMENT', 'User B updates their comment');
      expect(updateCommentResponse.status).toBe(200);
      expect(updateCommentResponse.body.data.comment).toBe(updateCommentData.comment);

      // --- GET GROUP FEED ---
      const feedResponse = await request(app)
        .get(`/api/v1/groups/${groupId}/posts`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/groups/:groupId/posts`, { params: { groupId } }, feedResponse.body, 'GET-FEED', 'User A fetches group feed');
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.body.data[0].id).toBe(postId);
      expect(feedResponse.body.data[0].likesCount).toBe(1);
      expect(feedResponse.body.data[0].commentsCount).toBe(1);

      // --- PIN POST (ADMIN) ---
      const pinResponse = await request(app)
        .patch(`/api/v1/groups/posts/${postId}/pin`)
        .set('Authorization', `Bearer ${adminToken}`);
      logApi('PATCH', `/api/v1/groups/posts/:postId/pin`, { params: { postId } }, pinResponse.body, 'PIN-POST', 'Admin pins the post');
      expect(pinResponse.status).toBe(200);
      expect(pinResponse.body.data.isPinned).toBe(true);

      // --- LEAVE GROUP ---
      const leaveResponse = await request(app)
        .post(`/api/v1/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/groups/:groupId/leave`, { params: { groupId } }, leaveResponse.body, 'LEAVE-GROUP', 'User B leaves the group');
      expect(leaveResponse.status).toBe(200);
      expect(leaveResponse.body.success).toBe(true);

      // --- KICK MEMBER (ADMIN) ---
      const kickResponse = await request(app)
        .delete(`/api/v1/groups/${groupId}/members/${userA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      logApi('DELETE', `/api/v1/groups/:groupId/members/:userId`, { params: { groupId, userId: userA._id.toString() } }, kickResponse.body, 'KICK-MEMBER', 'Admin kicks User A from the group');
      expect(kickResponse.status).toBe(200);
      expect(kickResponse.body.success).toBe(true);

      // --- DELETE GROUP (ADMIN) ---
      const deleteGroupResponse = await request(app)
        .delete(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      logApi('DELETE', `/api/v1/groups/:groupId`, { params: { groupId } }, deleteGroupResponse.body, 'DELETE-GROUP', 'Admin deletes the group');
      expect(deleteGroupResponse.status).toBe(200);
      expect(deleteGroupResponse.body.success).toBe(true);

      // Verify group is gone
      const finalCheck = await Group.findById(groupId);
      expect(finalCheck).toBeNull();
    });
  });

  describe('Unauthenticated Access (401)', () => {
    it('should return 401 Unauthorized on all group endpoints when no token is provided', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const endpoints: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; url: string; body?: Record<string, unknown> }> = [
        { method: 'get',    url: '/api/v1/groups' },
        { method: 'post',   url: '/api/v1/groups', body: { name: 'Test' } },
        { method: 'get',    url: `/api/v1/groups/${fakeId}` },
        { method: 'patch',  url: `/api/v1/groups/${fakeId}` },
        { method: 'delete', url: `/api/v1/groups/${fakeId}` },
        { method: 'post',   url: `/api/v1/groups/${fakeId}/join` },
        { method: 'post',   url: `/api/v1/groups/${fakeId}/leave` },
        { method: 'delete', url: `/api/v1/groups/${fakeId}/members/${fakeId}` },
        { method: 'get',    url: `/api/v1/groups/${fakeId}/posts` },
        { method: 'post',   url: `/api/v1/groups/${fakeId}/posts` },
        { method: 'post',   url: `/api/v1/groups/posts/${fakeId}/like` },
        { method: 'post',   url: `/api/v1/groups/posts/${fakeId}/comments` },
        { method: 'get',    url: `/api/v1/groups/posts/${fakeId}/comments` },
        { method: 'patch',  url: `/api/v1/groups/posts/${fakeId}` },
        { method: 'delete', url: `/api/v1/groups/posts/${fakeId}` },
        { method: 'patch',  url: `/api/v1/groups/comments/${fakeId}` },
        { method: 'delete', url: `/api/v1/groups/comments/${fakeId}` },
        { method: 'patch',  url: `/api/v1/groups/posts/${fakeId}/pin` },
      ];

      for (const ep of endpoints) {
        const req = request(app)[ep.method](ep.url);
        if (ep.body) req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });
});
