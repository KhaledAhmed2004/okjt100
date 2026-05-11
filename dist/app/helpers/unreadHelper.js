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
exports.UnreadHelper = exports.clearUnreadCount = exports.incrementUnreadCount = exports.setUnreadCount = exports.getUnreadCountCached = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const memory = new node_cache_1.default({ stdTTL: 0, checkperiod: 120, useClones: false });
const CHAT_UNREAD_PREFIX = 'chat:unread_count:'; // chat:unread_count:<chatId>
const chatKey = (chatId) => `${CHAT_UNREAD_PREFIX}${String(chatId)}`;
const getUnreadCountCached = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = chatKey(chatId);
    const map = memory.get(key);
    if (!map)
        return null;
    const v = map[String(userId)];
    if (v === undefined)
        return null;
    return Number.isFinite(v) ? v : 0;
});
exports.getUnreadCountCached = getUnreadCountCached;
const setUnreadCount = (chatId, userId, count) => __awaiter(void 0, void 0, void 0, function* () {
    const key = chatKey(chatId);
    const map = memory.get(key) || {};
    map[String(userId)] = count;
    memory.set(key, map);
});
exports.setUnreadCount = setUnreadCount;
const incrementUnreadCount = (chatId, userId, delta) => __awaiter(void 0, void 0, void 0, function* () {
    const key = chatKey(chatId);
    const map = memory.get(key) || {};
    const current = map[String(userId)] || 0;
    const next = current + delta;
    map[String(userId)] = next;
    memory.set(key, map);
    return next;
});
exports.incrementUnreadCount = incrementUnreadCount;
const clearUnreadCount = (chatId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = chatKey(chatId);
    const map = memory.get(key) || {};
    delete map[String(userId)];
    memory.set(key, map);
});
exports.clearUnreadCount = clearUnreadCount;
exports.UnreadHelper = {
    getUnreadCountCached: exports.getUnreadCountCached,
    setUnreadCount: exports.setUnreadCount,
    incrementUnreadCount: exports.incrementUnreadCount,
    clearUnreadCount: exports.clearUnreadCount,
};
