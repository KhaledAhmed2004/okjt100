import { StatusCodes } from 'http-status-codes';
import { generateConnectionKey } from './connection.utils';
import { CONNECTION_STATUS, CONNECTION_ACTION } from './connection.constants';
import config from '../../../config';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Connection } from './connection.model';
import { ChatService } from '../chat/chat.service';
import { USER_STATUS } from '../../../enums/user';
import QueryBuilder from '../../builder/QueryBuilder';
import { IConnection, ConnectionAction } from './connection.interface';
import { sendNotifications } from '../notification/notificationsHelper';

const sendConnectionRequest = async (senderId: string, receiverId: string) => {
  if (senderId === receiverId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot connect with yourself');
  }

  const sender = await User.findById(senderId);
  if (!sender || sender.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Sender not found or inactive');
  }

  const receiver = await User.findById(receiverId);
  if (!receiver || receiver.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receiver not found or inactive');
  }

  if (sender.role !== receiver.role) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `A ${sender.role.toLowerCase()} can only connect with another ${sender.role.toLowerCase()}`
    );
  }

  // Check pending limit to prevent spam
  const pendingCount = await Connection.countDocuments({ sender: senderId, status: CONNECTION_STATUS.PENDING });
  const maxRequests = config.connection.max_pending_requests;
  if (pendingCount >= maxRequests) {
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, `You have reached the maximum number of pending requests (${maxRequests})`);
  }

  // Generate deterministic connectionKey to prevent A->B and B->A race condition
  const connectionKey = generateConnectionKey(senderId, receiverId);

  // Check if connection already exists (either direction) using connectionKey
  const existingConnection = await Connection.findOne({ connectionKey });

  if (existingConnection) {
    if (existingConnection.status === CONNECTION_STATUS.ACCEPTED) {
      throw new ApiError(StatusCodes.CONFLICT, 'You are already connected with this user');
    }
    throw new ApiError(StatusCodes.CONFLICT, 'Connection request already exists');
  }

  const connection = await Connection.create({
    sender: senderId,
    receiver: receiverId,
    connectionKey,
    status: CONNECTION_STATUS.PENDING,
  });

  const senderUser = sender;

  // Send in-app notification & push/socket
  await sendNotifications({
    receiver: new mongoose.Types.ObjectId(receiverId),
    type: 'CONNECTION_REQUEST',
    title: 'New Connection Request',
    text: `${senderUser.name} wants to connect`,
    resourceType: 'User',
    resourceId: senderId,
    schemaVersion: 1,
    metadata: {
      actor: {
        id: senderUser._id.toString(),
        name: senderUser.name,
        profileImage: senderUser.profileImage,
      },
      subject: {
        type: 'Connection',
        id: connection._id.toString(),
      },
      actions: [
        { type: 'ACCEPT' },
        { type: 'REJECT' },
        { type: 'VIEW_PROFILE' },
      ],
    },
  } as any);

  // @ts-ignore
  const io = global.io;
  if (io) {
    io.to(`user::${receiverId}`).emit('CONNECTION_REQUEST', {
      connectionId: connection._id,
      sender: senderUser,
    });
  }

  return {
    id: connection._id,
    status: connection.status,
    receiver: {
      id: receiver._id,
      name: receiver.name,
      profileImage: receiver.profileImage,
    },
  };
};

const respondToConnectionRequest = async (connectionId: string, userId: string, action: ConnectionAction) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const connection = await Connection.findById(connectionId).session(session);

    if (!connection) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found');
    }

    if (String(connection.receiver) !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only the receiver can respond to this request');
    }

    if (connection.status !== CONNECTION_STATUS.PENDING) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'This request is no longer pending');
    }

    // @ts-ignore
    const io = global.io;

    if (action === CONNECTION_ACTION.REJECTED) {
      // Delete the connection
      await Connection.findByIdAndDelete(connectionId).session(session);
      await session.commitTransaction();

      if (io) {
        io.to(`user::${String(connection.sender)}`).emit('CONNECTION_REJECTED', {
          connectionId: connection._id,
        });
      }

      // Return the processed id with a 'NONE' status so the client can
      // immediately update its local cache without a second request.
      return { id: connection._id, status: 'NONE' as const };
    }

    // Action is ACCEPT
    const participants = [String(connection.sender), String(connection.receiver)];

    // Create or get chat using ChatService
    const chat = await ChatService.createOrGet(participants[0], participants[1]);

    connection.status = CONNECTION_STATUS.ACCEPTED;
    connection.chatId = (chat as any)._id;
    connection.respondedAt = new Date();
    await connection.save({ session });

    await session.commitTransaction();

    const receiverUser = await User.findById(userId).select('name profileImage');

    // Notify sender
    await sendNotifications({
      receiver: new mongoose.Types.ObjectId(String(connection.sender)),
      type: 'CONNECTION_ACCEPTED',
      title: 'Connection Accepted',
      text: `${receiverUser?.name} accepted your connection request`,
      resourceType: 'User',
      resourceId: userId,
      schemaVersion: 1,
      metadata: {
        actor: {
          id: receiverUser?._id.toString(),
          name: receiverUser?.name,
          profileImage: receiverUser?.profileImage,
        },
        subject: {
          type: 'Connection',
          id: connectionId,
          chatId: (chat as any)._id.toString(),
        },
        actions: [
          { type: 'OPEN_CHAT' },
          { type: 'VIEW_PROFILE' },
        ],
      },
    } as any);

    if (io) {
      io.to(`user::${String(connection.sender)}`).emit('CONNECTION_ACCEPTED', {
        connectionId: connection._id,
        chatId: (chat as any)._id,
        user: receiverUser,
      });
    }

    return {
      id: connection._id,
      status: connection.status,
      chatId: connection.chatId,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelConnectionRequest = async (connectionId: string, userId: string) => {
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found');
  }

  if (String(connection.sender) !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the sender can cancel this request');
  }

  if (connection.status !== CONNECTION_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This request is no longer pending');
  }

  await Connection.findByIdAndDelete(connectionId);

  // Return the processed id with a 'NONE' status so the client can
  // immediately update its local cache without a second request.
  return { id: connection._id, status: 'NONE' as const };
};

