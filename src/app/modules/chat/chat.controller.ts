import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { ChatService } from './chat.service';
import { JwtPayload } from 'jsonwebtoken';

const createChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const otherUser = req.params.otherUserId;

  const participants = [user?.id, otherUser];
  const chat = await ChatService.createChatToDB(participants);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Create Chat Successfully',
    data: chat,
  });
});

const getChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const searchTerm = req.query.searchTerm as string;
  const chatList = await ChatService.getChatFromDB(user, searchTerm);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat Retrieve Successfully',
    data: chatList,
  });
});

export const ChatController = {
  createChat,
  getChat,
};
