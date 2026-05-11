import { Schema, model } from 'mongoose';
import { IGroup, IGroupMember, IGroupPost, IPostLike, IPostComment } from './group.interface';

// 1. Group Schema
const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    userType: { type: String, enum: ['Male', 'Female'], required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    memberCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// 2. Group Member Schema
const GroupMemberSchema = new Schema<IGroupMember>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// 3. Group Post Schema
const GroupPostSchema = new Schema<IGroupPost>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: { type: [String], default: [] },
  },
  { timestamps: true },
);

// 4. Post Like Schema
const PostLikeSchema = new Schema<IPostLike>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'GroupPost', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// 5. Post Comment Schema
const PostCommentSchema = new Schema<IPostComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'GroupPost', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
  },
  { timestamps: true },
);

// Compound indexes for efficiency
GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const Group = model<IGroup>('Group', GroupSchema);
export const GroupMember = model<IGroupMember>('GroupMember', GroupMemberSchema);
export const GroupPost = model<IGroupPost>('GroupPost', GroupPostSchema);
export const PostLike = model<IPostLike>('PostLike', PostLikeSchema);
export const PostComment = model<IPostComment>('PostComment', PostCommentSchema);
