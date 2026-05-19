import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AskQuestionService } from './ask-question.service';

const submitQuestion = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { image, ...rest } = req.body;

  // Securing data by taking userId and userRole directly from verified token
  const result = await AskQuestionService.submitQuestionIntoDB({
    ...rest,
    userId: user.id as string,
    userRole: user.role as 'BROTHER' | 'SISTER',
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
  const result = await AskQuestionService.getAllQuestionsFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Questions fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getMyQuestions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await AskQuestionService.getMyQuestionsFromDB(
    user.id as string,
    req.query,
  );

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

  const result = await AskQuestionService.answerQuestionInDB(
    questionId,
    answer,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Question answered successfully',
    data: result,
  });
});

const getQuestionMetrics = catchAsync(async (req: Request, res: Response) => {
  const result = await AskQuestionService.getQuestionMetricsFromDB();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Question metrics retrieved',
    data: result,
  });
});

export const AskQuestionController = {
  submitQuestion,
  getAllQuestions,
  getMyQuestions,
  answerQuestion,
  getQuestionMetrics,
};
