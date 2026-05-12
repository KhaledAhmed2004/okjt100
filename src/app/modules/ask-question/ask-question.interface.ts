import { Schema, Document } from 'mongoose';

export type TQuestionStatus = 'pending' | 'answered';

export interface IAskQuestion extends Document {
  userId: Schema.Types.ObjectId;
  userRole: string;
  question: string;
  imageUrl?: string;
  status: TQuestionStatus;
  answer?: string;
  answeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
