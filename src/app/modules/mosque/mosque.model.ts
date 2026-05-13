import { Schema, model } from 'mongoose';
import { IMosque } from './mosque.interface';

const MosqueSchema = new Schema<IMosque>(
  {
    mosqueName: { type: String, required: true },
    address: { type: String, required: true },
    area: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    website: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    prayerTimes: {
      fajr: { type: String, required: true },
      dhuhr: { type: String, required: true },
      asr: { type: String, required: true },
      maghrib: { type: String, required: true },
      isha: { type: String, required: true },
      jummah: { type: String },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for search and filtering
MosqueSchema.index({ mosqueName: 'text', area: 'text', address: 'text' });
MosqueSchema.index({ area: 1 });
MosqueSchema.index({ 'location.coordinates': '2dsphere' });

const Mosque = model<IMosque>('Mosque', MosqueSchema);

export default Mosque;
