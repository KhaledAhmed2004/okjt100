import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IGroup, IGroupMember, IGroupPost, IPostComment } from './group.interface';
import { Group, GroupMember, GroupPost, PostLike, PostComment } from './group.model';
import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';
import { deleteFile } from '../../middlewares/fileHandler';
import { User } from '../user/user.model';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';
import { Notification } from '../notification/notification.model';

// Helper to check if user is a member of a group
const checkMembership = async (groupId: string, userId: string, userRole: string) => {
  if (userRole === USER_ROLES.SUPER_ADMIN) return true;
  const isMember = await GroupMember.findOne({ groupId, userId });
  if (!isMember) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only members can access this resource');
  }
  return true;
};

const createGroupIntoDB = async (payload: IGroup) => {
  const result = await Group.create(payload);
  return result;
};

const getSingleGroupFromDB = async (groupId: string, userId: string, userRole: string) => {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');

  // Check role compatibility for non-admins
  if (userRole !== USER_ROLES.SUPER_ADMIN && group.userType !== userRole) {
    throw new ApiError(StatusCodes.FORBIDDEN, `Access denied to ${group.userType} groups`);
  }

  const isMember = await GroupMember.findOne({ groupId, userId });
  return { ...group.toObject(), isMember: !!isMember };
};

const updateGroupInDB = async (groupId: string, payload: Partial<IGroup>) => {
  const result = await Group.findByIdAndUpdate(groupId, payload, { new: true });
  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
  return result;
};

const deleteGroupFromDB = async (groupId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const group = await Group.findById(groupId).session(session);
    if (!group) throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');

    // Cascade delete: Members, Posts, Likes, Comments
    await GroupMember.deleteMany({ groupId }).session(session);

    // Find all posts to delete their attachments
    const posts = await GroupPost.find({ groupId }).session(session);
    for (const post of posts) {
      if (post.attachments && post.attachments.length > 0) {
        post.attachments.forEach(file => deleteFile(file).catch(() => { }));
      }
    }

    await GroupPost.deleteMany({ groupId }).session(session);
    // Since likes and comments are per postId, and we just deleted the group, 
    // it's more efficient to just delete everything associated with the posts of this group.
    // However, if we want to be thorough:
    const postIds = posts.map(p => p._id);
    await PostLike.deleteMany({ postId: { $in: postIds } }).session(session);
    await PostComment.deleteMany({ postId: { $in: postIds } }).session(session);

    const result = await Group.findByIdAndDelete(groupId).session(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAllGroupsFromDB = async (
  query: Record<string, unknown>,
  userId: string,
  userRole: string,
) => {
  // Directly use the user's role to filter groups.
  // BROTHER sees BROTHER groups, SISTER sees SISTER groups.
  // SUPER_ADMIN sees ALL groups (no userType filter).
  const filter: Record<string, any> = {};

  if (userRole !== USER_ROLES.SUPER_ADMIN) {
    filter.userType = userRole;
  }

  const groupQuery = new QueryBuilder(Group.find(filter), query)
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await groupQuery.modelQuery;
  const pagination = await groupQuery.getPaginationInfo();

  let dataWithMembership = data;
  if (data && data.length > 0) {
    const groupIds = data.map((group: any) => group._id);
    const userMemberships = await GroupMember.find({
      groupId: { $in: groupIds },
      userId: userId,
    });
    const joinedGroupIds = new Set(userMemberships.map(m => m.groupId.toString()));

    dataWithMembership = data.map((group: any) => ({
      ...group.toObject(),
      isMember: joinedGroupIds.has(group._id.toString()),
    }));
  } else {
    dataWithMembership = [];
  }

  return { data: dataWithMembership, pagination };
};

const joinGroupInDB = async (groupId: string, userId: string, userRole: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const group = await Group.findById(groupId).session(session);
    if (!group) throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');

    // Role restriction check: User's role must exactly match the group's userType
    // Bypass this check for SUPER_ADMIN
    if (userRole !== USER_ROLES.SUPER_ADMIN && group.userType !== userRole) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        `This group is only for ${group.userType}s. You are a ${userRole}.`,
      );
    }

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

const leaveGroupInDB = async (groupId: string, userId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const result = await GroupMember.findOneAndDelete({ groupId, userId }).session(session);
    if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'You are not a member of this group');

    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } }, { session });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createPostInDB = async (
  groupId: string,
  userId: string,
  userRole: string,
  payload: Partial<IGroupPost>,
) => {
  // SUPER_ADMIN has implicit membership in all groups
  if (userRole !== USER_ROLES.SUPER_ADMIN) {
    const isMember = await GroupMember.findOne({ groupId, userId });
    if (!isMember) throw new ApiError(StatusCodes.FORBIDDEN, 'Only members can post');
  }

  const result = await GroupPost.create({ ...payload, groupId, userId });
  return result;
};

