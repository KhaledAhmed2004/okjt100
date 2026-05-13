import { Schema, model } from 'mongoose';
import { IDua } from './dua.interface';

const DuaSchema = new Schema<IDua>(
  {
    title: { type: String, required: true },
    waqt: {
      type: String,
      enum: ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'],
      required: true,
    },
    details: { type: String, required: true },
    audioUrl: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast searching and filtering
DuaSchema.index({ title: 'text', details: 'text' });
DuaSchema.index({ waqt: 1 });

const DuaModel = model<IDua>('Dua', DuaSchema);

export default DuaModel;
