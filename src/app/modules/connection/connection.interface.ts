import { Model, Types } from 'mongoose';

export type ConnectionStatus = 'PENDING' | 'ACCEPTED';

export interface IConnection {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  status: ConnectionStatus;
  chatId?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionModel = Model<IConnection, Record<string, unknown>>;
