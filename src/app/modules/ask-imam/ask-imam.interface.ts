import { Schema, Document } from 'mongoose';

export type TQuestionStatus = 'pending' | 'answered';

export interface IAskImam extends Document {
  userId: Schema.Types.ObjectId;
  question: string;
  imageUrl?: string;
  status: TQuestionStatus;
  answer?: string;
  answeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
