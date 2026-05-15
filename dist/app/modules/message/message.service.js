"use strict";
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
exports.MessageService = void 0;
const message_model_1 = require("./message.model");
const chat_model_1 = require("../chat/chat.model");
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const presenceHelper_1 = require("../../helpers/presenceHelper");
const unreadHelper_1 = require("../../helpers/unreadHelper");
const notificationsHelper_1 = require("../notification/notificationsHelper");
const socketManager_1 = require("../../../helpers/socketManager");
const redisClient_1 = require("../../../shared/redisClient");
const logger_1 = require("../../../shared/logger");
const sendMessageToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Ensure attachments is always an array
    if (!Array.isArray(payload.attachments)) {
        payload.attachments = [];
    }
    // Authorization: sender must be a participant of the chat
    const isParticipant = yield chat_model_1.Chat.exists({
        _id: payload === null || payload === void 0 ? void 0 : payload.chatId,
        participants: payload === null || payload === void 0 ? void 0 : payload.sender,
    });
    if (!isParticipant) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
    }
    // save to DB
    const response = yield message_model_1.Message.create(payload);
    // Populate sender for the socket event
    const populatedMessage = yield message_model_1.Message.findById(response._id)
        .populate('sender', '_id name profilePicture')
        .lean();
    //@ts-ignore
    const io = global.io;
    // Fetch chat participants for socket emit and notifications
    const chat = yield chat_model_1.Chat.findById(response.chatId).select('participants');
    const participants = ((chat === null || chat === void 0 ? void 0 : chat.participants) || [])
        .map(p => String(p))
        .filter(Boolean);
    const receivers = participants.filter(p => String(p) !== String(response.sender));
    if (io && populatedMessage) {
        // Ensure chatId is a string for frontend matching
        const chatIdStr = String(payload === null || payload === void 0 ? void 0 : payload.chatId);
        const messagePayload = {
            message: Object.assign(Object.assign({}, populatedMessage), { chatId: chatIdStr }),
        };
        // Emit to chat room for participants who have joined
        io.to(`chat::${chatIdStr}`).emit('MESSAGE_SENT', messagePayload);
        // Also emit to each participant's user room to ensure delivery
        // even if they haven't joined the chat room yet (e.g., just opened the page)
        for (const participantId of participants) {
            io.to(`user::${participantId}`).emit('MESSAGE_SENT', messagePayload);
        }
    }
    // Offline notification triggers
    try {
        // Increment unread count for receivers
        for (const receiverId of receivers) {
            try {
                yield (0, unreadHelper_1.incrementUnreadCount)(String(response.chatId), String(receiverId), 1);
            }
            catch (_a) { }
        }
        for (const receiverId of receivers) {
            const online = yield (0, presenceHelper_1.isOnline)(receiverId);
            if (!online) {
                const preview = response.text || 'New message';
                yield (0, notificationsHelper_1.sendNotifications)({
                    title: 'New Message',
                    text: preview,
                    receiver: new mongoose_1.default.Types.ObjectId(receiverId),
                    isRead: false,
                    type: 'SYSTEM',
                    referenceId: response._id,
                });
            }
        }
    }
    catch (err) {
        // Swallow notification errors to not block messaging
    }
    return response;
});
const getMessageFromDB = (user, id, query) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Chat ID');
    }
    const queryBuilder = new QueryBuilder_1.default(message_model_1.Message.find({ chatId: id }), // sender auto-populated via pre-hook
    query)
        .search(['text'])
        .filter()
        .sort()
        .paginate()
        .fields();
    // Fetch messages
    let messages = yield queryBuilder.modelQuery;
    // Explicitly sort by createdAt ASC for predictable ordering
    messages = messages.sort((a, b) => new Date(a === null || a === void 0 ? void 0 : a.createdAt).getTime() -
        new Date(b === null || b === void 0 ? void 0 : b.createdAt).getTime());
    // Get pagination info
    const pagination = yield queryBuilder.getPaginationInfo();
    // Fetch the chat participant (exclude the logged-in user)
    const chat = yield chat_model_1.Chat.findById(id).populate({
        path: 'participants',
        select: 'name profile location',
        match: { _id: { $ne: user.id } },
    });
    const participant = (chat === null || chat === void 0 ? void 0 : chat.participants[0]) || null;
    return {
        messages,
        pagination,
        participant,
    };
});
const markAsDelivered = (messageId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Message ID');
    }
    const updated = yield message_model_1.Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: userId } }, { new: true });
    return updated;
});
const markChatAsRead = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.Types.ObjectId.isValid(chatId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Chat ID');
    }
    // Find messages that will be marked as read
    const toUpdate = yield message_model_1.Message.find({
        chatId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
    }).select('_id chatId');
    if (!toUpdate.length) {
        return { modifiedCount: 0, updatedIds: [] };
    }
    // Mark them as read for this user
    yield message_model_1.Message.updateMany({ _id: { $in: toUpdate.map(m => m._id) } }, { $addToSet: { readBy: userId } });
    // Emit real-time MESSAGE_READ for each updated message to the chat room
    // @ts-ignore
    const io = global.io;
    if (io) {
        for (const msg of toUpdate) {
            io.to(`chat::${String(chatId)}`).emit('MESSAGE_READ', {
                messageId: String(msg._id),
                chatId: String(chatId),
                userId,
            });
        }
    }
    // Reset unread count cache for this user on this chat
    try {
        yield (0, unreadHelper_1.setUnreadCount)(String(chatId), String(userId), 0);
    }
    catch (_a) { }
    return { modifiedCount: toUpdate.length, updatedIds: toUpdate.map(m => String(m._id)) };
});
const getUnreadCount = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield message_model_1.Message.countDocuments({
        chatId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
    });
    return count;
});
const send = (chatId, senderId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // Req 10.4 — validate chatId as ObjectId before any DB query
    if (!mongoose_1.default.Types.ObjectId.isValid(chatId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid chatId');
    }
    // Validate senderId as ObjectId before any DB query
    if (!mongoose_1.default.Types.ObjectId.isValid(senderId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid senderId');
    }
    // Req 5.1 — fetch Chat; throw 404 if not found (critical — re-throw on failure per 10.3)
    const chat = yield chat_model_1.Chat.findById(chatId);
    if (!chat) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    // Req 5.2 — throw 403 if senderId not in participants
    const participantIds = chat.participants.map(p => String(p));
    if (!participantIds.includes(String(senderId))) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
    }
    // Req 5.3 — validate payload: must have non-empty text or at least one attachment
    const hasText = typeof payload.text === 'string' && payload.text.trim().length > 0;
    const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;
    if (!hasText && !hasAttachments) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Message must contain text or at least one attachment');
    }
    // Req 5.4 — text must not exceed 10,000 characters
    if (typeof payload.text === 'string' && payload.text.length > 10000) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Message text exceeds maximum length');
    }
    // Req 5.5 — attachments must not exceed 10 items
    if (Array.isArray(payload.attachments) && payload.attachments.length > 10) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Attachments cannot exceed 10 items');
    }
    // Req 11.2 — save Message; critical path — re-throw on failure per 10.3
    const created = yield message_model_1.Message.create({
        chatId,
        sender: senderId,
        text: payload.text,
        type: payload.type,
        attachments: (_a = payload.attachments) !== null && _a !== void 0 ? _a : [],
    });
    // Req 11.2 — explicitly populate sender at the call site
    const populatedMessage = yield created.populate('sender', '_id name profilePicture');
    // Req 5.11 / 1.3 — atomically update Chat.lastMessage; critical — re-throw on failure per 10.3
    const lastMessage = {
        text: (_b = payload.text) !== null && _b !== void 0 ? _b : '',
        sender: senderId,
        createdAt: created.createdAt,
    };
    yield chat_model_1.Chat.findByIdAndUpdate(chatId, {
        $set: { lastMessage },
    });
    // ── Side-effects (Req 5.6–5.12, 9.1, 10.1) ──────────────────────────────
    // Each step is wrapped in its own try/catch. Failures are logged but never
    // propagated — the saved message is always returned regardless.
    // Determine the receiver: the participant whose ID is NOT senderId (Req 5.7)
    const receiverId = (_c = participantIds.find(id => id !== String(senderId))) !== null && _c !== void 0 ? _c : null;
    // Side-effect 1: Emit MESSAGE_SENT to the chat room (Req 5.6)
    try {
        socketManager_1.SocketManager.getIO()
            .to(`chat::${chatId}`)
            .emit('MESSAGE_SENT', { message: populatedMessage });
    }
    catch (err) {
        logger_1.errorLogger.error(`[send] Failed to emit MESSAGE_SENT for chat ${chatId}: ${err}`);
    }
    // Side-effect 2: Increment receiver's unread count in Redis (Req 5.11, 9.1)
    // Done before routing so CHAT_UPDATED carries the up-to-date count.
    let newUnreadCount = 0;
    if (receiverId) {
        try {
            newUnreadCount = yield (0, unreadHelper_1.incrementUnreadCount)(chatId, receiverId, 1);
        }
        catch (err) {
            logger_1.errorLogger.error(`[send] Failed to increment unread count for user ${receiverId} in chat ${chatId}: ${err}`);
        }
    }
    // Side-effect 3 & 4: Read receiver's active chat from Redis and route accordingly
    // (Req 5.8, 5.9, 5.10)
    if (receiverId) {
        try {
            const activeChat = yield redisClient_1.redisClient.get(`active:${receiverId}:chat`);
            if (activeChat === chatId) {
                // Req 5.8 — receiver has this chat open: no push, no CHAT_UPDATED
            }
            else if (activeChat !== null) {
                // Req 5.9 — receiver is online but in a different chat: emit CHAT_UPDATED
                try {
                    socketManager_1.SocketManager.getIO()
                        .to(`user::${receiverId}`)
                        .emit('CHAT_UPDATED', { lastMessage, unreadCount: newUnreadCount });
                }
                catch (err) {
                    logger_1.errorLogger.error(`[send] Failed to emit CHAT_UPDATED to user ${receiverId}: ${err}`);
                }
            }
            else {
                // Req 5.10 — receiver is offline: send push notification with 60-second dedup
                try {
                    const dedupKey = `notif:dedup:${chatId}:${receiverId}`;
                    // SET NX EX 60 — only set if key doesn't exist; returns "OK" or null
                    const acquired = yield redisClient_1.redisClient.set(dedupKey, '1', 'EX', 60, 'NX');
                    if (acquired === 'OK') {
                        yield (0, notificationsHelper_1.sendNotifications)({
                            title: 'New Message',
                            text: payload.text || 'New message',
                            receiver: new mongoose_1.default.Types.ObjectId(receiverId),
                            isRead: false,
                            type: 'SYSTEM',
                        });
                    }
                }
                catch (err) {
                    logger_1.errorLogger.error(`[send] Failed to send push notification to user ${receiverId}: ${err}`);
                }
            }
        }
        catch (err) {
            logger_1.errorLogger.error(`[send] Failed to read active chat for user ${receiverId}: ${err}`);
        }
    }
    return populatedMessage;
});
const getHistory = (chatId, userId, cursor, limit) => __awaiter(void 0, void 0, void 0, function* () {
    // Req 6.6 — validate chatId
    if (!mongoose_1.default.Types.ObjectId.isValid(chatId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid chatId');
    }
    // Req 6.7 — validate userId
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    // Req 6.2 — clamp limit to 1–100, default 20
    const clampedLimit = Math.min(100, Math.max(1, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 20));
    // Req 6.1 / 6.3 — build base query; add cursor filter when provided
    const query = { chatId };
    if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
            query.createdAt = { $gt: cursorDate };
        }
    }
    // Req 6.5 — total matching messages (with cursor filter applied)
    const total = yield message_model_1.Message.countDocuments(query);
    // Req 6.1, 6.4 — fetch page, sort ascending, populate sender explicitly
    const messages = yield message_model_1.Message.find(query)
        .sort({ createdAt: 1 })
        .limit(clampedLimit)
        .populate('sender', '_id name profilePicture')
        .lean();
    // Req 6.5 — hasNextPage: true if more messages exist after this page
    const hasNextPage = messages.length === clampedLimit && messages.length < total;
    // Req 6.5 — nextCursor: ISO 8601 timestamp of last returned message, or null
    const nextCursor = hasNextPage && messages.length > 0
        ? messages[messages.length - 1].createdAt instanceof Date
            ? messages[messages.length - 1].createdAt.toISOString()
            : new Date(messages[messages.length - 1].createdAt).toISOString()
        : null;
    return {
        messages: messages,
        pagination: {
            total,
            limit: clampedLimit,
            hasNextPage,
            nextCursor,
        },
    };
});
const markRead = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Req 7.6 / 10.5 — validate chatId as ObjectId before any DB query
    if (!mongoose_1.default.Types.ObjectId.isValid(chatId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid chatId');
    }
    // Req 7.7 / 10.5 — validate userId as ObjectId before any DB query
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    // Req 7.2 — verify userId is a participant of the chat; throw 403 if not
    const isParticipant = yield chat_model_1.Chat.exists({
        _id: chatId,
        participants: userId,
    });
    if (!isParticipant) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
    }
    // Req 7.1 — query for Message IDs where sender !== userId AND readBy does not contain userId
    const unreadMessages = yield message_model_1.Message.find({
        chatId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
    }).select('_id');
    // Req 7.5 — if no unread messages, return early without emitting socket event
    if (unreadMessages.length === 0) {
        return { modifiedCount: 0, updatedIds: [] };
    }
    const messageIds = unreadMessages.map(m => m._id);
    // Req 7.1 — perform single updateMany using those IDs to $addToSet: { readBy: userId }
    const result = yield message_model_1.Message.updateMany({ _id: { $in: messageIds } }, { $addToSet: { readBy: userId } });
    const modifiedCount = result.modifiedCount;
    const updatedIds = messageIds.map(id => String(id));
    // Req 7.5 — if modifiedCount === 0, return without emitting socket event
    if (modifiedCount === 0) {
        return { modifiedCount: 0, updatedIds: [] };
    }
    // Req 7.4 / 9.2 — set unread count to 0 in Redis; log error if Redis fails (no empty catch)
    try {
        yield (0, unreadHelper_1.setUnreadCount)(chatId, userId, 0);
    }
    catch (err) {
        logger_1.errorLogger.error(`markRead: failed to reset unread count for chat=${chatId} user=${userId}`, err);
    }
    // Req 7.3 — emit MESSAGES_READ to chat::{chatId} room with { chatId, userId, updatedIds }
    try {
        socketManager_1.SocketManager.getIO()
            .to(`chat::${chatId}`)
            .emit('MESSAGES_READ', { chatId, userId, updatedIds });
    }
    catch (err) {
        logger_1.errorLogger.error(`markRead: failed to emit MESSAGES_READ for chat=${chatId}`, err);
    }
    // Req 7.8 — return { modifiedCount, updatedIds }
    return { modifiedCount, updatedIds };
});
exports.MessageService = {
    send,
    sendMessageToDB,
    getMessageFromDB,
    markAsDelivered,
    markChatAsRead,
    getUnreadCount,
    getHistory,
    markRead,
};
