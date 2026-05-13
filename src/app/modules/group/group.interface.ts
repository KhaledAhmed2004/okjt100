import { Schema, Document } from 'mongoose';
import { USER_ROLES } from '../../../enums/user';

export interface IGroup extends Document {
  name: string;
  description: string;
  userType: USER_ROLES.BROTHER | USER_ROLES.SISTER;
  category: string;
  memberCount: number;
  coverImage?: string;
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
  likesCount: number;
  commentsCount: number;
  isPinned: boolean;
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
  parentCommentId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
