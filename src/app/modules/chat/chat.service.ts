import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { IMessage } from '../message/message.interface';
import { Message } from '../message/message.model';
import { User } from '../user/user.model';
import { IChat } from './chat.interface';
import { Chat } from './chat.model';
import { isOnline, getLastActive } from '../../helpers/presenceHelper';
import { getUnreadCountCached, setUnreadCount, batchGetUnreadCounts } from '../../helpers/unreadHelper';
import { errorLogger } from '../../../shared/logger';

const createOrGet = async (userId: string, otherUserId: string): Promise<IChat> => {
  // Validate both IDs as valid ObjectIds
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid otherUserId');
  }

  // Prevent self-chat
  if (userId === otherUserId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot create a chat with yourself');
  }

  // Verify otherUserId exists in the User collection
  const otherUserExists = await User.exists({ _id: otherUserId });
  if (!otherUserExists) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // Find existing chat or create a new one
  let chat = await Chat.findOne({
    participants: { $all: [userId, otherUserId] },
  });

  if (!chat) {
    chat = await Chat.create({ participants: [userId, otherUserId] });
  }

  return chat;
};

const createChatToDB = async (payload: any): Promise<IChat> => {
  let isExistChat: any = await Chat.findOne({
    participants: { $all: payload },
  });

  if (isExistChat) {
    if (!isExistChat.status) {
      isExistChat.status = true;
      await isExistChat.save();
    }
    return isExistChat;
  }
  const chat: any = await Chat.create({ participants: payload, status: true });
  return chat;
};

const getChatFromDB = async (user: any, searchTerm: string): Promise<IChat[]> => {
  const chats: any = await Chat.find({ participants: { $in: [user.id] } })
    .populate({
      path: 'participants',
      select: '_id name image role',
      match: {
        _id: { $ne: user.id },
        ...(searchTerm && { name: { $regex: searchTerm, $options: 'i' } }),
      },
    })
    .select('participants status updatedAt');

  // Filter out chats where no participants match the search (empty participants)
  const filteredChats = chats?.filter(
    (chat: any) => chat?.participants?.length > 0
  );

  //Use Promise.all to handle the asynchronous operations inside the map
  const chatList: IChat[] = await Promise.all(
    filteredChats?.map(async (chat: any) => {
      const data = chat?.toObject();

      const lastMessage: IMessage | null = await Message.findOne({
        chatId: chat?._id,
      })
        .sort({ createdAt: -1 })
        .select('text createdAt sender');

      // Compute unread count for current user with Redis cache fallback
      const cachedUnread = await getUnreadCountCached(String(chat?._id), String(user.id));
      let unreadCount: number;
      if (typeof cachedUnread === 'number') {
        unreadCount = cachedUnread;
      } else {
        unreadCount = await Message.countDocuments({
          chatId: chat?._id,
          sender: { $ne: user.id },
          readBy: { $ne: user.id },
        });
        // Cache the count for faster subsequent retrievals
        try {
          await setUnreadCount(String(chat?._id), String(user.id), unreadCount);
        } catch {}
      }

      // Presence of the other participant (first populated one)
      const other = data?.participants?.[0];
      let presence: { isOnline: boolean; lastActive?: number } | null = null;
      if (other?._id) {
        const online = await isOnline(String(other._id));
        let last = await getLastActive(String(other._id));
        if (last === undefined) {
          if (lastMessage?.createdAt) {
            last = new Date(String(lastMessage.createdAt)).getTime();
          } else if (data?.updatedAt) {
            last = new Date(String(data.updatedAt)).getTime();
          }
        }
        presence = { isOnline: online, lastActive: last };
      }

      return {
        ...data,
        lastMessage: lastMessage || null,
        unreadCount,
        presence,
      };
    })
  );

  return chatList;
};

const getList = async (userId: string, search?: string): Promise<any[]> => {
  // Validate userId as a valid ObjectId (throw 400 if invalid)
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }

  // Single Chat.find with explicit populate
  const chats = await Chat.find({ participants: userId })
    .populate('participants', '_id name image role')
    .lean();

  // Return empty array when no chats found
  if (!chats || chats.length === 0) {
    return [];
  }

  // Sort by lastMessage.createdAt descending; null lastMessage sorts last
  chats.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : -Infinity;
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : -Infinity;
    return bTime - aTime;
  });

  // Apply optional case-insensitive search filter on the other participant's name (in JS after populate)
  let filteredChats = chats;
  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filteredChats = chats.filter(chat => {
      const participants = chat.participants as any[];
      const other = participants.find(p => String(p._id) !== String(userId));
      return other && searchRegex.test(other.name ?? '');
    });
  }

  // Batch-fetch all unread counts via single Redis MGET
  const pairs = filteredChats.map(chat => ({
    chatId: String(chat._id),
    userId: String(userId),
  }));

  let unreadCounts: number[];
  try {
    unreadCounts = await batchGetUnreadCounts(pairs);
  } catch (err) {
    // Return 0 on any Redis error (log with errorLogger)
    errorLogger.error('getList: Redis batchGetUnreadCounts failed', err);
    unreadCounts = filteredChats.map(() => 0);
  }

  // Attach unreadCount to each chat
  return filteredChats.map((chat, index) => ({
    ...chat,
    unreadCount: unreadCounts[index] ?? 0,
  }));
};

export const ChatService = { createOrGet, createChatToDB, getChatFromDB, getList };
