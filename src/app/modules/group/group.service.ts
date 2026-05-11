import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IGroup, IGroupMember, IGroupPost, IPostComment } from './group.interface';
import { Group, GroupMember, GroupPost, PostLike, PostComment } from './group.model';
import mongoose from 'mongoose';

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

const getGroupFeedFromDB = async (groupId: string, query: Record<string, unknown>) => {
  const postQuery = new QueryBuilder(GroupPost.find({ groupId }).populate('userId', 'fullName profileImage'), query)
    .sort()
    .paginate()
    .fields();

  const data = await postQuery.modelQuery;
  const pagination = await postQuery.getPaginationInfo();

  return { data, pagination };
};

const toggleLikeInDB = async (postId: string, userId: string) => {
  const isLiked = await PostLike.findOne({ postId, userId });
  if (isLiked) {
    await PostLike.findByIdAndDelete(isLiked._id);
    return { liked: false };
  } else {
    await PostLike.create({ postId, userId });
    return { liked: true };
  }
};

const addCommentInDB = async (postId: string, userId: string, comment: string) => {
  const result = await PostComment.create({ postId, userId, comment });
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
};
