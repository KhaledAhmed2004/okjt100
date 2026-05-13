import { Document } from 'mongoose';

export type TWaqt = 'Fajr' | 'Zuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface IDua extends Document {
  title: string;
  waqt: TWaqt;
  details: string;
  audioUrl: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
