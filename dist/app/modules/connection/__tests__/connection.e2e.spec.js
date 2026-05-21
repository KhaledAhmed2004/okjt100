"use strict";
/**
 * E2E tests for Connection module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and global Socket.io.
 * sendNotifications runs for real so Notification records are written to DB.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const connection_model_1 = require("../connection.model");
const notification_model_1 = require("../../notification/notification.model");
const connection_constants_1 = require("../connection.constants");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
// ── Mocks ────────────────────────────────────────────────────────────────────
// Mock only the Firebase push layer — sendNotifications itself runs for real,
// so Notification documents are actually written to the DB and can be queried.
vitest_1.vi.mock('../../notification/pushNotificationHelper', () => ({
    pushNotificationHelper: {
        sendPushNotifications: vitest_1.vi.fn().mockResolvedValue(undefined),
        sendPushNotification: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
// Mock Redis to prevent connection issues
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        on: vitest_1.vi.fn(),
    },
}));
// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet;
/** Create a verified user and return its document and a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.BROTHER, nameSuffix = 'user') {
        const user = yield user_model_1.User.create({
            name: `Test ${role} ${nameSuffix}`,
            role,
            email: `test-${role}-${nameSuffix}-${Date.now()}-${Math.random()}@example.com`,
            password: 'password123',
            isVerified: true,
            status: user_1.USER_STATUS.ACTIVE,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
            tokenVersion: 0,
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield connection_model_1.Connection.deleteMany({});
    yield user_model_1.User.deleteMany({});
    yield notification_model_1.Notification.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Mock global io
    global.io = {
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Connection E2E Tests', () => {
    (0, vitest_1.describe)('Multi-user E2E Flow Scenarios', () => {
        (0, vitest_1.it)('comprehensive 3-user flow: handles initial status, validation checks, request creation, cancellation, list retrieval, rejection, acceptance, and active connection removal', () => __awaiter(void 0, void 0, void 0, function* () {
            // Step 1: Create three registered users:
            // User A (BROTHER), User B (BROTHER), and User C (SISTER)
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userA');
            const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userB');
            const { user: userC } = yield createAuthUser(user_1.USER_ROLES.SISTER, 'userC');
            // --- INITIAL STATE PROFILE STATUS CHECKS ---
            // 1. User A first gets community discovery profiles list (to find a user to connect with)
            const initListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, initListResponse.body, 'INITIAL-LIST-PROFILES', 'User A fetches community discovery profiles list (NONE status)');
            (0, vitest_1.expect)(initListResponse.status).toBe(200);
            (0, vitest_1.expect)(initListResponse.body.success).toBe(true);
            // --- GENDER ISOLATION CHECK (BROTHER only sees BROTHERs) ---
            const hasSisterInBrotherList = initListResponse.body.data.some((p) => p.role === user_1.USER_ROLES.SISTER);
            (0, vitest_1.expect)(hasSisterInBrotherList).toBe(false);
            const userBInInitList = initListResponse.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBInInitList).toBeDefined();
            (0, vitest_1.expect)(userBInInitList.connection).toBeNull();
            // --- GENDER ISOLATION CHECK (SISTER only sees SISTERs) ---
            // Create a quick token for User C (SISTER) to check her discovery view
            const tokenC = jwtHelper_1.jwtHelper.createToken({ id: userC._id, role: userC.role, tokenVersion: userC.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
            const sisterListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenC}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, sisterListResponse.body, 'INITIAL-LIST-PROFILES-SISTER', 'User C (SISTER) fetches discovery list (should not see BROTHERs)');
            (0, vitest_1.expect)(sisterListResponse.status).toBe(200);
            const hasBrotherInSisterList = sisterListResponse.body.data.some((p) => p.role === user_1.USER_ROLES.BROTHER);
            (0, vitest_1.expect)(hasBrotherInSisterList).toBe(false);
            // Extract User B's ID directly from the profiles list payload to simulate discovery flow
            const userBIdFromList = userBInInitList.id || userBInInitList._id;
            (0, vitest_1.expect)(userBIdFromList).toBeDefined();
            // 2. User A checks User B's profile via GET /api/v1/users/:userId/public using the discovery list ID
            const initProfileResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userBIdFromList}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userBIdFromList } }, initProfileResponse.body, 'INITIAL-PUBLIC-PROFILE', 'User A checks User B\'s profile (NONE status)');
            (0, vitest_1.expect)(initProfileResponse.status).toBe(200);
            (0, vitest_1.expect)(initProfileResponse.body.success).toBe(true);
            (0, vitest_1.expect)(initProfileResponse.body.data.connection).toBeNull();
            // --- ROLE MATCHING VALIDATION CHECK ---
            // User A (BROTHER) tries to send request to User C (SISTER) -> Expect 400 rejection (Cross-gender/role check)
            const crossRoleResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userC._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userC._id.toString() },
            }, crossRoleResponse.body, 'ROLE-CHECK', 'User A (BROTHER) tries to request User C (SISTER) -> Rejection expected');
            (0, vitest_1.expect)(crossRoleResponse.status).toBe(400);
            (0, vitest_1.expect)(crossRoleResponse.body.success).toBe(false);
            (0, vitest_1.expect)(crossRoleResponse.body.message).toContain('can only connect with another');
            // --- SELF-CONNECT VALIDATION CHECK ---
            // User A (BROTHER) tries to connect with themselves -> Expect 400 rejection
            const selfConnectResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userA._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userA._id.toString() },
            }, selfConnectResponse.body, 'SELF-CHECK', 'User A (BROTHER) tries to connect with themselves -> Rejection expected');
            (0, vitest_1.expect)(selfConnectResponse.status).toBe(400);
            (0, vitest_1.expect)(selfConnectResponse.body.success).toBe(false);
            (0, vitest_1.expect)(selfConnectResponse.body.message).toBe('You cannot connect with yourself');
            // --- VALID REQUEST CREATION ---
            // User A (BROTHER) sends request to User B (BROTHER) -> Expect 201 Created
            const sendResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userB._id.toString() },
            }, sendResponse.body, 'VALID-REQUEST', 'User A sends a valid connection request to User B');
            (0, vitest_1.expect)(sendResponse.status).toBe(201);
            (0, vitest_1.expect)(sendResponse.body.success).toBe(true);
            const connectionId = sendResponse.body.data.id;
            (0, vitest_1.expect)(connectionId).toBeDefined();
            (0, vitest_1.expect)(sendResponse.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.PENDING);
            (0, vitest_1.expect)(sendResponse.body.data.receiver.id).toBe(userB._id.toString());
            // --- NOTIFICATION VERIFICATION: CONNECTION REQUEST SENT ---
            // sendNotifications runs for real, so the Notification document is in the DB.
            // Verify via direct DB query first, then confirm via the API endpoint.
            const requestNotification = yield notification_model_1.Notification.findOne({
                receiver: userB._id,
                type: 'CONNECTION_REQUEST',
            });
            (0, vitest_1.expect)(requestNotification).not.toBeNull();
            (0, vitest_1.expect)(requestNotification.schemaVersion).toBe(1);
            (0, vitest_1.expect)(requestNotification.text).toBe(`${userA.name} wants to connect`);
            (0, vitest_1.expect)(requestNotification.resourceType).toBe('User');
            (0, vitest_1.expect)(requestNotification.resourceId).toBe(userA._id.toString());
            (0, vitest_1.expect)(requestNotification.metadata.actor.id).toBe(userA._id.toString());
            (0, vitest_1.expect)(requestNotification.metadata.subject.id).toBe(connectionId);
            // User B hits GET /api/v1/notifications/me and sees the notification in the response
            const notificationsResponseB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/notifications/me')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/notifications/me', {}, notificationsResponseB.body, 'NOTIFICATION-REQUEST-SENT', 'User B fetches notifications (should contain connection request notification)');
            (0, vitest_1.expect)(notificationsResponseB.status).toBe(200);
            (0, vitest_1.expect)(notificationsResponseB.body.success).toBe(true);
            // Cursor pagination meta — flat shape: limit + nextCursor + hasNext + unreadCount
            // all at the same level. No nested `pagination` wrapper.
            (0, vitest_1.expect)(notificationsResponseB.body.meta.unreadCount).toBe(1);
            (0, vitest_1.expect)(notificationsResponseB.body.meta).toMatchObject({
                limit: vitest_1.expect.any(Number),
                hasNext: false,
                nextCursor: null,
                unreadCount: 1,
            });
            const requestNotifInApi = notificationsResponseB.body.data.find((n) => n.type === 'CONNECTION_REQUEST');
            (0, vitest_1.expect)(requestNotifInApi).toBeDefined();
            (0, vitest_1.expect)(requestNotifInApi.schemaVersion).toBe(1);
            (0, vitest_1.expect)(requestNotifInApi.isRead).toBe(false);
            (0, vitest_1.expect)(requestNotifInApi.readAt).toBeNull();
            // actor — denormalized sender data
            (0, vitest_1.expect)(requestNotifInApi.actor.id).toBe(userA._id.toString());
            (0, vitest_1.expect)(requestNotifInApi.actor.name).toBe(userA.name);
            (0, vitest_1.expect)(requestNotifInApi.actor.profileImage).toBeDefined();
            // subject — the connection record
            (0, vitest_1.expect)(requestNotifInApi.subject.type).toBe('Connection');
            (0, vitest_1.expect)(requestNotifInApi.subject.id).toBe(connectionId);
            // actions — client uses these to render buttons
            (0, vitest_1.expect)(requestNotifInApi.actions).toContainEqual({ type: 'ACCEPT' });
            (0, vitest_1.expect)(requestNotifInApi.actions).toContainEqual({ type: 'REJECT' });
            (0, vitest_1.expect)(requestNotifInApi.actions).toContainEqual({ type: 'VIEW_PROFILE' });
            // --- PENDING STATE PROFILE STATUS CHECKS (User A is Sender) ---
            // User A (sender) checks User B's profile -> connectionStatus: 'PENDING', connectionDirection: 'SENT'
            const pendingProfileAtoB = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, pendingProfileAtoB.body, 'PENDING-PUBLIC-PROFILE-SENT', 'User A checks User B\'s profile (PENDING status)');
            (0, vitest_1.expect)(pendingProfileAtoB.status).toBe(200);
            (0, vitest_1.expect)(pendingProfileAtoB.body.success).toBe(true);
            (0, vitest_1.expect)(pendingProfileAtoB.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(pendingProfileAtoB.body.data.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(pendingProfileAtoB.body.data.connection.direction).toBe('OUTGOING');
            (0, vitest_1.expect)(pendingProfileAtoB.body.data.connection.id).toBe(connectionId);
            // User A checks profiles list
            const pendingListA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, pendingListA.body, 'PENDING-LIST-PROFILES-SENT', 'User A fetches community discovery profiles list (PENDING status)');
            (0, vitest_1.expect)(pendingListA.status).toBe(200);
            const userBInPendingListA = pendingListA.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBInPendingListA).toBeDefined();
            (0, vitest_1.expect)(userBInPendingListA.connection).toBeDefined();
            (0, vitest_1.expect)(userBInPendingListA.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(userBInPendingListA.connection.direction).toBe('OUTGOING');
            (0, vitest_1.expect)(userBInPendingListA.connection.id).toBe(connectionId);
            // --- PENDING STATE PROFILE STATUS CHECKS (User B is Receiver) ---
            // User B (receiver) checks User A's profile -> connectionStatus: 'PENDING', connectionDirection: 'RECEIVED'
            const pendingProfileBtoA = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userA._id}/public`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, pendingProfileBtoA.body, 'PENDING-PUBLIC-PROFILE-RECEIVED', 'User B checks User A\'s profile (PENDING status)');
            (0, vitest_1.expect)(pendingProfileBtoA.status).toBe(200);
            (0, vitest_1.expect)(pendingProfileBtoA.body.success).toBe(true);
            (0, vitest_1.expect)(pendingProfileBtoA.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(pendingProfileBtoA.body.data.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(pendingProfileBtoA.body.data.connection.direction).toBe('INCOMING');
            (0, vitest_1.expect)(pendingProfileBtoA.body.data.connection.id).toBe(connectionId);
            // User B checks profiles list
            const pendingListB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, pendingListB.body, 'PENDING-LIST-PROFILES-RECEIVED', 'User B fetches community discovery profiles list (PENDING status)');
            (0, vitest_1.expect)(pendingListB.status).toBe(200);
            const userAInPendingListB = pendingListB.body.data.find((p) => (p.id || p._id) === userA._id.toString());
            (0, vitest_1.expect)(userAInPendingListB).toBeDefined();
            (0, vitest_1.expect)(userAInPendingListB.connection).toBeDefined();
            (0, vitest_1.expect)(userAInPendingListB.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(userAInPendingListB.connection.direction).toBe('INCOMING');
            (0, vitest_1.expect)(userAInPendingListB.connection.id).toBe(connectionId);
            // --- DUPLICATE REQUEST CHECK ---
            // User A attempts to request User B again -> Expect 409 Conflict
            const duplicateResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userB._id.toString() },
            }, duplicateResponse.body, 'DUPLICATE-CHECK', 'User A tries to request User B again -> Conflict expected');
            (0, vitest_1.expect)(duplicateResponse.status).toBe(409);
            (0, vitest_1.expect)(duplicateResponse.body.success).toBe(false);
            (0, vitest_1.expect)(duplicateResponse.body.message).toBe('Connection request already exists');
            // --- REVERSE DUPLICATE REQUEST CHECK ---
            // User B (receiver) tries to send a request back to User A while A's request is still PENDING.
            // The connectionKey is deterministic (min_max of IDs), so the existing record collides.
            const reverseDuplicateResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ receiverId: userA._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userA._id.toString() },
            }, reverseDuplicateResponse.body, 'REVERSE-DUPLICATE-CHECK', 'User B tries to request User A while A has a pending request -> 409 expected');
            (0, vitest_1.expect)(reverseDuplicateResponse.status).toBe(409);
            (0, vitest_1.expect)(reverseDuplicateResponse.body.success).toBe(false);
            (0, vitest_1.expect)(reverseDuplicateResponse.body.message).toBe('Connection request already exists');
            // --- RETRIEVE PENDING REQUESTS (direction=received) ---
            // User B (receiver) retrieves pending received requests -> Expect list containing User A's request
            const pendingReceivedResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections/requests?direction=received')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections/requests', {
                query: { direction: 'received' },
            }, pendingReceivedResponse.body, 'PENDING-LIST-RECEIVED', 'User B fetches received requests list');
            (0, vitest_1.expect)(pendingReceivedResponse.status).toBe(200);
            (0, vitest_1.expect)(pendingReceivedResponse.body.success).toBe(true);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data[0].connectionId).toBe(connectionId);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data[0].sender.id).toBe(userA._id.toString());
            // --- RETRIEVE PENDING REQUESTS (direction=sent) ---
            // User A (sender) retrieves their outgoing pending requests -> Expect list containing their request to User B
            const pendingSentResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections/requests?direction=sent')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections/requests', {
                query: { direction: 'sent' },
            }, pendingSentResponse.body, 'PENDING-LIST-SENT', 'User A fetches sent requests list');
            (0, vitest_1.expect)(pendingSentResponse.status).toBe(200);
            (0, vitest_1.expect)(pendingSentResponse.body.success).toBe(true);
            (0, vitest_1.expect)(pendingSentResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(pendingSentResponse.body.data[0].connectionId).toBe(connectionId);
            (0, vitest_1.expect)(pendingSentResponse.body.data[0].receiver.id).toBe(userB._id.toString());
            // --- RECEIVER CANCELLATION GUARD ---
            // User B (receiver) attempts to cancel User A's pending request -> Expect 403 Forbidden
            // Only the original sender is allowed to cancel; the receiver must use REJECT instead.
            const receiverCancelResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/cancel`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/cancel', {
                params: { connectionId },
            }, receiverCancelResponse.body, 'RECEIVER-CANCEL-GUARD', 'User B (receiver) tries to cancel User A\'s request -> 403 expected');
            (0, vitest_1.expect)(receiverCancelResponse.status).toBe(403);
            (0, vitest_1.expect)(receiverCancelResponse.body.success).toBe(false);
            // --- REQUEST CANCELLATION ---
            // User A (sender) cancels the pending connection request -> Expect 200 OK
            const cancelResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${connectionId}/cancel`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/cancel', {
                params: { connectionId },
            }, cancelResponse.body, 'CANCELLATION', 'User A cancels the pending connection request');
            (0, vitest_1.expect)(cancelResponse.status).toBe(200);
            (0, vitest_1.expect)(cancelResponse.body.success).toBe(true);
            (0, vitest_1.expect)(cancelResponse.body.data.id).toBe(connectionId);
            (0, vitest_1.expect)(cancelResponse.body.data.status).toBe('NONE');
            // Verify profile and list endpoints are back to 'NONE' after cancellation
            const cancelProfileResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, cancelProfileResponse.body, 'CANCELLED-PROFILE', 'User A checks User B\'s profile (after cancellation - NONE status)');
            (0, vitest_1.expect)(cancelProfileResponse.body.data.connection).toBeNull();
            const cancelListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, cancelListResponse.body, 'CANCELLED-LIST-PROFILES', 'User A fetches community discovery profiles list (after cancellation - NONE status)');
            const userBAfterCancel = cancelListResponse.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBAfterCancel.connection).toBeNull();
            // --- USER B CANCELLATION CHECK PERSPECTIVE ---
            // Verify that User B's received requests list is now empty
            const checkPendingResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections/requests?direction=received')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections/requests', { query: { direction: 'received' } }, checkPendingResponse.body, 'CANCELLED-RECEIVED-LIST', 'User B fetches received requests list (after cancellation - should be empty)');
            (0, vitest_1.expect)(checkPendingResponse.status).toBe(200);
            (0, vitest_1.expect)(checkPendingResponse.body.data).toHaveLength(0);
            // Verify User B's profile view of User A is null
            const cancelProfileResponseB = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userA._id}/public`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, cancelProfileResponseB.body, 'CANCELLED-PROFILE-B', 'User B checks User A\'s profile (after cancellation - NONE status)');
            (0, vitest_1.expect)(cancelProfileResponseB.body.data.connection).toBeNull();
            // --- REQUEST RE-CREATION & REJECTION ---
            // Re-create request for testing rejection
            const sendRecreateResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id.toString() });
            const recreatedId = sendRecreateResponse.body.data.id;
            // --- POLISH: SENDER REJECT GUARD ---
            // User A (sender) tries to reject their own outgoing request -> 403 Forbidden expected
            const senderRejectResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${recreatedId}/reject`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/reject', {
                params: { connectionId: recreatedId },
            }, senderRejectResponse.body, 'SENDER-REJECT-GUARD', 'User A (sender) tries to reject own request -> 403 expected');
            (0, vitest_1.expect)(senderRejectResponse.status).toBe(403);
            (0, vitest_1.expect)(senderRejectResponse.body.success).toBe(false);
            // --- POLISH: SENDER ACCEPT GUARD ---
            // User A (sender) tries to accept their own outgoing request -> 403 Forbidden expected
            const senderAcceptResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${recreatedId}/accept`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/accept', {
                params: { connectionId: recreatedId },
            }, senderAcceptResponse.body, 'SENDER-RESPOND-GUARD', 'User A (sender) tries to accept own request -> 403 expected');
            (0, vitest_1.expect)(senderAcceptResponse.status).toBe(403);
            (0, vitest_1.expect)(senderAcceptResponse.body.success).toBe(false);
            // User B (receiver) rejects User A's request -> Expect 200 OK with data: { id, status: 'NONE' }
            const rejectResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${recreatedId}/reject`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/reject', {
                params: { connectionId: recreatedId },
            }, rejectResponse.body, 'REJECTION', 'User B rejects User A\'s connection request');
            (0, vitest_1.expect)(rejectResponse.status).toBe(200);
            (0, vitest_1.expect)(rejectResponse.body.success).toBe(true);
            (0, vitest_1.expect)(rejectResponse.body.data.id).toBe(recreatedId);
            (0, vitest_1.expect)(rejectResponse.body.data.status).toBe('NONE');
            // Verify profile and list endpoints are back to 'NONE' after rejection
            const rejectProfileResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, rejectProfileResponse.body, 'REJECTED-PROFILE', 'User A checks User B\'s profile (after rejection - NONE status)');
            (0, vitest_1.expect)(rejectProfileResponse.body.data.connection).toBeNull();
            const rejectListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, rejectListResponse.body, 'REJECTED-LIST-PROFILES', 'User A fetches community discovery profiles list (after rejection - NONE status)');
            const userBAfterReject = rejectListResponse.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBAfterReject.connection).toBeNull();
            // --- REQUEST RE-CREATION & ACCEPTANCE (TESTING IMMEDIATE RE-REQUEST BEHAVIOR) ---
            // We explicitly test that immediate re-requesting is allowed post-rejection.
            // Since the connection record was deleted, there is no cooldown, and the state returned to 'NONE'.
            const sendRecreate2Response = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userB._id.toString() },
            }, sendRecreate2Response.body, 'RE-REQUEST-AFTER-REJECTION', 'User A immediately re-requests User B after rejection -> Expect 201 Created and new connection ID');
            (0, vitest_1.expect)(sendRecreate2Response.status).toBe(201);
            (0, vitest_1.expect)(sendRecreate2Response.body.success).toBe(true);
            const finalConnectionId = sendRecreate2Response.body.data.id;
            (0, vitest_1.expect)(finalConnectionId).toBeDefined();
            (0, vitest_1.expect)(finalConnectionId).not.toBe(recreatedId); // Verify a brand new connection ID is generated
            (0, vitest_1.expect)(sendRecreate2Response.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.PENDING);
            // User B (receiver) accepts User A's request -> Expect 200 OK with clean `{ id, status, chatId }` payload
            const acceptResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${finalConnectionId}/accept`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/accept', {
                params: { connectionId: finalConnectionId },
            }, acceptResponse.body, 'ACCEPTANCE', 'User B accepts User A\'s connection request');
            (0, vitest_1.expect)(acceptResponse.status).toBe(200);
            (0, vitest_1.expect)(acceptResponse.body.success).toBe(true);
            (0, vitest_1.expect)(acceptResponse.body.data.id).toBe(finalConnectionId);
            (0, vitest_1.expect)(acceptResponse.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.ACCEPTED);
            (0, vitest_1.expect)(acceptResponse.body.data.chatId).toBeDefined();
            const chatId = acceptResponse.body.data.chatId;
            // --- NOTIFICATION VERIFICATION: CONNECTION ACCEPTED ---
            // sendNotifications runs for real, so the Notification document is in the DB.
            // Verify via direct DB query first, then confirm via the API endpoint.
            const acceptedNotification = yield notification_model_1.Notification.findOne({
                receiver: userA._id,
                type: 'CONNECTION_ACCEPTED',
            });
            (0, vitest_1.expect)(acceptedNotification).not.toBeNull();
            (0, vitest_1.expect)(acceptedNotification.schemaVersion).toBe(1);
            (0, vitest_1.expect)(acceptedNotification.text).toBe(`${userB.name} accepted your connection request`);
            (0, vitest_1.expect)(acceptedNotification.resourceType).toBe('User');
            (0, vitest_1.expect)(acceptedNotification.resourceId).toBe(userB._id.toString());
            (0, vitest_1.expect)(acceptedNotification.metadata.actor.id).toBe(userB._id.toString());
            (0, vitest_1.expect)(acceptedNotification.metadata.subject.chatId).toBe(chatId);
            // User A hits GET /api/v1/notifications/me and sees the accepted notification
            const notificationsResponseA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/notifications/me')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/notifications/me', {}, notificationsResponseA.body, 'NOTIFICATION-CONNECTION-ACCEPTED', 'User A fetches notifications (should contain connection accepted notification)');
            (0, vitest_1.expect)(notificationsResponseA.status).toBe(200);
            (0, vitest_1.expect)(notificationsResponseA.body.success).toBe(true);
            // Cursor pagination meta — flat shape
            (0, vitest_1.expect)(notificationsResponseA.body.meta.unreadCount).toBe(1);
            (0, vitest_1.expect)(notificationsResponseA.body.meta).toMatchObject({
                limit: vitest_1.expect.any(Number),
                hasNext: false,
                nextCursor: null,
                unreadCount: 1,
            });
            const acceptedNotifInApi = notificationsResponseA.body.data.find((n) => n.type === 'CONNECTION_ACCEPTED');
            (0, vitest_1.expect)(acceptedNotifInApi).toBeDefined();
            (0, vitest_1.expect)(acceptedNotifInApi.schemaVersion).toBe(1);
            (0, vitest_1.expect)(acceptedNotifInApi.isRead).toBe(false);
            (0, vitest_1.expect)(acceptedNotifInApi.readAt).toBeNull();
            // actor — denormalized acceptor data
            (0, vitest_1.expect)(acceptedNotifInApi.actor.id).toBe(userB._id.toString());
            (0, vitest_1.expect)(acceptedNotifInApi.actor.name).toBe(userB.name);
            (0, vitest_1.expect)(acceptedNotifInApi.actor.profileImage).toBeDefined();
            // subject — connection + chatId so client can open chat directly
            (0, vitest_1.expect)(acceptedNotifInApi.subject.type).toBe('Connection');
            (0, vitest_1.expect)(acceptedNotifInApi.subject.chatId).toBe(chatId);
            // actions — client uses these to render buttons
            (0, vitest_1.expect)(acceptedNotifInApi.actions).toContainEqual({ type: 'OPEN_CHAT' });
            (0, vitest_1.expect)(acceptedNotifInApi.actions).toContainEqual({ type: 'VIEW_PROFILE' });
            // --- POLISH: ACCEPTING AN ALREADY-ACCEPTED CONNECTION ---
            // User B tries to accept again -> Expect 400 Bad Request (not pending anymore)
            const doubleAcceptResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${finalConnectionId}/accept`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/accept', {
                params: { connectionId: finalConnectionId },
            }, doubleAcceptResponse.body, 'DOUBLE-ACCEPTANCE-GUARD', 'User B tries to accept an already-accepted connection request -> Expect 400 Bad Request');
            (0, vitest_1.expect)(doubleAcceptResponse.status).toBe(400);
            (0, vitest_1.expect)(doubleAcceptResponse.body.success).toBe(false);
            (0, vitest_1.expect)(doubleAcceptResponse.body.message).toContain('no longer pending');
            // --- CONNECTED STATE PROFILE STATUS CHECKS ---
            // User A fetching User B's profile -> connection status: 'ACCEPTED', connectionId, chatId (no direction)
            const connectedProfileResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, connectedProfileResponse.body, 'CONNECTED-PROFILE', 'User A checks User B\'s profile (ACCEPTED status)');
            (0, vitest_1.expect)(connectedProfileResponse.status).toBe(200);
            (0, vitest_1.expect)(connectedProfileResponse.body.success).toBe(true);
            (0, vitest_1.expect)(connectedProfileResponse.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(connectedProfileResponse.body.data.connection.status).toBe('ACCEPTED');
            (0, vitest_1.expect)(connectedProfileResponse.body.data.connection.direction).toBeUndefined();
            (0, vitest_1.expect)(connectedProfileResponse.body.data.connection.id).toBe(finalConnectionId);
            (0, vitest_1.expect)(connectedProfileResponse.body.data.connection.chatId).toBe(chatId);
            // User A checks profiles list
            const connectedListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, connectedListResponse.body, 'CONNECTED-LIST-PROFILES', 'User A fetches community discovery profiles list (ACCEPTED status)');
            (0, vitest_1.expect)(connectedListResponse.status).toBe(200);
            const userBInConnectedList = connectedListResponse.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBInConnectedList).toBeDefined();
            (0, vitest_1.expect)(userBInConnectedList.connection).toBeDefined();
            (0, vitest_1.expect)(userBInConnectedList.connection.status).toBe('ACCEPTED');
            (0, vitest_1.expect)(userBInConnectedList.connection.direction).toBeUndefined();
            (0, vitest_1.expect)(userBInConnectedList.connection.id).toBe(finalConnectionId);
            // --- RETRIEVE ACTIVE CONNECTIONS (BOTH SIDES) ---
            // User A retrieves their active connections list -> Expect list containing User B
            const activeConnectionsResponseA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections', {}, activeConnectionsResponseA.body, 'ACTIVE-CONNECTIONS-A', 'User A fetches active connections list');
            (0, vitest_1.expect)(activeConnectionsResponseA.status).toBe(200);
            (0, vitest_1.expect)(activeConnectionsResponseA.body.success).toBe(true);
            (0, vitest_1.expect)(activeConnectionsResponseA.body.data).toHaveLength(1);
            (0, vitest_1.expect)(activeConnectionsResponseA.body.data[0].id || activeConnectionsResponseA.body.data[0]._id).toBe(finalConnectionId);
            (0, vitest_1.expect)(activeConnectionsResponseA.body.data[0].chatId).toBe(chatId);
            (0, vitest_1.expect)(activeConnectionsResponseA.body.data[0].connectedUser.id).toBe(userB._id.toString());
            // User B retrieves their active connections list -> Expect list containing User A
            const activeConnectionsResponseB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections', {}, activeConnectionsResponseB.body, 'ACTIVE-CONNECTIONS-B', 'User B fetches active connections list');
            (0, vitest_1.expect)(activeConnectionsResponseB.status).toBe(200);
            (0, vitest_1.expect)(activeConnectionsResponseB.body.success).toBe(true);
            (0, vitest_1.expect)(activeConnectionsResponseB.body.data).toHaveLength(1);
            (0, vitest_1.expect)(activeConnectionsResponseB.body.data[0].id || activeConnectionsResponseB.body.data[0]._id).toBe(finalConnectionId);
            (0, vitest_1.expect)(activeConnectionsResponseB.body.data[0].chatId).toBe(chatId);
            (0, vitest_1.expect)(activeConnectionsResponseB.body.data[0].connectedUser.id).toBe(userA._id.toString());
            // --- REMOVE CONNECTION SECURITY GUARD ---
            // User C (not in connection) tries to remove connection between User A & User B -> Expect 403 Forbidden
            const foreignRemoveResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${finalConnectionId}/remove`)
                .set('Authorization', `Bearer ${tokenC}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/remove', {
                params: { connectionId: finalConnectionId },
            }, foreignRemoveResponse.body, 'FOREIGN-REMOVAL-GUARD', 'User C (not in connection) tries to remove connection -> 403 expected');
            (0, vitest_1.expect)(foreignRemoveResponse.status).toBe(403);
            (0, vitest_1.expect)(foreignRemoveResponse.body.success).toBe(false);
            // --- REMOVE CONNECTION (User B is Receiver of original request) ---
            // Either user can remove. We have User B (receiver) perform the removal to verify both sender/receiver capability.
            const removeResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/${finalConnectionId}/remove`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/:connectionId/remove', {
                params: { connectionId: finalConnectionId },
            }, removeResponse.body, 'REMOVAL', 'User B removes the accepted active connection');
            (0, vitest_1.expect)(removeResponse.status).toBe(200);
            (0, vitest_1.expect)(removeResponse.body.success).toBe(true);
            (0, vitest_1.expect)(removeResponse.body.data.id).toBe(finalConnectionId);
            (0, vitest_1.expect)(removeResponse.body.data.status).toBe('NONE');
            // --- VERIFY POST-REMOVAL STATE (USER A PERSPECTIVE) ---
            // Verify profile and list endpoints are back to null for User A
            const removeProfileResponseA = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, removeProfileResponseA.body, 'REMOVED-PROFILE-A', 'User A checks User B\'s profile (after removal - null expected)');
            (0, vitest_1.expect)(removeProfileResponseA.body.data.connection).toBeNull();
            const removeListResponseA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, removeListResponseA.body, 'REMOVED-LIST-PROFILES-A', 'User A fetches profiles list (after removal)');
            const userBAfterRemoval = removeListResponseA.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBAfterRemoval.connection).toBeNull();
            const emptyConnectionsA = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(emptyConnectionsA.body.data).toHaveLength(0);
            // --- VERIFY POST-REMOVAL STATE (USER B PERSPECTIVE) ---
            // Verify profile and list endpoints are back to null for User B
            const removeProfileResponseB = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userA._id}/public`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userA._id.toString() } }, removeProfileResponseB.body, 'REMOVED-PROFILE-B', 'User B checks User A\'s profile (after removal - null expected)');
            (0, vitest_1.expect)(removeProfileResponseB.body.data.connection).toBeNull();
            const removeListResponseB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, removeListResponseB.body, 'REMOVED-LIST-PROFILES-B', 'User B fetches profiles list (after removal)');
            const userAAfterRemoval = removeListResponseB.body.data.find((p) => (p.id || p._id) === userA._id.toString());
            (0, vitest_1.expect)(userAAfterRemoval.connection).toBeNull();
            const emptyConnectionsB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, vitest_1.expect)(emptyConnectionsB.body.data).toHaveLength(0);
            // --- RE-REQUEST AFTER REMOVAL ---
            // After removing an accepted connection, the DB record is deleted.
            // Verify the sender can immediately re-request — different DB state than post-rejection.
            const reRequestAfterRemovalResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ receiverId: userB._id.toString() });
            (0, testLogger_1.logApi)('POST', '/api/v1/connections', {
                body: { receiverId: userB._id.toString() },
            }, reRequestAfterRemovalResponse.body, 'RE-REQUEST-AFTER-REMOVAL', 'User A re-requests User B after active connection removal -> 201 expected');
            (0, vitest_1.expect)(reRequestAfterRemovalResponse.status).toBe(201);
            (0, vitest_1.expect)(reRequestAfterRemovalResponse.body.success).toBe(true);
            (0, vitest_1.expect)(reRequestAfterRemovalResponse.body.data.id).toBeDefined();
            (0, vitest_1.expect)(reRequestAfterRemovalResponse.body.data.id).not.toBe(finalConnectionId);
            (0, vitest_1.expect)(reRequestAfterRemovalResponse.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.PENDING);
        }));
    });
    (0, vitest_1.describe)('Unauthenticated Access (401)', () => {
        (0, vitest_1.it)('should return 401 Forbidden on all connection endpoints when no token is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeId = new mongoose_1.default.Types.ObjectId().toString();
            const endpoints = [
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
                const req = (0, supertest_1.default)(app_1.default)[ep.method](ep.url);
                if (ep.body)
                    req.send(ep.body);
                const res = yield req;
                (0, vitest_1.expect)(res.status).toBe(401);
                (0, vitest_1.expect)(res.body.success).toBe(false);
            }
        }));
    });
});
