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
      expect(hasSisterInBrotherList).toBe(false, 'BROTHER should not see SISTERs in discovery list');
      
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
      expect(hasBrotherInSisterList).toBe(false, 'SISTER should not see BROTHERs in discovery list');

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
        .post(`/api/v1/connections/request/${userC._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/request/:userId', {
        params: { userId: userC._id.toString() },
      }, crossRoleResponse.body, 'ROLE-CHECK', 'User A (BROTHER) tries to request User C (SISTER) -> Rejection expected');

      expect(crossRoleResponse.status).toBe(400);
      expect(crossRoleResponse.body.success).toBe(false);
      expect(crossRoleResponse.body.message).toContain('can only connect with another');

      // --- SELF-CONNECT VALIDATION CHECK ---
      // User A (BROTHER) tries to connect with themselves -> Expect 400 rejection
      const selfConnectResponse = await request(app)
        .post(`/api/v1/connections/request/${userA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/request/:userId', {
        params: { userId: userA._id.toString() },
      }, selfConnectResponse.body, 'SELF-CHECK', 'User A (BROTHER) tries to connect with themselves -> Rejection expected');

      expect(selfConnectResponse.status).toBe(400);
      expect(selfConnectResponse.body.success).toBe(false);
      expect(selfConnectResponse.body.message).toBe('You cannot connect with yourself');

      // --- VALID REQUEST CREATION ---
      // User A (BROTHER) sends request to User B (BROTHER) -> Expect 201 Created
      const sendResponse = await request(app)
        .post(`/api/v1/connections/request/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/request/:userId', {
        params: { userId: userB._id.toString() },
      }, sendResponse.body, 'VALID-REQUEST', 'User A sends a valid connection request to User B');

      expect(sendResponse.status).toBe(201);
      expect(sendResponse.body.success).toBe(true);
      const connectionId = sendResponse.body.data.id;
      expect(connectionId).toBeDefined();
      expect(sendResponse.body.data.status).toBe(CONNECTION_STATUS.PENDING);
      expect(sendResponse.body.data.receiver.id).toBe(userB._id.toString());

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
        .post(`/api/v1/connections/request/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('POST', '/api/v1/connections/request/:userId', {
        params: { userId: userB._id.toString() },
      }, duplicateResponse.body, 'DUPLICATE-CHECK', 'User A tries to request User B again -> Conflict expected');

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.message).toBe('Connection request already exists');

      // --- RETRIEVE PENDING REQUESTS ---
      // User B (receiver) retrieves pending received requests -> Expect list containing User A's request
      const pendingReceivedResponse = await request(app)
        .get('/api/v1/connections/requests?type=received')
        .set('Authorization', `Bearer ${tokenB}`);

      logApi('GET', '/api/v1/connections/requests', {
        query: { type: 'received' },
      }, pendingReceivedResponse.body, 'PENDING-LIST', 'User B fetches received requests list');

      expect(pendingReceivedResponse.status).toBe(200);
      expect(pendingReceivedResponse.body.success).toBe(true);
      expect(pendingReceivedResponse.body.data).toHaveLength(1);
      expect(pendingReceivedResponse.body.data[0].connectionId).toBe(connectionId);
      expect(pendingReceivedResponse.body.data[0].sender.id).toBe(userA._id.toString());

      // --- REQUEST CANCELLATION ---
      // User A (sender) cancels the pending connection request -> Expect 200 OK
      const cancelResponse = await request(app)
        .delete(`/api/v1/connections/${connectionId}/request`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('DELETE', '/api/v1/connections/:connectionId/request', {
        params: { connectionId },
      }, cancelResponse.body, 'CANCELLATION', 'User A cancels the pending connection request');

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);

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

      // --- REQUEST RE-CREATION & REJECTION ---
      // Re-create request for testing rejection
      const sendRecreateResponse = await request(app)
        .post(`/api/v1/connections/request/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      const recreatedId = sendRecreateResponse.body.data.id;

      // User B (receiver) rejects User A's request -> Expect 200 OK with data: null
      const rejectResponse = await request(app)
        .patch(`/api/v1/connections/${recreatedId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: CONNECTION_ACTION.REJECT });

      logApi('PATCH', '/api/v1/connections/:connectionId', {
        params: { connectionId: recreatedId },
        body: { action: CONNECTION_ACTION.REJECT },
      }, rejectResponse.body, 'REJECTION', 'User B rejects User A\'s connection request');

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.success).toBe(true);
      expect(rejectResponse.body.data).toBeNull();

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

      // --- REQUEST RE-CREATION & ACCEPTANCE ---
      // Re-create request for testing acceptance
      const sendRecreate2Response = await request(app)
        .post(`/api/v1/connections/request/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      const finalConnectionId = sendRecreate2Response.body.data.id;

      // User B (receiver) accepts User A's request -> Expect 200 OK with clean `{ id, status, chatId }` payload
      const acceptResponse = await request(app)
        .patch(`/api/v1/connections/${finalConnectionId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: CONNECTION_ACTION.ACCEPT });

      logApi('PATCH', '/api/v1/connections/:connectionId', {
        params: { connectionId: finalConnectionId },
        body: { action: CONNECTION_ACTION.ACCEPT },
      }, acceptResponse.body, 'ACCEPTANCE', 'User B accepts User A\'s connection request');

      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.body.success).toBe(true);
      expect(acceptResponse.body.data.id).toBe(finalConnectionId);
      expect(acceptResponse.body.data.status).toBe(CONNECTION_STATUS.ACCEPTED);
      expect(acceptResponse.body.data.chatId).toBeDefined();
      const chatId = acceptResponse.body.data.chatId;

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

      // User A checking details of User B -> connection status: 'ACCEPTED', connectionId, chatId (no direction)
      const connectedDetailsResponse = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, connectedDetailsResponse.body, 'CONNECTED-DETAILS', 'User A checks User B\'s public details (ACCEPTED status)');
      expect(connectedDetailsResponse.status).toBe(200);
      expect(connectedDetailsResponse.body.success).toBe(true);
      expect(connectedDetailsResponse.body.data.connection).toBeDefined();
      expect(connectedDetailsResponse.body.data.connection.status).toBe('ACCEPTED');
      expect(connectedDetailsResponse.body.data.connection.direction).toBeUndefined();
      expect(connectedDetailsResponse.body.data.connection.id).toBe(finalConnectionId);
      expect(connectedDetailsResponse.body.data.connection.chatId).toBe(chatId);

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

      // --- RETRIEVE ACTIVE CONNECTIONS ---
      // User A retrieves their active connections list -> Expect list containing User B
      const activeConnectionsResponse = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('GET', '/api/v1/connections', {}, activeConnectionsResponse.body, 'ACTIVE-CONNECTIONS', 'User A fetches active connections list');

      expect(activeConnectionsResponse.status).toBe(200);
      expect(activeConnectionsResponse.body.success).toBe(true);
      expect(activeConnectionsResponse.body.data).toHaveLength(1);
      expect(activeConnectionsResponse.body.data[0].id || activeConnectionsResponse.body.data[0]._id).toBe(finalConnectionId);
      expect(activeConnectionsResponse.body.data[0].chatId).toBe(chatId);
      expect(activeConnectionsResponse.body.data[0].connectedUser.id).toBe(userB._id.toString());
      expect(activeConnectionsResponse.body.data[0].connectedUser.role).toBeUndefined();
      expect(activeConnectionsResponse.body.data[0].respondedAt).toBeUndefined();

      // --- REMOVE CONNECTION ---
      // User A (or User B) removes the active connection -> Expect 200 OK
      const removeResponse = await request(app)
        .delete(`/api/v1/connections/${finalConnectionId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi('DELETE', '/api/v1/connections/:connectionId', {
        params: { connectionId: finalConnectionId },
      }, removeResponse.body, 'REMOVAL', 'User A removes the accepted active connection');

      expect(removeResponse.status).toBe(200);
      expect(removeResponse.body.success).toBe(true);

      // Verify profile and list endpoints are back to 'NONE' after removal
      const removeProfileResponse = await request(app)
        .get(`/api/v1/users/${userB._id}/public`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, removeProfileResponse.body, 'REMOVED-PROFILE', 'User A checks User B\'s profile (after removal - NONE status)');
      expect(removeProfileResponse.body.data.connection).toBeNull();

      const removeListResponse = await request(app)
        .get('/api/v1/users/profiles')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/users/profiles', {}, removeListResponse.body, 'REMOVED-LIST-PROFILES', 'User A fetches community discovery profiles list (after removal - NONE status)');
      const userBAfterRemoval = removeListResponse.body.data.find(
        (p: any) => (p.id || p._id) === userB._id.toString()
      );
      expect(userBAfterRemoval.connection).toBeNull();
    });
  });
});
