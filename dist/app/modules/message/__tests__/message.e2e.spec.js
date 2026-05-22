"use strict";
/**
 * E2E tests for Message module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and global Socket.io.
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
const crypto_1 = require("crypto");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const chat_model_1 = require("../../chat/chat.model");
const message_model_1 = require("../message.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const socketManager_1 = require("../../../../helpers/socketManager");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../notification/pushNotificationHelper', () => ({
    pushNotificationHelper: {
        sendPushNotifications: vitest_1.vi.fn().mockResolvedValue(undefined),
        sendPushNotification: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
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
            email: `${(0, crypto_1.randomUUID)()}@test.com`,
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
function setupChat() {
    return __awaiter(this, void 0, void 0, function* () {
        const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userA');
        const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userB');
        const chat = yield chat_model_1.Chat.create({
            participants: [userA._id, userB._id]
        });
        return { userA, tokenA, userB, tokenB, chatId: chat._id.toString() };
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
    yield message_model_1.Message.deleteMany({});
    yield chat_model_1.Chat.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Mock global io
    const mockIo = {
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
    global.io = mockIo;
    // Initialize SocketManager with the mock
    socketManager_1.SocketManager.init(mockIo);
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Message E2E Tests', () => {
    (0, vitest_1.describe)('POST /api/v1/messages (Send Message)', () => {
        (0, vitest_1.it)('successfully sends a text message and updates chat lastMessage', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const { tokenA, chatId, userB } = yield setupChat();
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                chatId,
                text: 'Hello, this is a test message',
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body: { chatId, text: 'Hello, this is a test message' } }, res.body, 'SEND-MESSAGE-SUCCESS');
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.text).toBe('Hello, this is a test message');
            (0, vitest_1.expect)(res.body.data.chatId).toBe(chatId);
            // Verify chat lastMessage update
            const updatedChat = yield chat_model_1.Chat.findById(chatId);
            (0, vitest_1.expect)((_a = updatedChat === null || updatedChat === void 0 ? void 0 : updatedChat.lastMessage) === null || _a === void 0 ? void 0 : _a.text).toBe('Hello, this is a test message');
            // Verify Socket.io emission
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('MESSAGE_SENT', vitest_1.expect.any(Object));
        }));
        (0, vitest_1.it)('rejects message from a non-participant', () => __awaiter(void 0, void 0, void 0, function* () {
            const { chatId } = yield setupChat();
            const { token: strangerToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'stranger');
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${strangerToken}`)
                .send({
                chatId,
                text: 'I am not a participant',
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body: { chatId } }, res.body, 'SEND-MESSAGE-FORBIDDEN');
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.message).toContain('not a participant');
        }));
        (0, vitest_1.it)('rejects empty message (no text and no attachments)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId } = yield setupChat();
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                chatId,
                text: '',
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body: { chatId, text: '' } }, res.body, 'SEND-MESSAGE-EMPTY');
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.message).toContain('must contain text or at least one attachment');
        }));
    });
    (0, vitest_1.describe)('GET /api/v1/messages/chat/:chatId (Message History)', () => {
        (0, vitest_1.it)('retrieves message history with correct authorization', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId, userA } = yield setupChat();
            // Create some messages
            yield message_model_1.Message.create([
                { chatId, sender: userA._id, text: 'Msg 1', type: 'text' },
                { chatId, sender: userA._id, text: 'Msg 2', type: 'text' },
            ]);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, res.body, 'GET-HISTORY-SUCCESS');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBe(2);
            (0, vitest_1.expect)(res.body.data[0].text).toBe('Msg 1');
        }));
        (0, vitest_1.it)('denies history access to non-participants', () => __awaiter(void 0, void 0, void 0, function* () {
            const { chatId } = yield setupChat();
            const { token: strangerToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'stranger');
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${strangerToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, res.body, 'GET-HISTORY-FORBIDDEN');
            (0, vitest_1.expect)(res.status).toBe(403);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.message).toContain('not a participant');
        }));
    });
    (0, vitest_1.describe)('POST /api/v1/messages/chat/:chatId/read (Mark Read)', () => {
        (0, vitest_1.it)('marks messages as read by the participant', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenB, chatId, userA, userB } = yield setupChat();
            // Create a message from userA
            const msg = yield message_model_1.Message.create({
                chatId,
                sender: userA._id,
                text: 'Unread message',
                type: 'text',
            });
            const res = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, { params: { chatId } }, res.body, 'MARK-READ-SUCCESS');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Verify in DB
            const updatedMsg = yield message_model_1.Message.findById(msg._id);
            (0, vitest_1.expect)(updatedMsg === null || updatedMsg === void 0 ? void 0 : updatedMsg.readBy.map(id => id.toString())).toContain(userB._id.toString());
        }));
    });
});
