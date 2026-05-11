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
exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const notificationsHelper_1 = require("./notificationsHelper");
const mongoose_1 = require("mongoose");
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const encodeCursor = (createdAt, id) => Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), _id: id.toString() })).toString('base64url');
const decodeCursor = (raw) => {
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        if (!(parsed === null || parsed === void 0 ? void 0 : parsed.createdAt) || !(parsed === null || parsed === void 0 ? void 0 : parsed._id))
            throw new Error('shape');
        return parsed;
    }
    catch (_a) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor');
    }
};
const listForUser = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const baseMatch = {
        userId: new mongoose_1.Types.ObjectId(userId),
        deletedAt: null,
    };
    const listMatch = Object.assign({}, baseMatch);
    if (query.unread === 'true')
        listMatch.isRead = false;
    if (query.cursor) {
        const c = decodeCursor(query.cursor);
        const cursorDate = new Date(c.createdAt);
        listMatch.$or = [
            { createdAt: { $lt: cursorDate } },
            {
                createdAt: cursorDate,
                _id: { $lt: new mongoose_1.Types.ObjectId(c._id) },
            },
        ];
    }
    // Fetch limit + 1 to detect hasMore without a count query.
    const rows = yield notification_model_1.NotificationModel.find(listMatch)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last
        ? encodeCursor(last.createdAt, last._id)
        : null;
    const unreadCount = yield notification_model_1.NotificationModel.countDocuments(Object.assign(Object.assign({}, baseMatch), { isRead: false }));
    return {
        data: page,
        meta: { limit, nextCursor, hasMore, unreadCount },
    };
});
const markAllRead = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.NotificationModel.updateMany({ userId: new mongoose_1.Types.ObjectId(userId), isRead: false, deletedAt: null }, { $set: { isRead: true, readAt: new Date() } });
    return { updated: result.modifiedCount };
});
const markRead = (id_1, userId_1, ...args_1) => __awaiter(void 0, [id_1, userId_1, ...args_1], void 0, function* (id, userId, read = true) {
    var _a;
    const doc = yield notification_model_1.NotificationModel.findById(id);
    if (!doc || doc.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Notification not found');
    }
    if (((_a = doc.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not allowed');
    }
    doc.isRead = read;
    doc.readAt = read ? new Date() : null;
    yield doc.save();
    return { _id: doc._id, isRead: doc.isRead, readAt: doc.readAt };
});
const deleteById = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const doc = yield notification_model_1.NotificationModel.findById(id);
    if (!doc)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Notification not found');
    if (((_a = doc.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not allowed');
    }
    // Idempotent: re-deleting an already soft-deleted row is a no-op success.
    if (!doc.deletedAt) {
        doc.deletedAt = new Date();
        yield doc.save();
    }
    return null;
});
const createForPreferenceCard = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const subtitle = params.surgeonName && params.procedure
        ? `${params.surgeonName} — ${params.procedure}`
        : params.cardTitle;
    return (0, notificationsHelper_1.sendNotifications)({
        userId: new mongoose_1.Types.ObjectId(params.userId),
        type: 'PREFERENCE_CARD_CREATED',
        title: 'New Card Added',
        subtitle,
        link: { label: 'View Card', url: `/cards/${params.cardId}` },
        resourceType: 'PreferenceCard',
        resourceId: params.cardId,
        isRead: false,
        icon: 'card',
    });
});
const createForEventScheduled = (params) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, notificationsHelper_1.sendNotifications)({
        userId: new mongoose_1.Types.ObjectId(params.userId),
        type: 'EVENT_SCHEDULED',
        title: 'Event Scheduled',
        subtitle: `${params.title}${params.whenText ? ' on ' + params.whenText : ''}`,
        link: { label: 'View Event', url: `/events/${params.eventId}` },
        resourceType: 'Event',
        resourceId: params.eventId,
        isRead: false,
        icon: 'calendar',
    });
});
exports.NotificationService = {
    listForUser,
    markAllRead,
    markRead,
    deleteById,
    createForPreferenceCard,
    createForEventScheduled,
};
