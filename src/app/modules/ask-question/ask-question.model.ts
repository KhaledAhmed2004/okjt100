import { Schema, model } from 'mongoose';
import { IAskQuestion } from './ask-question.interface';

const AskQuestionSchema = new Schema<IAskQuestion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },
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
AskQuestionSchema.index({ question: 'text' });
AskQuestionSchema.index({ userId: 1 });
AskQuestionSchema.index({ userRole: 1 });
AskQuestionSchema.index({ status: 1 });
AskQuestionSchema.index({ createdAt: -1 });

const AskQuestion = model<IAskQuestion>('AskQuestion', AskQuestionSchema);

export default AskQuestion;
