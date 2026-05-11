import { Document } from 'mongoose';

export interface IKhutba extends Document {
  title: string;
  mosqueName: string;
  imam: string;
  date: Date;
  description?: string;
  audioUrl: string;
  thumbnailUrl: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}
