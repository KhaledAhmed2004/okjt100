import NodeCache from 'node-cache';
import { logger } from '../../shared/logger';

const ONLINE_SET = 'presence:online';
const LAST_ACTIVE_PREFIX = 'presence:lastActive:'; // presence:lastActive:<userId>
const USER_ROOMS_PREFIX = 'presence:userRooms:'; // presence:userRooms:<userId>
const CONN_COUNT_PREFIX = 'presence:connCount:'; // presence:connCount:<userId>

const memory = new NodeCache({ stdTTL: 0, checkperiod: 120, useClones: false });

const getSet = (key: string): Set<string> => {
  const existing = memory.get<string[]>(key);
  return new Set(existing || []);
};

const saveSet = (key: string, set: Set<string>) => {
  memory.set(key, Array.from(set));
};

export const setOnline = async (userId: string) => {
  const set = getSet(ONLINE_SET);
  set.add(userId);
  saveSet(ONLINE_SET, set);
  memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
  logger.info(`presence: setOnline -> ${userId}`);
};

export const setOffline = async (userId: string) => {
  const set = getSet(ONLINE_SET);
  set.delete(userId);
  saveSet(ONLINE_SET, set);
  memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
  logger.info(`presence: setOffline -> ${userId}`);
};

export const updateLastActive = async (userId: string) => {
  memory.set(LAST_ACTIVE_PREFIX + userId, Date.now());
};

export const isOnline = async (userId: string) => {
  const set = getSet(ONLINE_SET);
  return set.has(userId);
};

export const getLastActive = async (userId: string) => {
  const ts = memory.get<number>(LAST_ACTIVE_PREFIX + userId);
  return typeof ts === 'number' ? ts : undefined;
};

export const addUserRoom = async (userId: string, chatId: string) => {
  const key = USER_ROOMS_PREFIX + userId;
  const set = getSet(key);
  set.add(chatId);
  saveSet(key, set);
};

export const removeUserRoom = async (userId: string, chatId: string) => {
  const key = USER_ROOMS_PREFIX + userId;
  const set = getSet(key);
  set.delete(chatId);
  saveSet(key, set);
};

export const getUserRooms = async (userId: string) => {
  const key = USER_ROOMS_PREFIX + userId;
  return Array.from(getSet(key));
};

export const clearUserRooms = async (userId: string) => {
  const key = USER_ROOMS_PREFIX + userId;
  memory.del(key);
};

export const incrConnCount = async (userId: string) => {
  const key = CONN_COUNT_PREFIX + userId;
  const current = memory.get<number>(key) ?? 0;
  const next = current + 1;
  memory.set(key, next);
  return next;
};

export const decrConnCount = async (userId: string) => {
  const key = CONN_COUNT_PREFIX + userId;
  const current = memory.get<number>(key) ?? 0;
  const next = Math.max(0, current - 1);
  memory.set(key, next);
  return next;
};

export const getConnCount = async (userId: string) => {
  const key = CONN_COUNT_PREFIX + userId;
  const v = memory.get<number>(key) ?? 0;
  return v;
};