import { Schema, Document } from 'mongoose';

export type TQuestionStatus = 'pending' | 'answered';

export interface IAnswerVersion {
  version: number;
  text: string;
  isActive: boolean;
  createdAt: Date;
}

export interface IAskQuestion extends Document {
  userId: Schema.Types.ObjectId;
  userRole: 'BROTHER' | 'SISTER';
  question: string;
  imageUrl?: string;
  status: TQuestionStatus;
  /** Full answer history. Active answer is always answers.find(a => a.isActive). */
  answers: IAnswerVersion[];
  createdAt: Date;
  updatedAt: Date;
}
