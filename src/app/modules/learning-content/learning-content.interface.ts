import { Model, Types } from 'mongoose';

export type ILearningContent = {
  _id?: Types.ObjectId;
  title: string;
  description: string;
  videoUrl: string;
  category: string;
  likesCount: number;
  commentsCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ILearningContentLike = {
  contentId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt?: Date;
};

export type ILearningContentComment = {
  contentId: Types.ObjectId;
  userId: Types.ObjectId;
  comment: string;
  parentCommentId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type LearningContentModel = Model<ILearningContent>;
export type LearningContentLikeModel = Model<ILearningContentLike>;
export type LearningContentCommentModel = Model<ILearningContentComment>;
