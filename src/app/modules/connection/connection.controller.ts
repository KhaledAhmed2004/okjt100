import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ConnectionService } from './connection.service';
import { JwtPayload } from 'jsonwebtoken';

const sendRequest = catchAsync(async (req: Request, res: Response) => {
  const senderId = (req.user as JwtPayload).id;
  const receiverId = req.params.userId;

  const result = await ConnectionService.sendRequest(senderId, receiverId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Connection request sent successfully',
    data: result,
  });
});

const respondToRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;
  const action = req.body.action;

  const result = await ConnectionService.respondToRequest(connectionId, userId, action);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Connection request ${action.toLowerCase()}ed successfully`,
    data: result,
  });
});

const cancelRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  await ConnectionService.cancelRequest(connectionId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection request cancelled successfully',
  });
});

const removeConnection = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  await ConnectionService.removeConnection(connectionId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection removed successfully',
  });
});

const getMyConnections = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const result = await ConnectionService.getMyConnections(userId, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connections retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getPendingRequests = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const type = (req.query.type as 'sent' | 'received') || 'received';
  
  const result = await ConnectionService.getPendingRequests(userId, type, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pending requests retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getConnectionStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const otherUserId = req.params.userId;

  const result = await ConnectionService.getConnectionStatus(userId, otherUserId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection status retrieved successfully',
    data: result,
  });
});

export const ConnectionController = {
  sendRequest,
  respondToRequest,
  cancelRequest,
  removeConnection,
  getMyConnections,
  getPendingRequests,
  getConnectionStatus,
};
