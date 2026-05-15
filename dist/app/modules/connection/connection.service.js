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
exports.ConnectionService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const connection_model_1 = require("./connection.model");
const chat_service_1 = require("../chat/chat.service");
const chat_model_1 = require("../chat/chat.model");
const user_1 = require("../../../enums/user");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const notificationsHelper_1 = require("../notification/notificationsHelper");
const sendRequest = (senderId, receiverId) => __awaiter(void 0, void 0, void 0, function* () {
    if (senderId === receiverId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot connect with yourself');
    }
    const receiver = yield user_model_1.User.findById(receiverId);
    if (!receiver || receiver.status !== user_1.USER_STATUS.ACTIVE) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Receiver not found or inactive');
    }
    // Check if connection already exists (either direction)
    const existingConnection = yield connection_model_1.Connection.findOne({
        $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId },
        ],
    });
    if (existingConnection) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Connection request already exists');
    }
    const connection = yield connection_model_1.Connection.create({
        sender: senderId,
        receiver: receiverId,
        status: 'PENDING',
    });
    const senderUser = yield user_model_1.User.findById(senderId).select('name profileImage');
    // Send in-app notification & push/socket
    yield (0, notificationsHelper_1.sendNotifications)({
        receiver: new mongoose_1.default.Types.ObjectId(receiverId),
        type: 'SYSTEM',
        title: 'New Connection Request',
        text: `${senderUser === null || senderUser === void 0 ? void 0 : senderUser.name} wants to connect`,
        resourceType: 'User',
        resourceId: senderId,
        userId: receiverId, // passed for push/socket helper compatibility
    });
    // @ts-ignore
    const io = global.io;
    if (io) {
        io.to(`user::${receiverId}`).emit('CONNECTION_REQUEST', {
            connectionId: connection._id,
            sender: senderUser,
        });
    }
    return connection;
});
const respondToRequest = (connectionId, userId, action) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connection_model_1.Connection.findById(connectionId);
    if (!connection) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection request not found');
    }
    if (String(connection.receiver) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the receiver can respond to this request');
    }
    if (connection.status !== 'PENDING') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This request is no longer pending');
    }
    // @ts-ignore
    const io = global.io;
    if (action === 'REJECT') {
        // Delete the connection
        yield connection_model_1.Connection.findByIdAndDelete(connectionId);
        if (io) {
            io.to(`user::${String(connection.sender)}`).emit('CONNECTION_REJECTED', {
                connectionId: connection._id,
            });
        }
        return null;
    }
    // Action is ACCEPT
    const participants = [String(connection.sender), String(connection.receiver)];
    // Create or get chat using ChatService
    const chat = yield chat_service_1.ChatService.createChatToDB(participants);
    connection.status = 'ACCEPTED';
    connection.chatId = chat._id;
    connection.respondedAt = new Date();
    yield connection.save();
    const receiverUser = yield user_model_1.User.findById(userId).select('name profileImage');
    // Notify sender
    yield (0, notificationsHelper_1.sendNotifications)({
        receiver: new mongoose_1.default.Types.ObjectId(String(connection.sender)),
        type: 'SYSTEM',
        title: 'Connection Accepted',
        text: `${receiverUser === null || receiverUser === void 0 ? void 0 : receiverUser.name} accepted your connection request`,
        resourceType: 'User',
        resourceId: userId,
        userId: String(connection.sender), // passed for push/socket helper compatibility
    });
    if (io) {
        io.to(`user::${String(connection.sender)}`).emit('CONNECTION_ACCEPTED', {
            connectionId: connection._id,
            chatId: chat._id,
            user: receiverUser,
        });
    }
    return connection;
});
const cancelRequest = (connectionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connection_model_1.Connection.findById(connectionId);
    if (!connection) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection request not found');
    }
    if (String(connection.sender) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the sender can cancel this request');
    }
    if (connection.status !== 'PENDING') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This request is no longer pending');
    }
    yield connection_model_1.Connection.findByIdAndDelete(connectionId);
    return null;
});
const removeConnection = (connectionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connection_model_1.Connection.findById(connectionId);
    if (!connection) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection not found');
    }
    if (String(connection.sender) !== userId && String(connection.receiver) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this connection');
    }
    // Mark chat as inactive
    if (connection.chatId) {
        yield chat_model_1.Chat.findByIdAndUpdate(connection.chatId, { status: false });
    }
    const otherUserId = String(connection.sender) === userId ? String(connection.receiver) : String(connection.sender);
    yield connection_model_1.Connection.findByIdAndDelete(connectionId);
    // @ts-ignore
    const io = global.io;
    if (io) {
        io.to(`user::${otherUserId}`).emit('CONNECTION_REMOVED', {
            connectionId: connection._id,
            chatId: connection.chatId,
        });
    }
    return null;
});
const getMyConnections = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const connectionQuery = new QueryBuilder_1.default(connection_model_1.Connection.find({
        $or: [{ sender: userId }, { receiver: userId }],
        status: 'ACCEPTED',
    }).populate([
        { path: 'sender', select: 'name profileImage role' },
        { path: 'receiver', select: 'name profileImage role' }
    ]), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield connectionQuery.modelQuery;
    const pagination = yield connectionQuery.getPaginationInfo();
    // Format data to expose "otherUser" instead of sender/receiver to make it easier for frontend
    const formattedData = data.map((conn) => {
        const isSender = String(conn.sender._id) === userId;
        return {
            _id: conn._id,
            status: conn.status,
            chatId: conn.chatId,
            respondedAt: conn.respondedAt,
            createdAt: conn.createdAt,
            user: isSender ? conn.receiver : conn.sender,
        };
    });
    return {
        data: formattedData,
        pagination,
    };
});
const getPendingRequests = (userId, type, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = type === 'sent' ? { sender: userId, status: 'PENDING' } : { receiver: userId, status: 'PENDING' };
    const populateField = type === 'sent' ? 'receiver' : 'sender';
    const connectionQuery = new QueryBuilder_1.default(connection_model_1.Connection.find(filter).populate({ path: populateField, select: 'name profileImage role' }), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield connectionQuery.modelQuery;
    const pagination = yield connectionQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const getConnectionStatus = (userId, otherUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connection_model_1.Connection.findOne({
        $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId },
        ],
    });
    if (!connection) {
        return { status: 'NONE' };
    }
    if (connection.status === 'ACCEPTED') {
        return {
            status: 'CONNECTED',
            connectionId: connection._id,
            chatId: connection.chatId
        };
    }
    if (connection.status === 'PENDING') {
        if (String(connection.sender) === userId) {
            return { status: 'PENDING_SENT', connectionId: connection._id };
        }
        else {
            return { status: 'PENDING_RECEIVED', connectionId: connection._id };
        }
    }
    return { status: 'NONE' };
});
exports.ConnectionService = {
    sendRequest,
    respondToRequest,
    cancelRequest,
    removeConnection,
    getMyConnections,
    getPendingRequests,
    getConnectionStatus,
};