const removeConnection = async (connectionId: string, userId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const connection = await Connection.findById(connectionId).session(session);

    if (!connection) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Connection not found');
    }

    if (String(connection.sender) !== userId && String(connection.receiver) !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this connection');
    }

    if (connection.status !== CONNECTION_STATUS.ACCEPTED) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'You can only remove an accepted connection');
    }

    const otherUserId = String(connection.sender) === userId ? String(connection.receiver) : String(connection.sender);

    await Connection.findByIdAndDelete(connectionId).session(session);

    await session.commitTransaction();

    // @ts-ignore
    const io = global.io;
    if (io) {
      io.to(`user::${otherUserId}`).emit('CONNECTION_REMOVED', {
        connectionId: connection._id,
        chatId: connection.chatId,
      });
    }

    // Return the processed id with a 'NONE' status so the client can
    // immediately update its local cache without a second request.
    return { id: connection._id, status: 'NONE' as const };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getMyConnections = async (userId: string, query: Record<string, unknown>) => {
  const connectionQuery = new QueryBuilder<IConnection>(
    Connection.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: CONNECTION_STATUS.ACCEPTED,
    }).populate([
      { path: 'sender', select: 'name profileImage' },
      { path: 'receiver', select: 'name profileImage' }
    ]),
    query
  )
    .filter()
    .sort()
    .fields();

  const { data, meta } = await connectionQuery.cursorPaginate('_id');

  // Format data to expose "connectedUser" instead of sender/receiver to make it easier for frontend
  const formattedData = data.map((conn: any) => {
    const isSender = String(conn.sender._id) === userId;
    return {
      _id: conn._id,
      status: conn.status,
      chatId: conn.chatId,
      createdAt: conn.createdAt,
      connectedUser: isSender ? {
        id: conn.receiver._id,
        name: conn.receiver.name,
        profileImage: conn.receiver.profileImage,
      } : {
        id: conn.sender._id,
        name: conn.sender.name,
        profileImage: conn.sender.profileImage,
      },
    };
  });

  return {
    data: formattedData,
    pagination: meta,
  };
};

const getPendingConnectionRequests = async (userId: string, direction: 'sent' | 'received', query: Record<string, unknown>) => {
  const filter = direction === 'sent' ? { sender: userId, status: CONNECTION_STATUS.PENDING } : { receiver: userId, status: CONNECTION_STATUS.PENDING };
  const populateField = direction === 'sent' ? 'receiver' : 'sender';

  const connectionQuery = new QueryBuilder<IConnection>(
    Connection.find(filter).populate({ path: populateField, select: 'name profileImage role' }),
    query
  )
    .filter()
    .sort()
    .fields();

  const { data, meta } = await connectionQuery.cursorPaginate('_id');

  const formattedData = data.map((conn: any) => {
    if (direction === 'sent') {
      return {
        connectionId: conn._id,
        receiver: conn.receiver ? {
          id: conn.receiver._id,
          name: conn.receiver.name,
          profileImage: conn.receiver.profileImage,
        } : null,
        status: conn.status,
        createdAt: conn.createdAt,
      };
    } else {
      return {
        connectionId: conn._id,
        sender: conn.sender ? {
          id: conn.sender._id,
          name: conn.sender.name,
          profileImage: conn.sender.profileImage,
        } : null,
        status: conn.status,
        createdAt: conn.createdAt,
      };
    }
  });

  return {
    data: formattedData,
    pagination: meta,
  };
};

export const ConnectionService = {
  sendConnectionRequest,
  respondToConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
  getMyConnections,
  getPendingConnectionRequests,
};
