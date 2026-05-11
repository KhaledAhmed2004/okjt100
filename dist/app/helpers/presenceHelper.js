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
exports.getConnCount = exports.decrConnCount = exports.incrConnCount = exports.clearUserRooms = exports.getUserRooms = exports.removeUserRoom = exports.addUserRoom = exports.getLastActive = exports.isOnline = exports.updateLastActive = exports.setOffline = exports.setOnline = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
const ONLINE_SET = 'presence:online';
const LAST_ACTIVE_PREFIX = 'presence:lastActive:'; // presence:lastActive:<userId>
const USER_ROOMS_PREFIX = 'presence:userRooms:'; // presence:userRooms:<userId>
const CONN_COUNT_PREFIX = 'presence:connCount:'; // presence:connCount:<userId>
const memory = new node_cache_1.default({ stdTTL: 0, checkperiod: 120, useClones: false });
const getSet = (key) => {
    const existing = memory.get(key);
    return new Set(existing || []);
};
const saveSet = (key, set) => {
    memory.set(key, Array.from(set));
};
const setOnline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const set = getSet(ONLINE_SET);
    set.add(userId);
    saveSet(ONLINE_SET, set);
    memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
    logger_1.logger.info(`presence: setOnline -> ${userId}`);
});
exports.setOnline = setOnline;
const setOffline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const set = getSet(ONLINE_SET);
    set.delete(userId);
    saveSet(ONLINE_SET, set);
    memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
    logger_1.logger.info(`presence: setOffline -> ${userId}`);
});
exports.setOffline = setOffline;
const updateLastActive = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
});
exports.updateLastActive = updateLastActive;
const isOnline = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const set = getSet(ONLINE_SET);
    return set.has(userId);
});
exports.isOnline = isOnline;
const getLastActive = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const ts = memory.get(LAST_ACTIVE_PREFIX + userId);
    return typeof ts === 'number' ? ts : undefined;
});
exports.getLastActive = getLastActive;
const addUserRoom = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = USER_ROOMS_PREFIX + userId;
    const set = getSet(key);
    set.add(chatId);
    saveSet(key, set);
});
exports.addUserRoom = addUserRoom;
const removeUserRoom = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = USER_ROOMS_PREFIX + userId;
    const set = getSet(key);
    set.delete(chatId);
    saveSet(key, set);
});
exports.removeUserRoom = removeUserRoom;
const getUserRooms = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = USER_ROOMS_PREFIX + userId;
    return Array.from(getSet(key));
});
exports.getUserRooms = getUserRooms;
const clearUserRooms = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = USER_ROOMS_PREFIX + userId;
    memory.del(key);
});
exports.clearUserRooms = clearUserRooms;
const incrConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const key = CONN_COUNT_PREFIX + userId;
    const current = (_a = memory.get(key)) !== null && _a !== void 0 ? _a : 0;
    const next = current + 1;
    memory.set(key, next);
    return next;
});
exports.incrConnCount = incrConnCount;
const decrConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const key = CONN_COUNT_PREFIX + userId;
    const current = (_a = memory.get(key)) !== null && _a !== void 0 ? _a : 0;
    const next = Math.max(0, current - 1);
    memory.set(key, next);
    return next;
});
exports.decrConnCount = decrConnCount;
const getConnCount = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const key = CONN_COUNT_PREFIX + userId;
    const v = (_a = memory.get(key)) !== null && _a !== void 0 ? _a : 0;
    return v;
});
exports.getConnCount = getConnCount;
