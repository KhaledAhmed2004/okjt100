import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { LearningContentService } from './learning-content.service';

const createLearningContent = catchAsync(async (req: Request, res: Response) => {
  const result = await LearningContentService.createLearningContentIntoDB(req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Learning content created successfully',
    data: result,
  });
});

const getAllLearningContents = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await LearningContentService.getAllLearningContentsFromDB(req.query, user?.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Learning contents fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getSingleLearningContent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { contentId } = req.params;
  const result = await LearningContentService.getSingleLearningContentFromDB(contentId, user?.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Learning content fetched successfully',
    data: result,
  });
});

const updateLearningContent = catchAsync(async (req: Request, res: Response) => {
  const { contentId } = req.params;
  const result = await LearningContentService.updateLearningContentInDB(contentId, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Learning content updated successfully',
    data: result,
  });
});

const deleteLearningContent = catchAsync(async (req: Request, res: Response) => {
  const { contentId } = req.params;
  await LearningContentService.deleteLearningContentFromDB(contentId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Learning content deleted successfully',
  });
});

const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { contentId } = req.params;
  const result = await LearningContentService.toggleLikeInDB(contentId, user.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.liked ? 'Content liked' : 'Content unliked',
    data: result,
  });
});

const addComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { contentId } = req.params;
  const result = await LearningContentService.addCommentInDB(
    contentId,
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

const getComments = catchAsync(async (req: Request, res: Response) => {
  const { contentId } = req.params;
  const result = await LearningContentService.getCommentsFromDB(contentId, req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Comments fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { commentId } = req.params;
  await LearningContentService.deleteCommentInDB(commentId, user.id, user.role);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Comment deleted successfully',
  });
});

export const LearningContentController = {
  createLearningContent,
  getAllLearningContents,
  getSingleLearningContent,
  updateLearningContent,
  deleteLearningContent,
  toggleLike,
  addComment,
  getComments,
  deleteComment,
};
