import { Schema, model } from 'mongoose';
import { IAskQuestion } from './ask-question.interface';

const AnswerVersionSchema = new Schema(
  {
    version:  { type: Number,  required: true },
    text:     { type: String,  required: true },
    isActive: { type: Boolean, required: true, default: true },
    createdAt:{ type: Date,    required: true },
  },
  { _id: false }, // subdocuments don't need their own _id
);

const AskQuestionSchema = new Schema<IAskQuestion>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    imageUrl: { type: String },
    status: {
      type:     String,
      enum:     ['pending', 'answered'],
      default:  'pending',
      required: true,
    },
    answers: { type: [AnswerVersionSchema], default: [] },
  },
  { timestamps: true },
);

// Indexes
AskQuestionSchema.index({ question: 'text' });
AskQuestionSchema.index({ userId: 1 });
AskQuestionSchema.index({ status: 1 });
AskQuestionSchema.index({ createdAt: -1 });

const AskQuestion = model<IAskQuestion>('AskQuestion', AskQuestionSchema);

export default AskQuestion;
