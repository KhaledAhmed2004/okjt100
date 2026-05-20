/**
 * E2E tests for Connection module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and global Socket.io.
 * sendNotifications runs for real so Notification records are written to DB.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Connection } from '../connection.model';
import { Notification } from '../../notification/notification.model';
import { CONNECTION_STATUS } from '../connection.constants';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';


// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock only the Firebase push layer — sendNotifications itself runs for real,
// so Notification documents are actually written to the DB and can be queried.
vi.mock('../../notification/pushNotificationHelper', () => ({
  pushNotificationHelper: {
    sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    sendPushNotification: vi.fn().mockResolvedValue(undefined),
  },
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
  await Notification.deleteMany({});
  vi.clearAllMocks();

  // Mock global io
  (global as any).io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Connection E2E Tests', () => {
  describe('Multi-user E2E Flow Scenarios', () => {
    it('comprehensive 3-user flow: handles initial status, validation checks, request creation, cancellation, list retrieval, rejection, acceptance, and active connection removal', async () => {
      // Step 1: Create three registered users:
      // User A (BROTHER), User B (BROTHER), and User C (SISTER)
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER, 'userA');
      const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.BROTHER, 'userB');
      const { user: userC } = await createAuthUser(USER_ROLES.SISTER, 'userC');

      // --- INITIAL STATE PROFILE STATUS CHECKS ---
      // 1. User A first gets community discovery profiles list (to find a user to connect with)
      const initListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, initListResponse.body, 'INITIAL-LIST-PROFILES', 'User A fetches community discovery profiles list (NONE status)');
      expect(initListResponse.status).toBe(200);
      expect(initListResponse.body.success).toBe(true);

      // --- GENDER ISOLATION CHECK (BROTHER only sees BROTHERs) ---
      const hasSisterInBrotherList = initListResponse.body.data.some((p: any) => p.role === USER_ROLES.SISTER);
      expect(hasSisterInBrotherList).toBe(false);

      const userBInInitList = initListResponse.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBInInitList).toBeDefined();
      expect(userBInInitList.connection).toBeNull();

      // --- GENDER ISOLATION CHECK (SISTER only sees SISTERs) ---
      // Create a quick token for User C (SISTER) to check her discovery view
      const tokenC = jwtHelper.createToken(
        { id: userC._id, role: userC.role, tokenVersion: userC.tokenVersion },
        config.jwt.jwt_secret as Secret,
        '1h',
      );
      const sisterListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenC}`);

      logApi('GET', '/api/v1/users/profiles', {}, sisterListResponse.body, 'INITIAL-LIST-PROFILES-SISTER', 'User C (SISTER) fetches discovery list (should not see BROTHERs)');
      expect(sisterListResponse.status).toBe(200);
      const hasBrotherInSisterList = sisterListResponse.body.data.some((p: any) => p.role === USER_ROLES.BROTHER);
      expect(hasBrotherInSisterList).toBe(false);

      // Extract User B's ID directly from the profiles list payload to simulate discovery flow
      const userBIdFromList = userBInInitList.id || userBInInitList._id;
      expect(userBIdFromList).toBeDefined();

      // 2. User A checks User B's profile via GET /api/v1/users/:userId/public using the discovery list ID
      const initProfileResponse = await request(app)
        .get(`/api/v1/users/${userBIdFromList}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userBIdFromList } }, initProfileResponse.body, 'INITIAL-PUBLIC-PROFILE', 'User A checks User B\'s profile (NONE status)');
      expect(initProfileResponse.status).toBe(200);
      expect(initProfileResponse.body.success).toBe(true);
      expect(initProfileResponse.body.data.connection).toBeNull();

      // --- ROLE MATCHING VALIDATION CHECK ---
      // User A (BROTHER) tries to send request to User C (SISTER) -> Expect 400 rejection (Cross-gender/role check)
      const crossRoleResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userC._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userC._id.toString() },
      }, crossRoleResponse.body, 'ROLE-CHECK', 'User A (BROTHER) tries to request User C (SISTER) -> Rejection expected');

      expect(crossRoleResponse.status).toBe(400);
      expect(crossRoleResponse.body.success).toBe(false);
      expect(crossRoleResponse.body.message).toContain('can only connect with another');

      // --- SELF-CONNECT VALIDATION CHECK ---
      // User A (BROTHER) tries to connect with themselves -> Expect 400 rejection
      const selfConnectResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userA._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userA._id.toString() },
      }, selfConnectResponse.body, 'SELF-CHECK', 'User A (BROTHER) tries to connect with themselves -> Rejection expected');

      expect(selfConnectResponse.status).toBe(400);
      expect(selfConnectResponse.body.success).toBe(false);
      expect(selfConnectResponse.body.message).toBe('You cannot connect with yourself');

      // --- VALID REQUEST CREATION ---
      // User A (BROTHER) sends request to User B (BROTHER) -> Expect 201 Created
      const sendResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userB._id.toString() },
      }, sendResponse.body, 'VALID-REQUEST', 'User A sends a valid connection request to User B');

      expect(sendResponse.status).toBe(201);
      expect(sendResponse.body.success).toBe(true);
      const connectionId = sendResponse.body.data.id;
      expect(connectionId).toBeDefined();
      expect(sendResponse.body.data.status).toBe(CONNECTION_STATUS.PENDING);
      expect(sendResponse.body.data.receiver.id).toBe(userB._id.toString());

      // --- NOTIFICATION VERIFICATION: CONNECTION REQUEST SENT ---
      // sendNotifications runs for real, so the Notification document is in the DB.
      // Verify via direct DB query first, then confirm via the API endpoint.
      const requestNotification = await Notification.findOne({
        receiver: userB._id,
        type: 'CONNECTION_REQUEST',
      });
      expect(requestNotification).not.toBeNull();
      expect(requestNotification!.schemaVersion).toBe(1);
      expect(requestNotification!.text).toBe(`${userA.name} wants to connect`);
      expect(requestNotification!.resourceType).toBe('User');
      expect(requestNotification!.resourceId).toBe(userA._id.toString());
      expect((requestNotification!.metadata as any).actor.id).toBe(userA._id.toString());
      expect((requestNotification!.metadata as any).subject.id).toBe(connectionId);

      // User B hits GET /api/v1/notifications/me and sees the notification in the response
      const notificationsResponseB = await request(app)
        .get('/api/v1/notifications/me')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/notifications/me', {}, notificationsResponseB.body, 'NOTIFICATION-REQUEST-SENT', 'User B fetches notifications (should contain connection request notification)');
      expect(notificationsResponseB.status).toBe(200);
      expect(notificationsResponseB.body.success).toBe(true);
      // Cursor pagination meta — flat shape: limit + nextCursor + hasNext + unreadCount
      // all at the same level. No nested `pagination` wrapper.
      expect(notificationsResponseB.body.meta.unreadCount).toBe(1);
      expect(notificationsResponseB.body.meta).toMatchObject({
        limit: expect.any(Number),
        hasNext: false,
        nextCursor: null,
        unreadCount: 1,
      });
      const requestNotifInApi = notificationsResponseB.body.data.find(
        (n: any) => n.type === 'CONNECTION_REQUEST',
      );
      expect(requestNotifInApi).toBeDefined();
      expect(requestNotifInApi.schemaVersion).toBe(1);
      expect(requestNotifInApi.isRead).toBe(false);
      expect(requestNotifInApi.readAt).toBeNull();
      // actor — denormalized sender data
      expect(requestNotifInApi.actor.id).toBe(userA._id.toString());
      expect(requestNotifInApi.actor.name).toBe(userA.name);
      expect(requestNotifInApi.actor.profileImage).toBeDefined();
      // subject — the connection record
      expect(requestNotifInApi.subject.type).toBe('Connection');
      expect(requestNotifInApi.subject.id).toBe(connectionId);
      // actions — client uses these to render buttons
      expect(requestNotifInApi.actions).toContainEqual({ type: 'ACCEPT' });
      expect(requestNotifInApi.actions).toContainEqual({ type: 'REJECT' });
      expect(requestNotifInApi.actions).toContainEqual({ type: 'VIEW_PROFILE' });

      // --- PENDING STATE PROFILE STATUS CHECKS (User A is Sender) ---
      // User A (sender) checks User B's profile -> connectionStatus: 'PENDING', connectionDirection: 'SENT'
      const pendingProfileAtoB = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, pendingProfileAtoB.body, 'PENDING-PUBLIC-PROFILE-SENT', 'User A checks User B\'s profile (PENDING status)');
      expect(pendingProfileAtoB.status).toBe(200);
      expect(pendingProfileAtoB.body.success).toBe(true);
      expect(pendingProfileAtoB.body.data.connection).toBeDefined();
      expect(pendingProfileAtoB.body.data.connection.status).toBe('PENDING');
      expect(pendingProfileAtoB.body.data.connection.direction).toBe('OUTGOING');
      expect(pendingProfileAtoB.body.data.connection.id).toBe(connectionId);

      // User A checks profiles list
      const pendingListA = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, pendingListA.body, 'PENDING-LIST-PROFILES-SENT', 'User A fetches community discovery profiles list (PENDING status)');
      expect(pendingListA.status).toBe(200);
      const userBInPendingListA = pendingListA.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBInPendingListA).toBeDefined();
      expect(userBInPendingListA.connection).toBeDefined();
      expect(userBInPendingListA.connection.status).toBe('PENDING');
      expect(userBInPendingListA.connection.direction).toBe('OUTGOING');
      expect(userBInPendingListA.connection.id).toBe(connectionId);

      // --- PENDING STATE PROFILE STATUS CHECKS (User B is Receiver) ---
      // User B (receiver) checks User A's profile -> connectionStatus: 'PENDING', connectionDirection: 'RECEIVED'
      const pendingProfileBtoA = await request(app)
        .get(`/api/v1/users/${userA._id}/public`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, pendingProfileBtoA.body, 'PENDING-PUBLIC-PROFILE-RECEIVED', 'User B checks User A\'s profile (PENDING status)');
      expect(pendingProfileBtoA.status).toBe(200);
      expect(pendingProfileBtoA.body.success).toBe(true);
      expect(pendingProfileBtoA.body.data.connection).toBeDefined();
      expect(pendingProfileBtoA.body.data.connection.status).toBe('PENDING');
      expect(pendingProfileBtoA.body.data.connection.direction).toBe('INCOMING');
      expect(pendingProfileBtoA.body.data.connection.id).toBe(connectionId);

      // User B checks profiles list
      const pendingListB = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/users/profiles', {}, pendingListB.body, 'PENDING-LIST-PROFILES-RECEIVED', 'User B fetches community discovery profiles list (PENDING status)');
      expect(pendingListB.status).toBe(200);
      const userAInPendingListB = pendingListB.body.data.find(
        (p: any) => (p.id || p._id) === userA._id.toString()
      );
      expect(userAInPendingListB).toBeDefined();
      expect(userAInPendingListB.connection).toBeDefined();
      expect(userAInPendingListB.connection.status).toBe('PENDING');
      expect(userAInPendingListB.connection.direction).toBe('INCOMING');
      expect(userAInPendingListB.connection.id).toBe(connectionId);

      // --- DUPLICATE REQUEST CHECK ---
      // User A attempts to request User B again -> Expect 409 Conflict
      const duplicateResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userB._id.toString() },
      }, duplicateResponse.body, 'DUPLICATE-CHECK', 'User A tries to request User B again -> Conflict expected');

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.message).toBe('Connection request already exists');

      // --- REVERSE DUPLICATE REQUEST CHECK ---
      // User B (receiver) tries to send a request back to User A while A's request is still PENDING.
      // The connectionKey is deterministic (min_max of IDs), so the existing record collides.
      const reverseDuplicateResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ receiverId: userA._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userA._id.toString() },
      }, reverseDuplicateResponse.body, 'REVERSE-DUPLICATE-CHECK', 'User B tries to request User A while A has a pending request -> 409 expected');

      expect(reverseDuplicateResponse.status).toBe(409);
      expect(reverseDuplicateResponse.body.success).toBe(false);
      expect(reverseDuplicateResponse.body.message).toBe('Connection request already exists');

      // --- RETRIEVE PENDING REQUESTS (direction=received) ---
      // User B (receiver) retrieves pending received requests -> Expect list containing User A's request
      const pendingReceivedResponse = await request(app)
        .get('/api/v1/connections/requests?direction=received')
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('GET', '/api/v1/connections/requests', {
        query: { direction: 'received' },
      }, pendingReceivedResponse.body, 'PENDING-LIST-RECEIVED', 'User B fetches received requests list');

      expect(pendingReceivedResponse.status).toBe(200);
      expect(pendingReceivedResponse.body.success).toBe(true);
      expect(pendingReceivedResponse.body.data).toHaveLength(1);
      expect(pendingReceivedResponse.body.data[0].connectionId).toBe(connectionId);
      expect(pendingReceivedResponse.body.data[0].sender.id).toBe(userA._id.toString());

      // --- RETRIEVE PENDING REQUESTS (direction=sent) ---
      // User A (sender) retrieves their outgoing pending requests -> Expect list containing their request to User B
      const pendingSentResponse = await request(app)
        .get('/api/v1/connections/requests?direction=sent')
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('GET', '/api/v1/connections/requests', {
        query: { direction: 'sent' },
      }, pendingSentResponse.body, 'PENDING-LIST-SENT', 'User A fetches sent requests list');

      expect(pendingSentResponse.status).toBe(200);
      expect(pendingSentResponse.body.success).toBe(true);
      expect(pendingSentResponse.body.data).toHaveLength(1);
      expect(pendingSentResponse.body.data[0].connectionId).toBe(connectionId);
      expect(pendingSentResponse.body.data[0].receiver.id).toBe(userB._id.toString());

      // --- RECEIVER CANCELLATION GUARD ---
      // User B (receiver) attempts to cancel User A's pending request -> Expect 403 Forbidden
      // Only the original sender is allowed to cancel; the receiver must use REJECT instead.
      const receiverCancelResponse = await request(app)
        .post(`/api/v1/connections/${connectionId}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('POST', '/api/v1/connections/:connectionId/cancel', {
        params: { connectionId },
      }, receiverCancelResponse.body, 'RECEIVER-CANCEL-GUARD', 'User B (receiver) tries to cancel User A\'s request -> 403 expected');

      expect(receiverCancelResponse.status).toBe(403);
      expect(receiverCancelResponse.body.success).toBe(false);

      // --- REQUEST CANCELLATION ---

      // User A (sender) cancels the pending connection request -> Expect 200 OK
      const cancelResponse = await request(app)
        .post(`/api/v1/connections/${connectionId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/:connectionId/cancel', {
        params: { connectionId },
      }, cancelResponse.body, 'CANCELLATION', 'User A cancels the pending connection request');

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.id).toBe(connectionId);
      expect(cancelResponse.body.data.status).toBe('NONE');

      // Verify profile and list endpoints are back to 'NONE' after cancellation
      const cancelProfileResponse = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, cancelProfileResponse.body, 'CANCELLED-PROFILE', 'User A checks User B\'s profile (after cancellation - NONE status)');
      expect(cancelProfileResponse.body.data.connection).toBeNull();

      const cancelListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, cancelListResponse.body, 'CANCELLED-LIST-PROFILES', 'User A fetches community discovery profiles list (after cancellation - NONE status)');
      const userBAfterCancel = cancelListResponse.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBAfterCancel.connection).toBeNull();

      // --- USER B CANCELLATION CHECK PERSPECTIVE ---
      // Verify that User B's received requests list is now empty
      const checkPendingResponse = await request(app)
        .get('/api/v1/connections/requests?direction=received')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/connections/requests', { query: { direction: 'received' } }, checkPendingResponse.body, 'CANCELLED-RECEIVED-LIST', 'User B fetches received requests list (after cancellation - should be empty)');
      expect(checkPendingResponse.status).toBe(200);
      expect(checkPendingResponse.body.data).toHaveLength(0);

      // Verify User B's profile view of User A is null
      const cancelProfileResponseB = await request(app)
        .get(`/api/v1/users/${userA._id}/public`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, cancelProfileResponseB.body, 'CANCELLED-PROFILE-B', 'User B checks User A\'s profile (after cancellation - NONE status)');
      expect(cancelProfileResponseB.body.data.connection).toBeNull();

      // --- REQUEST RE-CREATION & REJECTION ---
      // Re-create request for testing rejection
      const sendRecreateResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });
      const recreatedId = sendRecreateResponse.body.data.id;

      // --- POLISH: SENDER REJECT GUARD ---
      // User A (sender) tries to reject their own outgoing request -> 403 Forbidden expected
      const senderRejectResponse = await request(app)
        .post(`/api/v1/connections/${recreatedId}/reject`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/:connectionId/reject', {
        params: { connectionId: recreatedId },
      }, senderRejectResponse.body, 'SENDER-REJECT-GUARD', 'User A (sender) tries to reject own request -> 403 expected');

      expect(senderRejectResponse.status).toBe(403);
      expect(senderRejectResponse.body.success).toBe(false);

      // --- POLISH: SENDER ACCEPT GUARD ---
      // User A (sender) tries to accept their own outgoing request -> 403 Forbidden expected
      const senderAcceptResponse = await request(app)
        .post(`/api/v1/connections/${recreatedId}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/:connectionId/accept', {
        params: { connectionId: recreatedId },
      }, senderAcceptResponse.body, 'SENDER-RESPOND-GUARD', 'User A (sender) tries to accept own request -> 403 expected');

      expect(senderAcceptResponse.status).toBe(403);
      expect(senderAcceptResponse.body.success).toBe(false);

      // User B (receiver) rejects User A's request -> Expect 200 OK with data: { id, status: 'NONE' }
      const rejectResponse = await request(app)
        .post(`/api/v1/connections/${recreatedId}/reject`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('POST', '/api/v1/connections/:connectionId/reject', {
        params: { connectionId: recreatedId },
      }, rejectResponse.body, 'REJECTION', 'User B rejects User A\'s connection request');

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.success).toBe(true);
      expect(rejectResponse.body.data.id).toBe(recreatedId);
      expect(rejectResponse.body.data.status).toBe('NONE');

      // Verify profile and list endpoints are back to 'NONE' after rejection
      const rejectProfileResponse = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, rejectProfileResponse.body, 'REJECTED-PROFILE', 'User A checks User B\'s profile (after rejection - NONE status)');
      expect(rejectProfileResponse.body.data.connection).toBeNull();

      const rejectListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, rejectListResponse.body, 'REJECTED-LIST-PROFILES', 'User A fetches community discovery profiles list (after rejection - NONE status)');
      const userBAfterReject = rejectListResponse.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBAfterReject.connection).toBeNull();

      // --- REQUEST RE-CREATION & ACCEPTANCE (TESTING IMMEDIATE RE-REQUEST BEHAVIOR) ---
      // We explicitly test that immediate re-requesting is allowed post-rejection.
      // Since the connection record was deleted, there is no cooldown, and the state returned to 'NONE'.
      const sendRecreate2Response = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userB._id.toString() },
      }, sendRecreate2Response.body, 'RE-REQUEST-AFTER-REJECTION', 'User A immediately re-requests User B after rejection -> Expect 201 Created and new connection ID');

      expect(sendRecreate2Response.status).toBe(201);
      expect(sendRecreate2Response.body.success).toBe(true);

      const finalConnectionId = sendRecreate2Response.body.data.id;
      expect(finalConnectionId).toBeDefined();
      expect(finalConnectionId).not.toBe(recreatedId); // Verify a brand new connection ID is generated
      expect(sendRecreate2Response.body.data.status).toBe(CONNECTION_STATUS.PENDING);

      // User B (receiver) accepts User A's request -> Expect 200 OK with clean `{ id, status, chatId }` payload
      const acceptResponse = await request(app)
        .post(`/api/v1/connections/${finalConnectionId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('POST', '/api/v1/connections/:connectionId/accept', {
        params: { connectionId: finalConnectionId },
      }, acceptResponse.body, 'ACCEPTANCE', 'User B accepts User A\'s connection request');

      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.body.success).toBe(true);
      expect(acceptResponse.body.data.id).toBe(finalConnectionId);
      expect(acceptResponse.body.data.status).toBe(CONNECTION_STATUS.ACCEPTED);
      expect(acceptResponse.body.data.chatId).toBeDefined();
      const chatId = acceptResponse.body.data.chatId;

      // --- NOTIFICATION VERIFICATION: CONNECTION ACCEPTED ---
      // sendNotifications runs for real, so the Notification document is in the DB.
      // Verify via direct DB query first, then confirm via the API endpoint.
      const acceptedNotification = await Notification.findOne({
        receiver: userA._id,
        type: 'CONNECTION_ACCEPTED',
      });
      expect(acceptedNotification).not.toBeNull();
      expect(acceptedNotification!.schemaVersion).toBe(1);
      expect(acceptedNotification!.text).toBe(`${userB.name} accepted your connection request`);
      expect(acceptedNotification!.resourceType).toBe('User');
      expect(acceptedNotification!.resourceId).toBe(userB._id.toString());
      expect((acceptedNotification!.metadata as any).actor.id).toBe(userB._id.toString());
      expect((acceptedNotification!.metadata as any).subject.chatId).toBe(chatId);

      // User A hits GET /api/v1/notifications/me and sees the accepted notification
      const notificationsResponseA = await request(app)
        .get('/api/v1/notifications/me')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/notifications/me', {}, notificationsResponseA.body, 'NOTIFICATION-CONNECTION-ACCEPTED', 'User A fetches notifications (should contain connection accepted notification)');
      expect(notificationsResponseA.status).toBe(200);
      expect(notificationsResponseA.body.success).toBe(true);
      // Cursor pagination meta — flat shape
      expect(notificationsResponseA.body.meta.unreadCount).toBe(1);
      expect(notificationsResponseA.body.meta).toMatchObject({
        limit: expect.any(Number),
        hasNext: false,
        nextCursor: null,
        unreadCount: 1,
      });
      const acceptedNotifInApi = notificationsResponseA.body.data.find(
        (n: any) => n.type === 'CONNECTION_ACCEPTED',
      );
      expect(acceptedNotifInApi).toBeDefined();
      expect(acceptedNotifInApi.schemaVersion).toBe(1);
      expect(acceptedNotifInApi.isRead).toBe(false);
      expect(acceptedNotifInApi.readAt).toBeNull();
      // actor — denormalized acceptor data
      expect(acceptedNotifInApi.actor.id).toBe(userB._id.toString());
      expect(acceptedNotifInApi.actor.name).toBe(userB.name);
      expect(acceptedNotifInApi.actor.profileImage).toBeDefined();
      // subject — connection + chatId so client can open chat directly
      expect(acceptedNotifInApi.subject.type).toBe('Connection');
      expect(acceptedNotifInApi.subject.chatId).toBe(chatId);
      // actions — client uses these to render buttons
      expect(acceptedNotifInApi.actions).toContainEqual({ type: 'OPEN_CHAT' });
      expect(acceptedNotifInApi.actions).toContainEqual({ type: 'VIEW_PROFILE' });

      // --- POLISH: ACCEPTING AN ALREADY-ACCEPTED CONNECTION ---
      // User B tries to accept again -> Expect 400 Bad Request (not pending anymore)
      const doubleAcceptResponse = await request(app)
        .post(`/api/v1/connections/${finalConnectionId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('POST', '/api/v1/connections/:connectionId/accept', {
        params: { connectionId: finalConnectionId },
      }, doubleAcceptResponse.body, 'DOUBLE-ACCEPTANCE-GUARD', 'User B tries to accept an already-accepted connection request -> Expect 400 Bad Request');

      expect(doubleAcceptResponse.status).toBe(400);
      expect(doubleAcceptResponse.body.success).toBe(false);
      expect(doubleAcceptResponse.body.message).toContain('no longer pending');

      // --- CONNECTED STATE PROFILE STATUS CHECKS ---
      // User A fetching User B's profile -> connection status: 'ACCEPTED', connectionId, chatId (no direction)
      const connectedProfileResponse = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, connectedProfileResponse.body, 'CONNECTED-PROFILE', 'User A checks User B\'s profile (ACCEPTED status)');
      expect(connectedProfileResponse.status).toBe(200);
      expect(connectedProfileResponse.body.success).toBe(true);
      expect(connectedProfileResponse.body.data.connection).toBeDefined();
      expect(connectedProfileResponse.body.data.connection.status).toBe('ACCEPTED');
      expect(connectedProfileResponse.body.data.connection.direction).toBeUndefined();
      expect(connectedProfileResponse.body.data.connection.id).toBe(finalConnectionId);
      expect(connectedProfileResponse.body.data.connection.chatId).toBe(chatId);

      // User A checks profiles list
      const connectedListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, connectedListResponse.body, 'CONNECTED-LIST-PROFILES', 'User A fetches community discovery profiles list (ACCEPTED status)');
      expect(connectedListResponse.status).toBe(200);
      const userBInConnectedList = connectedListResponse.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBInConnectedList).toBeDefined();
      expect(userBInConnectedList.connection).toBeDefined();
      expect(userBInConnectedList.connection.status).toBe('ACCEPTED');
      expect(userBInConnectedList.connection.direction).toBeUndefined();
      expect(userBInConnectedList.connection.id).toBe(finalConnectionId);

      // --- RETRIEVE ACTIVE CONNECTIONS (BOTH SIDES) ---
      // User A retrieves their active connections list -> Expect list containing User B
      const activeConnectionsResponseA = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('GET', '/api/v1/connections', {}, activeConnectionsResponseA.body, 'ACTIVE-CONNECTIONS-A', 'User A fetches active connections list');

      expect(activeConnectionsResponseA.status).toBe(200);
      expect(activeConnectionsResponseA.body.success).toBe(true);
      expect(activeConnectionsResponseA.body.data).toHaveLength(1);
      expect(activeConnectionsResponseA.body.data[0].id || activeConnectionsResponseA.body.data[0]._id).toBe(finalConnectionId);
      expect(activeConnectionsResponseA.body.data[0].chatId).toBe(chatId);
      expect(activeConnectionsResponseA.body.data[0].connectedUser.id).toBe(userB._id.toString());

      // User B retrieves their active connections list -> Expect list containing User A
      const activeConnectionsResponseB = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('GET', '/api/v1/connections', {}, activeConnectionsResponseB.body, 'ACTIVE-CONNECTIONS-B', 'User B fetches active connections list');

      expect(activeConnectionsResponseB.status).toBe(200);
      expect(activeConnectionsResponseB.body.success).toBe(true);
      expect(activeConnectionsResponseB.body.data).toHaveLength(1);
      expect(activeConnectionsResponseB.body.data[0].id || activeConnectionsResponseB.body.data[0]._id).toBe(finalConnectionId);
      expect(activeConnectionsResponseB.body.data[0].chatId).toBe(chatId);
      expect(activeConnectionsResponseB.body.data[0].connectedUser.id).toBe(userA._id.toString());

      // --- REMOVE CONNECTION SECURITY GUARD ---
      // User C (not in connection) tries to remove connection between User A & User B -> Expect 403 Forbidden
      const foreignRemoveResponse = await request(app)
        .post(`/api/v1/connections/${finalConnectionId}/remove`)
        .set('Authorization', `Bearer ${tokenC}`);

      logApi('POST', '/api/v1/connections/:connectionId/remove', {
        params: { connectionId: finalConnectionId },
      }, foreignRemoveResponse.body, 'FOREIGN-REMOVAL-GUARD', 'User C (not in connection) tries to remove connection -> 403 expected');

      expect(foreignRemoveResponse.status).toBe(403);
      expect(foreignRemoveResponse.body.success).toBe(false);

      // --- REMOVE CONNECTION (User B is Receiver of original request) ---
      // Either user can remove. We have User B (receiver) perform the removal to verify both sender/receiver capability.
      const removeResponse = await request(app)
        .post(`/api/v1/connections/${finalConnectionId}/remove`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('POST', '/api/v1/connections/:connectionId/remove', {
        params: { connectionId: finalConnectionId },
      }, removeResponse.body, 'REMOVAL', 'User B removes the accepted active connection');

      expect(removeResponse.status).toBe(200);
      expect(removeResponse.body.success).toBe(true);
      expect(removeResponse.body.data.id).toBe(finalConnectionId);
      expect(removeResponse.body.data.status).toBe('NONE');

      // --- VERIFY POST-REMOVAL STATE (USER A PERSPECTIVE) ---
      // Verify profile and list endpoints are back to null for User A
      const removeProfileResponseA = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, removeProfileResponseA.body, 'REMOVED-PROFILE-A', 'User A checks User B\'s profile (after removal - null expected)');
      expect(removeProfileResponseA.body.data.connection).toBeNull();

      const removeListResponseA = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, removeListResponseA.body, 'REMOVED-LIST-PROFILES-A', 'User A fetches profiles list (after removal)');
      const userBAfterRemoval = removeListResponseA.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBAfterRemoval.connection).toBeNull();

      const emptyConnectionsA = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(emptyConnectionsA.body.data).toHaveLength(0);

      // --- VERIFY POST-REMOVAL STATE (USER B PERSPECTIVE) ---
      // Verify profile and list endpoints are back to null for User B
      const removeProfileResponseB = await request(app)
        .get(`/api/v1/users/${userA._id}/public`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, removeProfileResponseB.body, 'REMOVED-PROFILE-B', 'User B checks User A\'s profile (after removal - null expected)');
      expect(removeProfileResponseB.body.data.connection).toBeNull();

      const removeListResponseB = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/users/profiles', {}, removeListResponseB.body, 'REMOVED-LIST-PROFILES-B', 'User B fetches profiles list (after removal)');
      const userAAfterRemoval = removeListResponseB.body.data.find(
        (p: any) => (p.id || p._id) === userA._id.toString()
      );
      expect(userAAfterRemoval.connection).toBeNull();

      const emptyConnectionsB = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(emptyConnectionsB.body.data).toHaveLength(0);

      // --- RE-REQUEST AFTER REMOVAL ---
      // After removing an accepted connection, the DB record is deleted.
      // Verify the sender can immediately re-request — different DB state than post-rejection.
      const reRequestAfterRemovalResponse = await request(app)
        .post(`/api/v1/connections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });

      logApi('POST', '/api/v1/connections', {
        body: { receiverId: userB._id.toString() },
      }, reRequestAfterRemovalResponse.body, 'RE-REQUEST-AFTER-REMOVAL', 'User A re-requests User B after active connection removal -> 201 expected');

      expect(reRequestAfterRemovalResponse.status).toBe(201);
      expect(reRequestAfterRemovalResponse.body.success).toBe(true);
      expect(reRequestAfterRemovalResponse.body.data.id).toBeDefined();
      expect(reRequestAfterRemovalResponse.body.data.id).not.toBe(finalConnectionId);
      expect(reRequestAfterRemovalResponse.body.data.status).toBe(CONNECTION_STATUS.PENDING);
    });
  });

  describe('Unauthenticated Access (401)', () => {
    it('should return 401 Forbidden on all connection endpoints when no token is provided', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const endpoints: Array<{ method: 'get' | 'post'; url: string; body?: Record<string, unknown> }> = [
        { method: 'get', url: '/api/v1/connections' },
        { method: 'get', url: '/api/v1/connections/requests?direction=received' },
        { method: 'post', url: '/api/v1/connections', body: { receiverId: fakeId } },
        { method: 'post', url: `/api/v1/connections/${fakeId}/accept` },
        { method: 'post', url: `/api/v1/connections/${fakeId}/reject` },
        { method: 'post', url: `/api/v1/connections/${fakeId}/cancel` },
        { method: 'post', url: `/api/v1/connections/${fakeId}/remove` },
        // User module endpoints that require auth
        { method: 'get', url: '/api/v1/users/profiles' },
        { method: 'get', url: `/api/v1/users/${fakeId}/public` },
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
