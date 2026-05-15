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
exports.ChatService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const message_model_1 = require("../message/message.model");
const user_model_1 = require("../user/user.model");
const chat_model_1 = require("./chat.model");
const presenceHelper_1 = require("../../helpers/presenceHelper");
const unreadHelper_1 = require("../../helpers/unreadHelper");
const logger_1 = require("../../../shared/logger");
const createOrGet = (userId, otherUserId) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate both IDs as valid ObjectIds
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(otherUserId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid otherUserId');
    }
    // Prevent self-chat
    if (userId === otherUserId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Cannot create a chat with yourself');
    }
    // Verify otherUserId exists in the User collection
    const otherUserExists = yield user_model_1.User.exists({ _id: otherUserId });
    if (!otherUserExists) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    // Find existing chat or create a new one
    let chat = yield chat_model_1.Chat.findOne({
        participants: { $all: [userId, otherUserId] },
    });
    if (!chat) {
        chat = yield chat_model_1.Chat.create({ participants: [userId, otherUserId] });
    }
    return chat;
});
const createChatToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    let isExistChat = yield chat_model_1.Chat.findOne({
        participants: { $all: payload },
    });
    if (isExistChat) {
        if (!isExistChat.status) {
            isExistChat.status = true;
            yield isExistChat.save();
        }
        return isExistChat;
    }
    const chat = yield chat_model_1.Chat.create({ participants: payload, status: true });
    return chat;
});
const getChatFromDB = (user, searchTerm) => __awaiter(void 0, void 0, void 0, function* () {
    const chats = yield chat_model_1.Chat.find({ participants: { $in: [user.id] } })
        .populate({
        path: 'participants',
        select: '_id name image role',
        match: Object.assign({ _id: { $ne: user.id } }, (searchTerm && { name: { $regex: searchTerm, $options: 'i' } })),
    })
        .select('participants status updatedAt');
    // Filter out chats where no participants match the search (empty participants)
    const filteredChats = chats === null || chats === void 0 ? void 0 : chats.filter((chat) => { var _a; return ((_a = chat === null || chat === void 0 ? void 0 : chat.participants) === null || _a === void 0 ? void 0 : _a.length) > 0; });
    //Use Promise.all to handle the asynchronous operations inside the map
    const chatList = yield Promise.all(filteredChats === null || filteredChats === void 0 ? void 0 : filteredChats.map((chat) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const data = chat === null || chat === void 0 ? void 0 : chat.toObject();
        const lastMessage = yield message_model_1.Message.findOne({
            chatId: chat === null || chat === void 0 ? void 0 : chat._id,
        })
            .sort({ createdAt: -1 })
            .select('text createdAt sender');
        // Compute unread count for current user with Redis cache fallback
        const cachedUnread = yield (0, unreadHelper_1.getUnreadCountCached)(String(chat === null || chat === void 0 ? void 0 : chat._id), String(user.id));
        let unreadCount;
        if (typeof cachedUnread === 'number') {
            unreadCount = cachedUnread;
        }
        else {
            unreadCount = yield message_model_1.Message.countDocuments({
                chatId: chat === null || chat === void 0 ? void 0 : chat._id,
                sender: { $ne: user.id },
                readBy: { $ne: user.id },
            });
            // Cache the count for faster subsequent retrievals
            try {
                yield (0, unreadHelper_1.setUnreadCount)(String(chat === null || chat === void 0 ? void 0 : chat._id), String(user.id), unreadCount);
            }
            catch (_b) { }
        }
        // Presence of the other participant (first populated one)
        const other = (_a = data === null || data === void 0 ? void 0 : data.participants) === null || _a === void 0 ? void 0 : _a[0];
        let presence = null;
        if (other === null || other === void 0 ? void 0 : other._id) {
            const online = yield (0, presenceHelper_1.isOnline)(String(other._id));
            let last = yield (0, presenceHelper_1.getLastActive)(String(other._id));
            if (last === undefined) {
                if (lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.createdAt) {
                    last = new Date(String(lastMessage.createdAt)).getTime();
                }
                else if (data === null || data === void 0 ? void 0 : data.updatedAt) {
                    last = new Date(String(data.updatedAt)).getTime();
                }
            }
            presence = { isOnline: online, lastActive: last };
        }
        return Object.assign(Object.assign({}, data), { lastMessage: lastMessage || null, unreadCount,
            presence });
    })));
    return chatList;
});
const getList = (userId, searchTerm) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate userId as a valid ObjectId (throw 400 if invalid)
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    // Single Chat.find with explicit populate
    const chats = yield chat_model_1.Chat.find({ participants: userId })
        .populate('participants', '_id name image role')
        .lean();
    // Return empty array when no chats found
    if (!chats || chats.length === 0) {
        return [];
    }
    // Sort by lastMessage.createdAt descending; null lastMessage sorts last
    chats.sort((a, b) => {
        var _a, _b;
        const aTime = ((_a = a.lastMessage) === null || _a === void 0 ? void 0 : _a.createdAt) ? new Date(a.lastMessage.createdAt).getTime() : -Infinity;
        const bTime = ((_b = b.lastMessage) === null || _b === void 0 ? void 0 : _b.createdAt) ? new Date(b.lastMessage.createdAt).getTime() : -Infinity;
        return bTime - aTime;
    });
    // Apply optional case-insensitive search filter on the other participant's name (in JS after populate)
    let filteredChats = chats;
    if (searchTerm && searchTerm.trim().length > 0) {
        const searchRegex = new RegExp(searchTerm.trim(), 'i');
        filteredChats = chats.filter(chat => {
            var _a;
            const participants = chat.participants;
            const other = participants.find(p => String(p._id) !== String(userId));
            return other && searchRegex.test((_a = other.name) !== null && _a !== void 0 ? _a : '');
        });
    }
    // Batch-fetch all unread counts via single Redis MGET
    const pairs = filteredChats.map(chat => ({
        chatId: String(chat._id),
        userId: String(userId),
    }));
    let unreadCounts;
    try {
        unreadCounts = yield (0, unreadHelper_1.batchGetUnreadCounts)(pairs);
    }
    catch (err) {
        // Return 0 on any Redis error (log with errorLogger)
        logger_1.errorLogger.error('getList: Redis batchGetUnreadCounts failed', err);
        unreadCounts = filteredChats.map(() => 0);
    }
    // Attach unreadCount to each chat
    return filteredChats.map((chat, index) => {
        var _a;
        return (Object.assign(Object.assign({}, chat), { unreadCount: (_a = unreadCounts[index]) !== null && _a !== void 0 ? _a : 0 }));
    });
});
exports.ChatService = { createOrGet, createChatToDB, getChatFromDB, getList };
