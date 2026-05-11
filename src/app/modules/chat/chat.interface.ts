import { Model, Types } from 'mongoose';

export type IChat = {
  participants: [Types.ObjectId];
  status: Boolean;
  trialRequestId?: Types.ObjectId; // Link to trial request that created this chat
  sessionRequestId?: Types.ObjectId; // Link to session request that created this chat
};

export type ChatModel = Model<IChat, Record<string, unknown>>;
