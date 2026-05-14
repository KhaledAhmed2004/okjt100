import { model, Schema } from 'mongoose';
import { IConnection, ConnectionModel } from './connection.interface';

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
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED'],
      default: 'PENDING',
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

// Compound unique index to prevent duplicate connection requests between the same two users
// We handle direction logic in the service (A->B and B->A are both blocked if one exists)
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

// Indexes for fast pending request lookups
connectionSchema.index({ receiver: 1, status: 1 });
connectionSchema.index({ sender: 1, status: 1 });

export const Connection = model<IConnection, ConnectionModel>('Connection', connectionSchema);
