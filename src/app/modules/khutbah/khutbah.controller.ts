import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { KhutbaService } from './khutbah.service';

const createKhutba = catchAsync(async (req: Request, res: Response) => {
  const { audio, thumbnail, ...rest } = req.body;

  const result = await KhutbaService.createKhutbaIntoDB({
    ...rest,
    audioUrl: audio,
    thumbnailUrl: thumbnail,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Khutba created successfully',
    data: result,
  });
});

const getAllKhutbahs = catchAsync(async (req: Request, res: Response) => {
  const result = await KhutbaService.getAllKhutbahsFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Khutbahs fetched successfully',
    meta: result.pagination,
    data: result.data,
  });
});

const getSingleKhutba = catchAsync(async (req: Request, res: Response) => {
  const { khutbaId } = req.params;
  const result = await KhutbaService.getSingleKhutbaFromDB(khutbaId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Khutba fetched successfully',
    data: result,
  });
});

const updateKhutba = catchAsync(async (req: Request, res: Response) => {
  const { khutbaId } = req.params;
  const { audio, thumbnail, ...rest } = req.body;

  const updateData: any = { ...rest };
  if (audio) updateData.audioUrl = audio;
  if (thumbnail) updateData.thumbnailUrl = thumbnail;

  const result = await KhutbaService.updateKhutbaInDB(khutbaId, updateData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Khutba updated successfully',
    data: result,
  });
});

const deleteKhutba = catchAsync(async (req: Request, res: Response) => {
  const { khutbaId } = req.params;
  const result = await KhutbaService.deleteKhutbaFromDB(khutbaId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Khutba deleted successfully',
    data: result,
  });
});

export const KhutbaController = {
  createKhutba,
  getAllKhutbahs,
  getSingleKhutba,
  updateKhutba,
  deleteKhutba,
};
