import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AskImamService } from './ask-imam.service';

const submitQuestion = catchAsync(async (req: Request, res: Response) => {
  const { user } = req as any;
  const { image, ...rest } = req.body;

  const result = await AskImamService.submitQuestionIntoDB({
    ...rest,
    userId: user._id,
    imageUrl: image,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Question submitted successfully',
    data: result,
  });
});

const getAllQuestions = catchAsync(async (req: Request, res: Response) => {
  const result = await AskImamService.getAllQuestionsFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Questions fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getMyQuestions = catchAsync(async (req: Request, res: Response) => {
  const { user } = req as any;
  const result = await AskImamService.getMyQuestionsFromDB(user._id, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your questions fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const answerQuestion = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { answer } = req.body;

  const result = await AskImamService.answerQuestionInDB(questionId, answer);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Question answered successfully',
    data: result,
  });
});

const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await AskImamService.getAnalyticsFromDB();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Analytics fetched successfully',
    data: result,
  });
});

export const AskImamController = {
  submitQuestion,
  getAllQuestions,
  getMyQuestions,
  answerQuestion,
  getAnalytics,
};
