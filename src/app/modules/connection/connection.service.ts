import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Connection } from './connection.model';
import { ChatService } from '../chat/chat.service';
import { Chat } from '../chat/chat.model';
import { USER_STATUS } from '../../../enums/user';
import QueryBuilder from '../../builder/QueryBuilder';
import { IConnection } from './connection.interface';
import { sendNotifications } from '../notification/notificationsHelper';

const sendRequest = async (senderId: string, receiverId: string) => {
  if (senderId === receiverId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot connect with yourself');
  }

  const receiver = await User.findById(receiverId);
  if (!receiver || receiver.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receiver not found or inactive');
  }

  // Check if connection already exists (either direction)
  const existingConnection = await Connection.findOne({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId },
    ],
  });

  if (existingConnection) {
    throw new ApiError(StatusCodes.CONFLICT, 'Connection request already exists');
  }

  const connection = await Connection.create({
    sender: senderId,
    receiver: receiverId,
    status: 'PENDING',
  });

  const senderUser = await User.findById(senderId).select('name profileImage');

  // Send in-app notification & push/socket
  await sendNotifications({
    receiver: new mongoose.Types.ObjectId(receiverId),
    type: 'SYSTEM',
    title: 'New Connection Request',
    text: `${senderUser?.name} wants to connect`,
    resourceType: 'User',
    resourceId: senderId,
    userId: receiverId, // passed for push/socket helper compatibility
  } as any);

  // @ts-ignore
  const io = global.io;
  if (io) {
    io.to(`user::${receiverId}`).emit('CONNECTION_REQUEST', {
      connectionId: connection._id,
      sender: senderUser,
    });
  }

  return connection;
};

const respondToRequest = async (connectionId: string, userId: string, action: 'ACCEPT' | 'REJECT') => {
  const connection = await Connection.findById(connectionId);
  
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found');
  }

  if (String(connection.receiver) !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the receiver can respond to this request');
  }

  if (connection.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This request is no longer pending');
  }

  // @ts-ignore
  const io = global.io;

  if (action === 'REJECT') {
    // Delete the connection
    await Connection.findByIdAndDelete(connectionId);
    
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
  const chat = await ChatService.createOrGet(participants[0], participants[1]);

  connection.status = 'ACCEPTED';
  connection.chatId = (chat as any)._id;
  connection.respondedAt = new Date();
  await connection.save();

  const receiverUser = await User.findById(userId).select('name profileImage');

  // Notify sender
  await sendNotifications({
    receiver: new mongoose.Types.ObjectId(String(connection.sender)),
    type: 'SYSTEM',
    title: 'Connection Accepted',
    text: `${receiverUser?.name} accepted your connection request`,
    resourceType: 'User',
    resourceId: userId,
    userId: String(connection.sender), // passed for push/socket helper compatibility
  } as any);

  if (io) {
    io.to(`user::${String(connection.sender)}`).emit('CONNECTION_ACCEPTED', {
      connectionId: connection._id,
      chatId: (chat as any)._id,
      user: receiverUser,
    });
  }

  return connection;
};

const cancelRequest = async (connectionId: string, userId: string) => {
  const connection = await Connection.findById(connectionId);
  
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found');
  }

  if (String(connection.sender) !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the sender can cancel this request');
  }

  if (connection.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This request is no longer pending');
  }

  await Connection.findByIdAndDelete(connectionId);
  return null;
};

const removeConnection = async (connectionId: string, userId: string) => {
  const connection = await Connection.findById(connectionId);
  
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection not found');
  }

  if (String(connection.sender) !== userId && String(connection.receiver) !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this connection');
  }

  // Mark chat as inactive
  if (connection.chatId) {
    await Chat.findByIdAndUpdate(connection.chatId, { status: false });
  }

  const otherUserId = String(connection.sender) === userId ? String(connection.receiver) : String(connection.sender);
  
  await Connection.findByIdAndDelete(connectionId);

  // @ts-ignore
  const io = global.io;
  if (io) {
    io.to(`user::${otherUserId}`).emit('CONNECTION_REMOVED', {
      connectionId: connection._id,
      chatId: connection.chatId,
    });
  }

  return null;
};

const getMyConnections = async (userId: string, query: Record<string, unknown>) => {
  const connectionQuery = new QueryBuilder<IConnection>(
    Connection.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'ACCEPTED',
    }).populate([
      { path: 'sender', select: 'name profileImage role' },
      { path: 'receiver', select: 'name profileImage role' }
    ]),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await connectionQuery.modelQuery;
  const pagination = await connectionQuery.getPaginationInfo();

  // Format data to expose "otherUser" instead of sender/receiver to make it easier for frontend
  const formattedData = data.map((conn: any) => {
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
};

const getPendingRequests = async (userId: string, type: 'sent' | 'received', query: Record<string, unknown>) => {
  const filter = type === 'sent' ? { sender: userId, status: 'PENDING' } : { receiver: userId, status: 'PENDING' };
  const populateField = type === 'sent' ? 'receiver' : 'sender';

  const connectionQuery = new QueryBuilder<IConnection>(
    Connection.find(filter).populate({ path: populateField, select: 'name profileImage role' }),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await connectionQuery.modelQuery;
  const pagination = await connectionQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const getConnectionStatus = async (userId: string, otherUserId: string) => {
  const connection = await Connection.findOne({
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
    } else {
      return { status: 'PENDING_RECEIVED', connectionId: connection._id };
    }
  }

  return { status: 'NONE' };
};

export const ConnectionService = {
  sendRequest,
  respondToRequest,
  cancelRequest,
  removeConnection,
  getMyConnections,
  getPendingRequests,
  getConnectionStatus,
};
