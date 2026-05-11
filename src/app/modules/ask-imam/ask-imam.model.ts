import { Schema, model } from 'mongoose';
import { IAskImam } from './ask-imam.interface';

const AskImamSchema = new Schema<IAskImam>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    imageUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'answered'],
      default: 'pending',
      required: true,
    },
    answer: { type: String },
    answeredAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes
AskImamSchema.index({ userId: 1 });
AskImamSchema.index({ status: 1 });
AskImamSchema.index({ createdAt: -1 });

const AskImam = model<IAskImam>('AskImam', AskImamSchema);

export default AskImam;
