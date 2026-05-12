import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { GroupService } from './group.service';

const createGroup = catchAsync(async (req: Request, res: Response) => {
  const result = await GroupService.createGroupIntoDB(req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Group created successfully',
    data: result,
  });
});

const getAllGroups = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await GroupService.getAllGroupsFromDB(req.query, user.role);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Groups fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const joinGroup = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { groupId } = req.params;
  const result = await GroupService.joinGroupInDB(groupId, user.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Joined group successfully',
    data: result,
  });
});

const createPost = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { groupId } = req.params;
  const result = await GroupService.createPostInDB(groupId, user.id, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Post created successfully',
    data: result,
  });
});

const getGroupFeed = catchAsync(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const user = req.user as any;
  const result = await GroupService.getGroupFeedFromDB(groupId, req.query, user?.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Group feed fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { postId } = req.params;
  const result = await GroupService.toggleLikeInDB(postId, user.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.liked ? 'Post liked' : 'Post unliked',
    data: result,
  });
});

const addComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { postId } = req.params;
  const result = await GroupService.addCommentInDB(
    postId,
    user.id,
    req.body.comment,
    req.body.parentCommentId,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Comment added successfully',
    data: result,
  });
});

const deletePost = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { postId } = req.params;
  await GroupService.deletePostInDB(postId, user.id, user.role);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Post deleted successfully',
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { commentId } = req.params;
  await GroupService.deleteCommentInDB(commentId, user.id, user.role);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Comment deleted successfully',
  });
});

const updatePost = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { postId } = req.params;
  const result = await GroupService.updatePostInDB(postId, user.id, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Post updated successfully',
    data: result,
  });
});

const updateComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { commentId } = req.params;
  const result = await GroupService.updateCommentInDB(
    commentId,
    user.id,
    req.body.comment,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Comment updated successfully',
    data: result,
  });
});

export const GroupController = {
  createGroup,
  getAllGroups,
  joinGroup,
  createPost,
  getGroupFeed,
  toggleLike,
  addComment,
  deletePost,
  deleteComment,
  updatePost,
  updateComment,
};
