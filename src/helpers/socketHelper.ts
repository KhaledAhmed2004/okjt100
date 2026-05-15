import colors from 'colors';
import { Server } from 'socket.io';
import { errorLogger, logger } from '../shared/logger';
import { jwtHelper } from './jwtHelper';
import config from '../config';
import { redisClient } from '../shared/redisClient';
// Optional chat/message modules: fall back to stubs when absent
let Message: any;
let Chat: any;
try {
  ({ Message } = require('../app/modules/message/message.model'));
} catch {
  Message = {
    find: async () => [],
    updateMany: async () => {},
    findById: async () => ({ select: () => null }),
    findByIdAndUpdate: async () => null,
  };
}
try {
  ({ Chat } = require('../app/modules/chat/chat.model'));
} catch {
  Chat = {
    exists: async () => false,
  };
}
let SupportTicket: any;
try {
  ({ SupportTicket } = require('../app/modules/support-ticket/support-ticket.model'));
} catch {
  SupportTicket = {
    findById: async () => null,
  };
}
import NodeCache from 'node-cache';
import {
  setOnline,
  setOffline,
  addUserRoom,
  removeUserRoom,
  updateLastActive,
  getUserRooms,
  getLastActive,
  incrConnCount,
  decrConnCount,
  clearUserRooms,
} from '../app/helpers/presenceHelper';

// -------------------------
// 🔹 Room Name Generators
// -------------------------
// USER_ROOM: unique private room for each user (for personal notifications)
// CHAT_ROOM: group room for each chat conversation
const USER_ROOM = (userId: string) => `user::${userId}`;
const CHAT_ROOM = (chatId: string) => `chat::${chatId}`;
const TICKET_ROOM = (ticketId: string) => `ticket::${ticketId}`;
const ADMIN_TICKETS_ROOM = 'admin-tickets';
const TYPING_KEY = (chatId: string, userId: string) => `typing:${chatId}:${userId}`;
const TYPING_TTL_SECONDS = 5; // throttle window
const typingThrottle = new NodeCache({ stdTTL: TYPING_TTL_SECONDS, checkperiod: 10, useClones: false });

