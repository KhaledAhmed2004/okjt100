import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ConnectionService } from './connection.service';
import { CONNECTION_ACTION } from './connection.constants';
import { JwtPayload } from 'jsonwebtoken';

const sendConnectionRequest = catchAsync(async (req: Request, res: Response) => {
  const senderId = (req.user as JwtPayload).id;
  const receiverId = req.body.receiverId;

  const result = await ConnectionService.sendConnectionRequest(senderId, receiverId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Connection request sent successfully',
    data: result,
  });
});

const acceptConnection = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  const result = await ConnectionService.respondToConnectionRequest(
    connectionId,
    userId,
    CONNECTION_ACTION.ACCEPTED
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection request accepted successfully',
    data: result,
  });
});

const rejectConnection = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  const result = await ConnectionService.respondToConnectionRequest(
    connectionId,
    userId,
    CONNECTION_ACTION.REJECTED
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection request rejected successfully',
    data: result,
  });
});

const cancelConnectionRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  const result = await ConnectionService.cancelConnectionRequest(connectionId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection request cancelled successfully',
    data: result,
  });
});

const removeConnection = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const connectionId = req.params.connectionId;

  const result = await ConnectionService.removeConnection(connectionId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connection removed successfully',
    data: result,
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

const getPendingConnectionRequests = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const direction = (req.query.direction as 'sent' | 'received') || 'received';

  // Clone query and remove 'direction' so QueryBuilder doesn't try to filter the DB by it
  const queryObj = { ...req.query };
  delete queryObj.direction;

  const result = await ConnectionService.getPendingConnectionRequests(userId, direction, queryObj);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: direction === 'sent' ? 'Sent connection requests fetched successfully' : 'Received connection requests fetched successfully',
    data: result.data,
    meta: result.pagination,
  });
});

export const ConnectionController = {
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  cancelConnectionRequest,
  removeConnection,
  getMyConnections,
  getPendingConnectionRequests,
};
