import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { ILearningContent, ILearningContentComment } from './learning-content.interface';
import { LearningContent, LearningContentLike, LearningContentComment } from './learning-content.model';
import { User } from '../user/user.model';
import { USER_STATUS } from '../../../enums/user';

const syncLikesCount = async (contentId: string) => {
  const count = await LearningContentLike.countDocuments({ contentId });
  await LearningContent.findByIdAndUpdate(contentId, { likesCount: count });
};

const syncCommentsCount = async (contentId: string) => {
  const count = await LearningContentComment.countDocuments({ contentId });
  await LearningContent.findByIdAndUpdate(contentId, { commentsCount: count });
};

const createLearningContentIntoDB = async (payload: ILearningContent) => {
  const result = await LearningContent.create(payload);
  return result;
};

const getAllLearningContentsFromDB = async (query: Record<string, unknown>, userId?: string) => {
  const contentQuery = new QueryBuilder(LearningContent.find(), query)
    .search(['title', 'category'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await contentQuery.modelQuery;
  const pagination = await contentQuery.getPaginationInfo();

  // Add isLiked flag for current user
  let contentWithLikeStatus;
  if (userId) {
    const contentIds = data.map((c: any) => c._id);
    const userLikes = await LearningContentLike.find({
      contentId: { $in: contentIds },
      userId: userId,
    });
    const likedContentIds = new Set(userLikes.map(l => l.contentId.toString()));

    contentWithLikeStatus = data.map((c: any) => ({
      ...c.toObject(),
      isLiked: likedContentIds.has(c._id.toString()),
    }));
  } else {
    contentWithLikeStatus = data.map((c: any) => c.toObject());
  }

  return { data: contentWithLikeStatus, pagination };
};

const getSingleLearningContentFromDB = async (id: string, userId?: string) => {
  const content = await LearningContent.findById(id);
  if (!content) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Learning content not found');
  }

  let isLiked = false;
  if (userId) {
    const like = await LearningContentLike.findOne({ contentId: id, userId });
    isLiked = !!like;
  }

  return { ...content.toObject(), isLiked };
};

const updateLearningContentInDB = async (id: string, payload: Partial<ILearningContent>) => {
  const result = await LearningContent.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Learning content not found');
  }
  return result;
};

const deleteLearningContentFromDB = async (id: string) => {
  const result = await LearningContent.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Learning content not found');
  }
  
  // Cleanup likes and comments
  await LearningContentLike.deleteMany({ contentId: id });
  await LearningContentComment.deleteMany({ contentId: id });
  
  return result;
};

const toggleLikeInDB = async (contentId: string, userId: string) => {
  const content = await LearningContent.findById(contentId);
  if (!content) throw new ApiError(StatusCodes.NOT_FOUND, 'Learning content not found');

  const removed = await LearningContentLike.findOneAndDelete({ contentId, userId });

  if (removed) {
    await syncLikesCount(contentId);
    return { liked: false };
  }

  try {
    await LearningContentLike.create({ contentId, userId });
    await syncLikesCount(contentId);
    return { liked: true };
  } catch (err: any) {
    if (err.code === 11000) {
      return { liked: true };
    }
    throw err;
  }
};

const addCommentInDB = async (
  contentId: string,
  userId: string,
  comment: string,
  parentCommentId?: string,
) => {
  const content = await LearningContent.findById(contentId);
  if (!content) throw new ApiError(StatusCodes.NOT_FOUND, 'Learning content not found');

  if (parentCommentId) {
    const parent = await LearningContentComment.findById(parentCommentId);
    if (!parent) throw new ApiError(StatusCodes.NOT_FOUND, 'Parent comment not found');
    if (parent.contentId.toString() !== contentId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Parent comment belongs to another content');
    }
    if (parent.parentCommentId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot reply to a nested comment');
    }
  }

  const result = await LearningContentComment.create({
    contentId,
    userId,
    comment,
    parentCommentId: parentCommentId || null,
  });

  await syncCommentsCount(contentId);
  return result;
};

const getCommentsFromDB = async (contentId: string, query: Record<string, unknown>) => {
  // Pre-filter: exclude comments by deleted users
  const deletedUserIds = await User.find({ status: USER_STATUS.DELETED }).distinct('_id');
  const baseFilter: any = { contentId };
  if (deletedUserIds.length > 0) {
    baseFilter.userId = { $nin: deletedUserIds };
  }

  const commentQuery = new QueryBuilder(
    LearningContentComment.find(baseFilter).populate('userId', 'name profileImage'),
    query,
  )
    .sort()
    .paginate()
    .fields();

  const data = await commentQuery.modelQuery;
  const pagination = await commentQuery.getPaginationInfo();

  return { data, pagination };
};

const deleteCommentInDB = async (commentId: string, userId: string, userRole: string) => {
  const comment = await LearningContentComment.findById(commentId);
  if (!comment) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');

  // Check if owner or admin
  const isOwner = comment.userId.toString() === userId;
  const isAdmin = userRole === 'SUPER_ADMIN'; // Adjust based on your role enum

  if (!isOwner && !isAdmin) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized to delete this comment');
  }

  // Cascade delete: if top-level comment, delete its children too
  if (!comment.parentCommentId) {
    await LearningContentComment.deleteMany({ parentCommentId: commentId });
  }

  await LearningContentComment.findByIdAndDelete(commentId);
  await syncCommentsCount(comment.contentId.toString());
};

export const LearningContentService = {
  createLearningContentIntoDB,
  getAllLearningContentsFromDB,
  getSingleLearningContentFromDB,
  updateLearningContentInDB,
  deleteLearningContentFromDB,
  toggleLikeInDB,
  addCommentInDB,
  getCommentsFromDB,
  deleteCommentInDB,
};
