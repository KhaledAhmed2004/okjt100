import { model, Schema } from 'mongoose';
import { IConnection, ConnectionModel } from './connection.interface';
import { CONNECTION_STATUS } from './connection.constants';

const connectionSchema = new Schema<IConnection, ConnectionModel>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    connectionKey: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(CONNECTION_STATUS),
      default: CONNECTION_STATUS.PENDING,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Deterministic unique index using connectionKey to prevent A->B and B->A race condition
connectionSchema.index({ connectionKey: 1 }, { unique: true });

// Indexes for fast pending request lookups
connectionSchema.index({ receiver: 1, status: 1 });
connectionSchema.index({ sender: 1, status: 1 });

export const Connection = model<IConnection, ConnectionModel>('Connection', connectionSchema);
