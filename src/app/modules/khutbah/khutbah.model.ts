import { Schema, model } from 'mongoose';
import { IKhutba } from './khutbah.interface';

const KhutbaSchema = new Schema<IKhutba>(
  {
    title: { type: String, required: true },
    mosqueName: { type: String, required: true },
    imam: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String },
    audioUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    durationInSeconds: { type: Number },
  },
  {
    timestamps: true,
  },
);

// Indexes for global search and fast sorting
KhutbaSchema.index({ title: 'text', imam: 'text', mosqueName: 'text' });
KhutbaSchema.index({ date: -1 });

const KhutbaModel = model<IKhutba>('Khutba', KhutbaSchema);

export default KhutbaModel;
