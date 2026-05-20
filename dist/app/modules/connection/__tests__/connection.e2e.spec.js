"use strict";
/**
 * E2E tests for Connection module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks NotificationBuilder, Redis, and global Socket.io.
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
const connection_constants_1 = require("../connection.constants");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../../builder/NotificationBuilder/NotificationBuilder', () => {
    const mockSend = vitest_1.vi.fn().mockResolvedValue({ success: true });
    const mockBuilder = {
        to: vitest_1.vi.fn().mockReturnThis(),
        setTitle: vitest_1.vi.fn().mockReturnThis(),
        setText: vitest_1.vi.fn().mockReturnThis(),
        setType: vitest_1.vi.fn().mockReturnThis(),
        setResource: vitest_1.vi.fn().mockReturnThis(),
        viaAll: vitest_1.vi.fn().mockReturnThis(),
        send: mockSend,
    };
    return {
        default: vitest_1.vi.fn().mockImplementation(() => mockBuilder),
    };
});
vitest_1.vi.mock('../../notification/notificationsHelper', () => ({
    sendNotifications: vitest_1.vi.fn().mockResolvedValue(true),
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
                .post(`/api/v1/connections/request/${userC._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/request/:userId', {
                params: { userId: userC._id.toString() },
            }, crossRoleResponse.body, 'ROLE-CHECK', 'User A (BROTHER) tries to request User C (SISTER) -> Rejection expected');
            (0, vitest_1.expect)(crossRoleResponse.status).toBe(400);
            (0, vitest_1.expect)(crossRoleResponse.body.success).toBe(false);
            (0, vitest_1.expect)(crossRoleResponse.body.message).toContain('can only connect with another');
            // --- SELF-CONNECT VALIDATION CHECK ---
            // User A (BROTHER) tries to connect with themselves -> Expect 400 rejection
            const selfConnectResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/request/${userA._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/request/:userId', {
                params: { userId: userA._id.toString() },
            }, selfConnectResponse.body, 'SELF-CHECK', 'User A (BROTHER) tries to connect with themselves -> Rejection expected');
            (0, vitest_1.expect)(selfConnectResponse.status).toBe(400);
            (0, vitest_1.expect)(selfConnectResponse.body.success).toBe(false);
            (0, vitest_1.expect)(selfConnectResponse.body.message).toBe('You cannot connect with yourself');
            // --- VALID REQUEST CREATION ---
            // User A (BROTHER) sends request to User B (BROTHER) -> Expect 201 Created
            const sendResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/request/${userB._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/request/:userId', {
                params: { userId: userB._id.toString() },
            }, sendResponse.body, 'VALID-REQUEST', 'User A sends a valid connection request to User B');
            (0, vitest_1.expect)(sendResponse.status).toBe(201);
            (0, vitest_1.expect)(sendResponse.body.success).toBe(true);
            const connectionId = sendResponse.body.data.id;
            (0, vitest_1.expect)(connectionId).toBeDefined();
            (0, vitest_1.expect)(sendResponse.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.PENDING);
            (0, vitest_1.expect)(sendResponse.body.data.receiver.id).toBe(userB._id.toString());
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
                .post(`/api/v1/connections/request/${userB._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/connections/request/:userId', {
                params: { userId: userB._id.toString() },
            }, duplicateResponse.body, 'DUPLICATE-CHECK', 'User A tries to request User B again -> Conflict expected');
            (0, vitest_1.expect)(duplicateResponse.status).toBe(409);
            (0, vitest_1.expect)(duplicateResponse.body.success).toBe(false);
            (0, vitest_1.expect)(duplicateResponse.body.message).toBe('Connection request already exists');
            // --- RETRIEVE PENDING REQUESTS ---
            // User B (receiver) retrieves pending received requests -> Expect list containing User A's request
            const pendingReceivedResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections/requests?type=received')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections/requests', {
                query: { type: 'received' },
            }, pendingReceivedResponse.body, 'PENDING-LIST', 'User B fetches received requests list');
            (0, vitest_1.expect)(pendingReceivedResponse.status).toBe(200);
            (0, vitest_1.expect)(pendingReceivedResponse.body.success).toBe(true);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data[0].connectionId).toBe(connectionId);
            (0, vitest_1.expect)(pendingReceivedResponse.body.data[0].sender.id).toBe(userA._id.toString());
            // --- REQUEST CANCELLATION ---
            // User A (sender) cancels the pending connection request -> Expect 200 OK
            const cancelResponse = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/connections/${connectionId}/request`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/connections/:connectionId/request', {
                params: { connectionId },
            }, cancelResponse.body, 'CANCELLATION', 'User A cancels the pending connection request');
            (0, vitest_1.expect)(cancelResponse.status).toBe(200);
            (0, vitest_1.expect)(cancelResponse.body.success).toBe(true);
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
            // --- REQUEST RE-CREATION & REJECTION ---
            // Re-create request for testing rejection
            const sendRecreateResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/request/${userB._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            const recreatedId = sendRecreateResponse.body.data.id;
            // User B (receiver) rejects User A's request -> Expect 200 OK with data: null
            const rejectResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/connections/${recreatedId}`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ action: connection_constants_1.CONNECTION_ACTION.REJECT });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/connections/:connectionId', {
                params: { connectionId: recreatedId },
                body: { action: connection_constants_1.CONNECTION_ACTION.REJECT },
            }, rejectResponse.body, 'REJECTION', 'User B rejects User A\'s connection request');
            (0, vitest_1.expect)(rejectResponse.status).toBe(200);
            (0, vitest_1.expect)(rejectResponse.body.success).toBe(true);
            (0, vitest_1.expect)(rejectResponse.body.data).toBeNull();
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
            // --- REQUEST RE-CREATION & ACCEPTANCE ---
            // Re-create request for testing acceptance
            const sendRecreate2Response = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/connections/request/${userB._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            const finalConnectionId = sendRecreate2Response.body.data.id;
            // User B (receiver) accepts User A's request -> Expect 200 OK with clean `{ id, status, chatId }` payload
            const acceptResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/connections/${finalConnectionId}`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ action: connection_constants_1.CONNECTION_ACTION.ACCEPT });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/connections/:connectionId', {
                params: { connectionId: finalConnectionId },
                body: { action: connection_constants_1.CONNECTION_ACTION.ACCEPT },
            }, acceptResponse.body, 'ACCEPTANCE', 'User B accepts User A\'s connection request');
            (0, vitest_1.expect)(acceptResponse.status).toBe(200);
            (0, vitest_1.expect)(acceptResponse.body.success).toBe(true);
            (0, vitest_1.expect)(acceptResponse.body.data.id).toBe(finalConnectionId);
            (0, vitest_1.expect)(acceptResponse.body.data.status).toBe(connection_constants_1.CONNECTION_STATUS.ACCEPTED);
            (0, vitest_1.expect)(acceptResponse.body.data.chatId).toBeDefined();
            const chatId = acceptResponse.body.data.chatId;
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
            // User A checking details of User B -> connection status: 'ACCEPTED', connectionId, chatId (no direction)
            const connectedDetailsResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, connectedDetailsResponse.body, 'CONNECTED-DETAILS', 'User A checks User B\'s public details (ACCEPTED status)');
            (0, vitest_1.expect)(connectedDetailsResponse.status).toBe(200);
            (0, vitest_1.expect)(connectedDetailsResponse.body.success).toBe(true);
            (0, vitest_1.expect)(connectedDetailsResponse.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(connectedDetailsResponse.body.data.connection.status).toBe('ACCEPTED');
            (0, vitest_1.expect)(connectedDetailsResponse.body.data.connection.direction).toBeUndefined();
            (0, vitest_1.expect)(connectedDetailsResponse.body.data.connection.id).toBe(finalConnectionId);
            (0, vitest_1.expect)(connectedDetailsResponse.body.data.connection.chatId).toBe(chatId);
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
            // --- RETRIEVE ACTIVE CONNECTIONS ---
            // User A retrieves their active connections list -> Expect list containing User B
            const activeConnectionsResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/connections')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/connections', {}, activeConnectionsResponse.body, 'ACTIVE-CONNECTIONS', 'User A fetches active connections list');
            (0, vitest_1.expect)(activeConnectionsResponse.status).toBe(200);
            (0, vitest_1.expect)(activeConnectionsResponse.body.success).toBe(true);
            (0, vitest_1.expect)(activeConnectionsResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(activeConnectionsResponse.body.data[0].id || activeConnectionsResponse.body.data[0]._id).toBe(finalConnectionId);
            (0, vitest_1.expect)(activeConnectionsResponse.body.data[0].chatId).toBe(chatId);
            (0, vitest_1.expect)(activeConnectionsResponse.body.data[0].connectedUser.id).toBe(userB._id.toString());
            (0, vitest_1.expect)(activeConnectionsResponse.body.data[0].connectedUser.role).toBeUndefined();
            (0, vitest_1.expect)(activeConnectionsResponse.body.data[0].respondedAt).toBeUndefined();
            // --- REMOVE CONNECTION ---
            // User A (or User B) removes the active connection -> Expect 200 OK
            const removeResponse = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/connections/${finalConnectionId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/connections/:connectionId', {
                params: { connectionId: finalConnectionId },
            }, removeResponse.body, 'REMOVAL', 'User A removes the accepted active connection');
            (0, vitest_1.expect)(removeResponse.status).toBe(200);
            (0, vitest_1.expect)(removeResponse.body.success).toBe(true);
            // Verify profile and list endpoints are back to 'NONE' after removal
            const removeProfileResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/:userId/public', { params: { userId: userB._id.toString() } }, removeProfileResponse.body, 'REMOVED-PROFILE', 'User A checks User B\'s profile (after removal - NONE status)');
            (0, vitest_1.expect)(removeProfileResponse.body.data.connection).toBeNull();
            const removeListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/profiles')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/profiles', {}, removeListResponse.body, 'REMOVED-LIST-PROFILES', 'User A fetches community discovery profiles list (after removal - NONE status)');
            const userBAfterRemoval = removeListResponse.body.data.find((p) => (p.id || p._id) === userB._id.toString());
            (0, vitest_1.expect)(userBAfterRemoval.connection).toBeNull();
        }));
    });
});