const getGroupFeedFromDB = async (
  groupId: string,
  query: Record<string, unknown>,
  userId: string,
  userRole: string,
) => {
  // Security: Check if user is a member
  await checkMembership(groupId, userId, userRole);

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
    .textSearch();

  if (query.sort) {
    postQuery.sort();
  } else {
    // Default sort: Pinned posts first, then newest
    postQuery.modelQuery = postQuery.modelQuery.sort({ isPinned: -1, createdAt: -1 });
  }

  postQuery.paginate().fields();

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

const toggleLikeInDB = async (postId: string, userId: string, userRole: string) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  // Security: Check group membership
  await checkMembership(post.groupId.toString(), userId, userRole);

  const removed = await PostLike.findOneAndDelete({ postId, userId });

  if (removed) {
    await GroupPost.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
    return { liked: false };
  }

  try {
    await PostLike.create({ postId, userId });
    await GroupPost.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });

    // Notify post owner
    if (post.userId.toString() !== userId) {
      // Notification Suppression: Check if we sent a notification for this post in the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentNotification = await Notification.findOne({
        receiver: post.userId.toString(),
        type: 'POST_LIKED',
        resourceId: postId,
        createdAt: { $gte: fifteenMinutesAgo },
      });

      if (!recentNotification) {
        new NotificationBuilder()
          .to(post.userId.toString())
          .setTitle('New Like')
          .setText('Someone liked your post.')
          .setType('POST_LIKED')
          .setResource('GroupPost', postId)
          .viaAll()
          .send()
          .catch(err => console.error('Notification Error:', err));
      }
    }

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
  userRole: string,
  comment: string,
  parentCommentId?: string,
) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  // Security: Check group membership
  await checkMembership(post.groupId.toString(), userId, userRole);

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

  await GroupPost.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  // Notify post owner
  if (post.userId.toString() !== userId) {
    new NotificationBuilder()
      .to(post.userId.toString())
      .setTitle('New Comment')
      .setText('Someone commented on your post.')
      .setType('POST_COMMENTED')
      .setResource('GroupPost', postId)
      .viaAll()
      .send()
      .catch(err => console.error('Notification Error:', err));
  }

  // Notify parent comment owner (if reply)
  if (parentCommentId) {
    PostComment.findById(parentCommentId).then(parent => {
      if (parent && parent.userId.toString() !== userId) {
        new NotificationBuilder()
          .to(parent.userId.toString())
          .setTitle('New Reply')
          .setText('Someone replied to your comment.')
          .setType('COMMENT_REPLIED')
          .setResource('GroupPost', postId)
          .viaAll()
          .send()
          .catch(err => console.error('Notification Error:', err));
      }
    });
  }

  return result;
};

const deletePostInDB = async (postId: string, userId: string, userRole: string) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  if (post.userId.toString() !== userId && userRole !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to delete this post');
  }

  if (post.attachments && post.attachments.length > 0) {
    post.attachments.forEach(file => deleteFile(file).catch(() => { }));
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
  let deletedCount = 1;
  if (!comment.parentCommentId) {
    const children = await PostComment.deleteMany({ parentCommentId: commentId });
    deletedCount += children.deletedCount;
  }

  await PostComment.findByIdAndDelete(commentId);
  await GroupPost.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -deletedCount } });
};

const updatePostInDB = async (postId: string, userId: string, payload: Partial<IGroupPost>) => {
  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  if (post.userId.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to update this post');
  }

  // Delete orphaned attachments: files that were in the old post but not in the new payload
  if (payload.attachments !== undefined && post.attachments && post.attachments.length > 0) {
    const newAttachments = new Set(payload.attachments);
    const orphaned = post.attachments.filter(file => !newAttachments.has(file));
    orphaned.forEach(file => deleteFile(file).catch(() => {}));
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

const getPostCommentsFromDB = async (postId: string, query: Record<string, unknown>) => {
  const commentQuery = new QueryBuilder(
    PostComment.find({ postId }).populate('userId', 'name profileImage'),
    query,
  )
    .sort()
    .paginate()
    .fields();

  const data = await commentQuery.modelQuery;
  const pagination = await commentQuery.getPaginationInfo();

  return { data, pagination };
};

const kickMemberFromDB = async (groupId: string, userId: string, adminRole: string) => {
  if (adminRole !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only Super Admin can kick members');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const result = await GroupMember.findOneAndDelete({ groupId, userId }).session(session);
    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Member not found');

    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } }, { session });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const togglePinPostInDB = async (postId: string, adminRole: string) => {
  if (adminRole !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only Super Admin can pin posts');
  }

  const post = await GroupPost.findById(postId);
  if (!post) throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');

  const result = await GroupPost.findByIdAndUpdate(
    postId,
    { isPinned: !post.isPinned },
    { new: true },
  );
  return result;
};

export const GroupService = {
  createGroupIntoDB,
  getAllGroupsFromDB,
  getSingleGroupFromDB,
  updateGroupInDB,
  deleteGroupFromDB,
  joinGroupInDB,
  leaveGroupInDB,
  createPostInDB,
  getGroupFeedFromDB,
  toggleLikeInDB,
  addCommentInDB,
  deletePostInDB,
  deleteCommentInDB,
  updatePostInDB,
  updateCommentInDB,
  getPostCommentsFromDB,
  kickMemberFromDB,
  togglePinPostInDB,
};