// -------------------------
// 🔹 Main Socket Handler
// -------------------------
const socket = (io: Server) => {
  io.on('connection', async socket => {
    try {
      // -----------------------------
      // 🧩 STEP 1 — Authenticate Socket
      // -----------------------------
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;

      if (!token || typeof token !== 'string') {
        logger.warn(
          colors.yellow('Socket connection without token. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      let payload: any;
      try {
        payload = jwtHelper.verifyToken(token, config.jwt.jwt_secret as any);
      } catch (err) {
        logger.warn(
          colors.red('Invalid JWT on socket connection. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      const userId = payload?.id as string;
      if (!userId) {
        logger.warn(colors.red('JWT payload missing id. Disconnecting.'));
        return socket.disconnect(true);
      }

      // -----------------------------
      // 🧩 STEP 2 — Mark Online & Join Personal Room
      // -----------------------------
      await setOnline(userId);
      await incrConnCount(userId);
      await updateLastActive(userId);
      socket.join(USER_ROOM(userId)); // join user’s personal private room
      logger.info(
        colors.blue(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`)
      );
      logEvent('socket_connected', `for user_id: ${userId}`);

      // Admins auto-join the global support-ticket broadcast room so they
      // receive TICKET_CREATED/TICKET_REPLY events without needing to
      // subscribe per-ticket. Per-ticket rooms (ticket::{id}) are still
      // joined on demand via JOIN_TICKET for the detail view.
      const role = (payload as any)?.role as string | undefined;
      if (role === 'SUPER_ADMIN') {
        socket.join(ADMIN_TICKETS_ROOM);
      }

      // -----------------------------
      // 🔹 Helper Function: Simplify repetitive event logging & activity update
      // -----------------------------
      const handleEventProcessed = (event: string, extra?: string) => {
        updateLastActive(userId).catch(() => {});
        logEvent(event, extra);
      };

      // ---------------------------------------------
      // 🔹 Chat Room Join / Leave Events
      // ---------------------------------------------
      socket.on('JOIN_CHAT', async ({ chatId }: { chatId: string }) => {
        // Requirement 8.2: ignore event if chatId is absent or empty string
        if (!chatId) return;

        // Write active:{userId}:chat = chatId with 3600-second TTL (Requirement 8.1)
        try {
          await redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
        } catch (err) {
          errorLogger.error(
            colors.red(`JOIN_CHAT: failed to write active-chat key for user ${userId}: ${String(err)}`)
          );
        }

        // Join the socket room for this chat
        socket.join(CHAT_ROOM(chatId));
        await addUserRoom(userId, chatId);
        handleEventProcessed('JOIN_CHAT', `for chat_id: ${chatId}`);

        // Broadcast to others in the chat that this user is now online
        const lastActive = await getLastActive(userId);
        io.to(CHAT_ROOM(chatId)).emit('USER_ONLINE', {
          userId,
          chatId,
          lastActive,
        });
        logger.info(
          colors.green(`User ${userId} joined chat room ${CHAT_ROOM(chatId)}`)
        );
      });

      socket.on('LEAVE_CHAT', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;

        // Delete active:{userId}:chat from Redis (Requirement 8.3)
        try {
          await redisClient.del(`active:${userId}:chat`);
        } catch (err) {
          errorLogger.error(
            colors.red(`LEAVE_CHAT: failed to delete active-chat key for user ${userId}: ${String(err)}`)
          );
        }

        socket.leave(CHAT_ROOM(chatId));
        await removeUserRoom(userId, chatId);
        handleEventProcessed('LEAVE_CHAT', `for chat_id: ${chatId}`);

        // Notify others that user went offline in this chat
        const lastActive = await getLastActive(userId);
        io.to(CHAT_ROOM(chatId)).emit('USER_OFFLINE', {
          userId,
          chatId,
          lastActive,
        });
        logger.info(
          colors.yellow(`User ${userId} left chat room ${CHAT_ROOM(chatId)}`)
        );
      });

      // ---------------------------------------------
      // 🔹 Support Ticket Room Join / Leave Events
      // ---------------------------------------------
      socket.on('JOIN_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        try {
          const ticket = await SupportTicket.findById(ticketId).select(
            '_id userId'
          );
          if (!ticket) {
            socket.emit('ACK_ERROR', {
              message: 'Ticket not found',
              ticketId: String(ticketId),
            });
            handleEventProcessed(
              'JOIN_TICKET_DENIED',
              `not_found ticket_id: ${ticketId}`
            );
            return;
          }
          const isAdmin = role === 'SUPER_ADMIN';
          const isOwner = String(ticket.userId) === String(userId);
          if (!isAdmin && !isOwner) {
            socket.emit('ACK_ERROR', {
              message: 'You do not have access to this ticket',
              ticketId: String(ticketId),
            });
            handleEventProcessed(
              'JOIN_TICKET_DENIED',
              `forbidden ticket_id: ${ticketId}`
            );
            return;
          }
          socket.join(TICKET_ROOM(String(ticketId)));
          handleEventProcessed('JOIN_TICKET', `for ticket_id: ${ticketId}`);
        } catch (err) {
          logger.error(colors.red(`JOIN_TICKET error: ${String(err)}`));
        }
      });

      socket.on('LEAVE_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        socket.leave(TICKET_ROOM(String(ticketId)));
        handleEventProcessed('LEAVE_TICKET', `for ticket_id: ${ticketId}`);
      });

      // ---------------------------------------------
      // 🔹 Typing Indicators
      // ---------------------------------------------
      socket.on('TYPING_START', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;
        // Guard: Only participants can emit typing events for a chat
        const allowed = await Chat.exists({ _id: chatId, participants: userId });
        if (!allowed) {
          handleEventProcessed('TYPING_START_DENIED', `for chat_id: ${chatId}`);
          return;
        }

        // Throttle typing events per user per chat using in-memory TTL key
        {
          const key = TYPING_KEY(chatId, userId);
          if (typingThrottle.has(key)) {
            handleEventProcessed('TYPING_START_THROTTLED_SKIP', `for chat_id: ${chatId}`);
            return;
          }
          typingThrottle.set(key, 1, TYPING_TTL_SECONDS);
        }

        io.to(CHAT_ROOM(chatId)).emit('TYPING_START', { userId, chatId });
        handleEventProcessed('TYPING_START', `for chat_id: ${chatId}`);
      });

      socket.on('TYPING_STOP', async ({ chatId }: { chatId: string }) => {
        if (!chatId) return;
        // Guard: Only participants can emit typing stop events
        const allowed = await Chat.exists({ _id: chatId, participants: userId });
        if (!allowed) {
          handleEventProcessed('TYPING_STOP_DENIED', `for chat_id: ${chatId}`);
          return;
        }
        // Clear throttle key so next start can emit immediately
        typingThrottle.del(TYPING_KEY(chatId, userId));

        io.to(CHAT_ROOM(chatId)).emit('TYPING_STOP', { userId, chatId });
        handleEventProcessed('TYPING_STOP', `for chat_id: ${chatId}`);
      });

      // ---------------------------------------------
      // 🔹 Message Delivery & Read Acknowledgements
      // ---------------------------------------------
      socket.on(
        'DELIVERED_ACK',
        async ({ messageId }: { messageId: string }) => {
          try {
            const found = await Message.findById(messageId).select('_id chatId');
            if (!found) {
              socket.emit('ACK_ERROR', {
                message: 'Message not found',
                messageId,
              });
              return;
            }

            const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
            if (!allowed) {
              socket.emit('ACK_ERROR', {
                message: 'You are not a participant of this chat',
                chatId: String(found.chatId),
                messageId: String(found._id),
              });
              handleEventProcessed('DELIVERED_ACK_DENIED', `chat_id: ${String(found.chatId)}`);
              return;
            }

            const msg = await Message.findByIdAndUpdate(
              messageId,
              { $addToSet: { deliveredTo: userId } },
              { new: true }
            );
            if (msg) {
              io.to(CHAT_ROOM(String(msg.chatId))).emit('MESSAGE_DELIVERED', {
                messageId: String(msg._id),
                chatId: String(msg.chatId),
                userId,
              });
              handleEventProcessed(
                'DELIVERED_ACK',
                `for message_id: ${String(msg._id)}`
              );
            }
          } catch (err) {
            logger.error(colors.red(`❌ DELIVERED_ACK error: ${String(err)}`));
          }
        }
      );

      socket.on('READ_ACK', async ({ messageId }: { messageId: string }) => {
        try {
          const found = await Message.findById(messageId).select('_id chatId');
          if (!found) {
            socket.emit('ACK_ERROR', {
              message: 'Message not found',
              messageId,
            });
            return;
          }

          const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
          if (!allowed) {
            socket.emit('ACK_ERROR', {
              message: 'You are not a participant of this chat',
              chatId: String(found.chatId),
              messageId: String(found._id),
            });
            handleEventProcessed('READ_ACK_DENIED', `chat_id: ${String(found.chatId)}`);
            return;
          }

          const msg = await Message.findByIdAndUpdate(
            messageId,
            { $addToSet: { readBy: userId } },
            { new: true }
          );
          if (msg) {
            io.to(CHAT_ROOM(String(msg.chatId))).emit('MESSAGE_READ', {
              messageId: String(msg._id),
              chatId: String(msg.chatId),
              userId,
            });
            handleEventProcessed(
              'READ_ACK',
              `for message_id: ${String(msg._id)}`
            );
          }
        } catch (err) {
          logger.error(colors.red(`❌ READ_ACK error: ${String(err)}`));
        }
      });

      // ---------------------------------------------
      // 🔹 Handle Disconnect Event
      // ---------------------------------------------
      socket.on('disconnect', async () => {
        try {
          await updateLastActive(userId);
          const remaining = await decrConnCount(userId);
          const lastActive = await getLastActive(userId);

          // Delete active:{userId}:chat from Redis on disconnect (Requirement 8.4)
          try {
            await redisClient.del(`active:${userId}:chat`);
          } catch (err) {
            errorLogger.error(
              colors.red(`disconnect: failed to delete active-chat key for user ${userId}: ${String(err)}`)
            );
          }

          // Only mark offline and broadcast if no other sessions remain
          if (!remaining || remaining <= 0) {
            await setOffline(userId);

            // Notify all chat rooms this user participated in
            try {
              const rooms = await getUserRooms(userId);
              for (const chatId of rooms || []) {
                io.to(CHAT_ROOM(String(chatId))).emit('USER_OFFLINE', {
                  userId,
                  chatId: String(chatId),
                  lastActive,
                });
              }
              await clearUserRooms(userId);
            } catch {}
          } else {
            logger.info(colors.yellow(`User ${userId} disconnected one session; ${remaining} session(s) remain.`));
          }

          logger.info(colors.red(`User ${userId} disconnected`));
          logEvent('socket_disconnected', `for user_id: ${userId}`);
        } catch (err) {
          logger.error(
            colors.red(`❌ Disconnect handling error: ${String(err)}`)
          );
        }
      });
    } catch (err) {
      logger.error(colors.red(`Socket connection error: ${String(err)}`));
      try {
        socket.disconnect(true);
      } catch {}
    }
  });
};

// -------------------------
// 🔹 Helper: Log formatter
// -------------------------
const logEvent = (event: string, extra?: string) => {
  logger.info(`🔔 Event processed: ${event} ${extra || ''}`);
};

export const socketHelper = { socket };
