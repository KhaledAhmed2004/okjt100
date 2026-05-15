import { Model, Types } from 'mongoose';

export type ILastMessage = {
  text: string; // capped at 2000 chars
  sender: Types.ObjectId;
  createdAt: Date;
};

export type IChat = {
  participants: Types.ObjectId[]; // exactly 2
  lastMessage: ILastMessage | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatModel = Model<IChat, Record<string, unknown>>;
