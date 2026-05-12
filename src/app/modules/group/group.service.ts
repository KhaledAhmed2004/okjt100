import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IGroup, IGroupMember, IGroupPost, IPostComment } from './group.interface';
import { Group, GroupMember, GroupPost, PostLike, PostComment } from './group.model';
import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';
import { deleteFile } from '../../middlewares/fileHandler';
import { User } from '../user/user.model';

const syncLikesCount = async (postId: string) => {
  const count = await PostLike.countDocuments({ postId });
  await GroupPost.findByIdAndUpdate(postId, { likesCount: count });
};

const syncCommentsCount = async (postId: string) => {
  const count = await PostComment.countDocuments({ postId });
  await GroupPost.findByIdAndUpdate(postId, { commentsCount: count });
};

const createGroupIntoDB = async (payload: IGroup) => {
  const result = await Group.create(payload);
  return result;
};

const getAllGroupsFromDB = async (query: Record<string, unknown>, userRole: string) => {
  // Map internal role (BROTHER/SISTER) to group userType (Male/Female)
  const mappedGender = userRole === USER_ROLES.BROTHER ? 'Male' : 'Female';
  
  const groupQuery = new QueryBuilder(Group.find({ userType: mappedGender }), query)
    .textSearch(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await groupQuery.modelQuery;
  const pagination = await groupQuery.getPaginationInfo();

  return { data, pagination };
};

const joinGroupInDB = async (groupId: string, userId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const group = await Group.findById(groupId).session(session);
    if (!group) throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');

    const isAlreadyMember = await GroupMember.findOne({ groupId, userId }).session(session);
    if (isAlreadyMember) throw new ApiError(StatusCodes.BAD_REQUEST, 'Already a member');

    const result = await GroupMember.create([{ groupId, userId, role: 'member' }], { session });
    
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } }, { session });

    await session.commitTransaction();
    return result[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createPostInDB = async (groupId: string, userId: string, payload: Partial<IGroupPost>) => {
  const isMember = await GroupMember.findOne({ groupId, userId });
  if (!isMember) throw new ApiError(StatusCodes.FORBIDDEN, 'Only members can post');

  const result = await GroupPost.create({ ...payload, groupId, userId });
  return result;
};

const getGroupFeedFromDB = async (groupId: string, query: Record<string, unknown>, userId?: string) => {
  const baseFilter: Record<string, unknown> = { groupId };

  // Pre-filter: exclude posts by deleted users
  const deletedUserIds = await User.find({ status: USER_STATUS.DELETED }).distinct('_id');
  if (deletedUserIds.length > 0) {
    baseFilter.userId = { $nin: deletedUserIds };
  }

  const postQuery = new QueryBuilder(
    GroupPost.find(baseFilter).populate('userId', 'name profileImage'),
    query,
  )
    .sort()
    .paginate()
    .fields();

  const data = await postQuery.modelQuery;
  const pagination = await postQuery.getPaginationInfo();

  // Add isLiked flag for current user
  let postsWithLikeStatus;
  if (userId) {
    const postIds = data.map((p: any) => p._id);
    const userLikes = await PostLike.find({
      postId: { $in: postIds },
      userId: userId,
    });
    const likedPostIds = new Set(userLikes.map(l => l.postId.toString()));

    postsWithLikeStatus = data.map((p: any) => ({
      ...p.toObject(),
      isLiked: likedPostIds.has(p._id.toString()),
    }));
  } else {
    postsWithLikeStatus = data.map((p: any) => p.toObject());
  }

  return { data: postsWithLikeStatus, pagination };
};

const toggleLikeInDB = async (postId: string, userId: string) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  const removed = await PostLike.findOneAndDelete({ postId, userId });

  if (removed) {
    await syncLikesCount(postId);
    return { liked: false };
  }

  try {
    await PostLike.create({ postId, userId });
    await syncLikesCount(postId);
    return { liked: true };
  } catch (err: any) {
    if (err.code === 11000) {
      return { liked: true };
    }
    throw err;
  }
};

const addCommentInDB = async (
  postId: string,
  userId: string,
  comment: string,
  parentCommentId?: string,
) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  if (parentCommentId) {
    const parent = await PostComment.findById(parentCommentId);
    if (!parent) throw new ApiError(StatusCodes.NOT_FOUND, 'Parent comment not found');
    if (parent.postId.toString() !== postId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Parent comment belongs to another post');
    }
    if (parent.parentCommentId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot reply to a nested comment');
    }
  }

  const result = await PostComment.create({
    postId,
    userId,
    comment,
    parentCommentId: parentCommentId || null,
  });

  await syncCommentsCount(postId);
  return result;
};

const deletePostInDB = async (postId: string, userId: string, userRole: string) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  if (post.userId.toString() !== userId && userRole !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to delete this post');
  }

  if (post.attachments && post.attachments.length > 0) {
    post.attachments.forEach(file => deleteFile(file).catch(() => {}));
  }

  await GroupPost.findByIdAndDelete(postId);
  await PostComment.deleteMany({ postId });
  await PostLike.deleteMany({ postId });
};

const deleteCommentInDB = async (commentId: string, userId: string, userRole: string) => {
  const comment = await PostComment.findById(commentId);
  if (!comment) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');

  if (comment.userId.toString() !== userId && userRole !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to delete this comment');
  }

  // Cascade delete: if top-level comment, delete its children too
  if (!comment.parentCommentId) {
    await PostComment.deleteMany({ parentCommentId: commentId });
  }

  await PostComment.findByIdAndDelete(commentId);
  await syncCommentsCount(comment.postId.toString());
};

const updatePostInDB = async (postId: string, userId: string, payload: Partial<IGroupPost>) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  if (post.userId.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to update this post');
  }

  const result = await GroupPost.findByIdAndUpdate(postId, payload, { new: true });
  return result;
};

const updateCommentInDB = async (commentId: string, userId: string, comment: string) => {
  const commentDoc = await PostComment.findById(commentId);
  if (!commentDoc) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');

  if (commentDoc.userId.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to update this comment');
  }

  const result = await PostComment.findByIdAndUpdate(commentId, { comment }, { new: true });
  return result;
};

export const GroupService = {
  createGroupIntoDB,
  getAllGroupsFromDB,
  joinGroupInDB,
  createPostInDB,
  getGroupFeedFromDB,
  toggleLikeInDB,
  addCommentInDB,
  deletePostInDB,
  deleteCommentInDB,
  updatePostInDB,
  updateCommentInDB,
};
