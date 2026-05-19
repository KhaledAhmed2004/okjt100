import { Model, Types } from 'mongoose';
import { CONNECTION_STATUS, CONNECTION_ACTION } from './connection.constants';

export type ConnectionStatus = keyof typeof CONNECTION_STATUS;
export type ConnectionAction = keyof typeof CONNECTION_ACTION;

export interface IConnection {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  connectionKey: string;
  status: ConnectionStatus;
  chatId?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionModel = Model<IConnection, Record<string, unknown>>;
