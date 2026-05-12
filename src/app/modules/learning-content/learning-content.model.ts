import { Schema, model } from 'mongoose';
import {
  ILearningContent,
  ILearningContentLike,
  ILearningContentComment,
  LearningContentModel,
  LearningContentLikeModel,
  LearningContentCommentModel,
} from './learning-content.interface';

const learningContentSchema = new Schema<ILearningContent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    videoUrl: { type: String, required: true },
    category: { type: String, required: true, index: true },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const learningContentLikeSchema = new Schema<ILearningContentLike>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: 'LearningContent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const learningContentCommentSchema = new Schema<ILearningContentComment>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: 'LearningContent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningContentComment',
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
learningContentLikeSchema.index({ contentId: 1, userId: 1 }, { unique: true });
learningContentCommentSchema.index({ contentId: 1, createdAt: 1 });
learningContentCommentSchema.index({ parentCommentId: 1 });

export const LearningContent = model<ILearningContent, LearningContentModel>(
  'LearningContent',
  learningContentSchema,
);
export const LearningContentLike = model<ILearningContentLike, LearningContentLikeModel>(
  'LearningContentLike',
  learningContentLikeSchema,
);
export const LearningContentComment = model<
  ILearningContentComment,
  LearningContentCommentModel
>('LearningContentComment', learningContentCommentSchema);
