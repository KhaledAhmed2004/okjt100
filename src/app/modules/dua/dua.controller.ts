import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { DuaService } from './dua.service';

const createDua = catchAsync(async (req: Request, res: Response) => {
  const { audio, ...rest } = req.body;

  const result = await DuaService.createDuaIntoDB({
    ...rest,
    audioUrl: audio,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Dua created successfully',
    data: result,
  });
});

const getAllDuas = catchAsync(async (req: Request, res: Response) => {
  const result = await DuaService.getAllDuasFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Duas fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getSingleDua = catchAsync(async (req: Request, res: Response) => {
  const { duaId } = req.params;
  const result = await DuaService.getSingleDuaFromDB(duaId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Dua fetched successfully',
    data: result,
  });
});

const updateDua = catchAsync(async (req: Request, res: Response) => {
  const { duaId } = req.params;
  const { audio, ...rest } = req.body;

  const updateData: any = { ...rest };
  if (audio) updateData.audioUrl = audio;

  const result = await DuaService.updateDuaInDB(duaId, updateData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Dua updated successfully',
    data: result,
  });
});

const deleteDua = catchAsync(async (req: Request, res: Response) => {
  const { duaId } = req.params;
  const result = await DuaService.deleteDuaFromDB(duaId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Dua deleted successfully',
    data: result,
  });
});

export const DuaController = {
  createDua,
  getAllDuas,
  getSingleDua,
  updateDua,
  deleteDua,
};
