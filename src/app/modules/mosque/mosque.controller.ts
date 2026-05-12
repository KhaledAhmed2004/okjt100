import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { MosqueService } from './mosque.service';

const createMosque = catchAsync(async (req: Request, res: Response) => {
  const result = await MosqueService.createMosqueIntoDB(req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Mosque created successfully',
    data: result,
  });
});

const getAllMosques = catchAsync(async (req: Request, res: Response) => {
  const result = await MosqueService.getAllMosquesFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Mosques fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getSingleMosque = catchAsync(async (req: Request, res: Response) => {
  const { mosqueId } = req.params;
  const result = await MosqueService.getSingleMosqueFromDB(mosqueId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Mosque fetched successfully',
    data: result,
  });
});

const updateMosque = catchAsync(async (req: Request, res: Response) => {
  const { mosqueId } = req.params;
  const result = await MosqueService.updateMosqueIntoDB(mosqueId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Mosque updated successfully',
    data: result,
  });
});

const deleteMosque = catchAsync(async (req: Request, res: Response) => {
  const { mosqueId } = req.params;
  const result = await MosqueService.deleteMosqueFromDB(mosqueId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Mosque deleted successfully',
    data: { id: result?._id },
  });
});

export const MosqueController = {
  createMosque,
  getAllMosques,
  getSingleMosque,
  updateMosque,
  deleteMosque,
};
