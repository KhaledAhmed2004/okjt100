import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../notification/notificationsHelper', () => ({
  sendNotifications: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../chat/chat.service', () => ({
  ChatService: {
    createOrGet: vi.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId() }),
  },
}));

vi.mock('../../../../config', () => ({
  default: {
    connection: {
      max_pending_requests: 3,
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { ConnectionService } from '../connection.service';
import { Connection } from '../connection.model';
import { User } from '../../user/user.model';
import { CONNECTION_STATUS, CONNECTION_ACTION } from '../connection.constants';
import { USER_STATUS } from '../../../../enums/user';

// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet: MongoMemoryReplSet;

async function createUser(suffix?: string) {
  const tag = suffix ?? `${Date.now()}-${Math.random()}`;
  return User.create({
    name: `Test User ${tag}`,
    role: 'BROTHER',
    email: `test-${tag}@example.com`,
    password: 'password123',
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
    status: USER_STATUS.ACTIVE,
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Connection.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
  
  // Mock global io
  (global as any).io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('ConnectionService Integration', () => {
  describe('sendConnectionRequest', () => {
    it('successfully sends a connection request and emits socket event', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const result = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );
      console.log('--- sendConnectionRequest Response ---\n', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(result.status).toBe(CONNECTION_STATUS.PENDING);
      expect(result.sender.toString()).toBe(sender._id.toString());
      expect(result.receiver.toString()).toBe(receiver._id.toString());
      
      const { sendNotifications } = await import('../../notification/notificationsHelper');
      expect(sendNotifications).toHaveBeenCalled();
      
      expect((global as any).io.to).toHaveBeenCalledWith(`user::${receiver._id}`);
      expect((global as any).io.emit).toHaveBeenCalledWith('CONNECTION_REQUEST', expect.any(Object));
    });

    it('throws 400 when trying to connect with yourself', async () => {
      const user = await createUser('self');

      await expect(
        ConnectionService.sendConnectionRequest(user._id.toString(), user._id.toString())
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'You cannot connect with yourself',
      });
    });

    it('throws 429 when max pending requests limit is reached', async () => {
      const sender = await createUser('spammer');
      
      // We mocked config.connection.max_pending_requests = 3
      // Create 3 pending requests for this user
      for (let i = 0; i < 3; i++) {
        const tempReceiver = await createUser(`temp-${i}`);
        await Connection.create({
          sender: sender._id,
          receiver: tempReceiver._id,
          connectionKey: `${sender._id}_${tempReceiver._id}`, // Fake key for speed
          status: CONNECTION_STATUS.PENDING,
        });
      }

      const receiver = await createUser('receiver-4');

      await expect(
        ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString())
      ).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining('reached the maximum number of pending requests'),
      });
    });

    it('throws 409 if a connection request already exists between them', async () => {
      const userA = await createUser('A');
      const userB = await createUser('B');

      // Send first request
      await ConnectionService.sendConnectionRequest(userA._id.toString(), userB._id.toString());

      // Attempt second request in the SAME direction
      await expect(
        ConnectionService.sendConnectionRequest(userA._id.toString(), userB._id.toString())
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Connection request already exists',
      });

      // Attempt request in the REVERSE direction (race condition test)
      await expect(
        ConnectionService.sendConnectionRequest(userB._id.toString(), userA._id.toString())
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Connection request already exists',
      });
    });
  });

  describe('respondToConnectionRequest', () => {
    it('accepts a request, creates a chat, and commits transaction', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      vi.clearAllMocks(); // Clear io and notifications from send Request

      const accepted = await ConnectionService.respondToConnectionRequest(
        connection._id.toString(),
        receiver._id.toString(),
        CONNECTION_ACTION.ACCEPT
      );
      console.log('--- respondToConnectionRequest (ACCEPT) Response ---\n', JSON.stringify(accepted, null, 2));

      expect(accepted).toBeDefined();
      expect(accepted?.status).toBe(CONNECTION_STATUS.ACCEPTED);
      expect(accepted?.chatId).toBeDefined();
      
      const { ChatService } = await import('../../chat/chat.service');
      expect(ChatService.createOrGet).toHaveBeenCalledWith(
        sender._id.toString(),
        receiver._id.toString()
      );

      // Verify socket and notification fired for sender
      expect((global as any).io.to).toHaveBeenCalledWith(`user::${sender._id}`);
      expect((global as any).io.emit).toHaveBeenCalledWith('CONNECTION_ACCEPTED', expect.any(Object));
    });

    it('rejects a request, deletes it, and commits transaction', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      const rejected = await ConnectionService.respondToConnectionRequest(
        connection._id.toString(),
        receiver._id.toString(),
        CONNECTION_ACTION.REJECT
      );
      console.log('--- respondToConnectionRequest (REJECT) Response ---\n', JSON.stringify(rejected, null, 2));

      expect(rejected).toBeNull();
      
      // Verify DB is clean
      const dbCheck = await Connection.findById(connection._id);
      expect(dbCheck).toBeNull();
    });

    it('throws 403 if non-receiver tries to accept', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');
      const hacker = await createUser('hacker');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      await expect(
        ConnectionService.respondToConnectionRequest(
          connection._id.toString(),
          hacker._id.toString(),
          CONNECTION_ACTION.ACCEPT
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only the receiver can respond to this request',
      });
    });
  });

  describe('cancelConnectionRequest', () => {
    it('successfully cancels a sent request', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      await ConnectionService.cancelConnectionRequest(
        connection._id.toString(),
        sender._id.toString()
      );

      const dbCheck = await Connection.findById(connection._id);
      expect(dbCheck).toBeNull();
    });

    it('throws 403 if someone else tries to cancel', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      await expect(
        ConnectionService.cancelConnectionRequest(
          connection._id.toString(),
          receiver._id.toString() // receiver cannot cancel it, only respond
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only the sender can cancel this request',
      });
    });
  });

  describe('removeConnection', () => {
    it('successfully removes an accepted connection using transactions', async () => {
      const sender = await createUser('sender');
      const receiver = await createUser('receiver');

      const connection = await ConnectionService.sendConnectionRequest(
        sender._id.toString(),
        receiver._id.toString()
      );

      await ConnectionService.respondToConnectionRequest(
        connection._id.toString(),
        receiver._id.toString(),
        CONNECTION_ACTION.ACCEPT
      );

      await ConnectionService.removeConnection(
        connection._id.toString(),
        sender._id.toString() // sender removes it
      );

      const dbCheck = await Connection.findById(connection._id);
      expect(dbCheck).toBeNull();
    });
  });
});
