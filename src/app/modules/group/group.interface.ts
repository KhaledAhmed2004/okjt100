import { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description: string;
  userType: 'Male' | 'Female';
  categoryId: Schema.Types.ObjectId;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupMember extends Document {
  groupId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  role: 'member' | 'admin';
  joinedAt: Date;
}

export interface IGroupPost extends Document {
  groupId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  content: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostLike extends Document {
  postId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
}

export interface IPostComment extends Document {
  postId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}
