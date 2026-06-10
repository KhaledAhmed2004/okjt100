import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { NamazService } from './namaz.service';
import { TSalahType } from './namaz.interface';

const getSurahList = catchAsync(async (_req: Request, res: Response) => {
  const result = await NamazService.getSurahList();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Surah list fetched successfully',
    data: result,
  });
});

const upsertSalahConfig = catchAsync(async (req: Request, res: Response) => {
  const { salahType } = req.params as { salahType: TSalahType };
  const { rakats } = req.body as { rakats: { rakat: number; surahNumber: number }[] };

  const result = await NamazService.upsertSalahConfig(salahType, rakats);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Salah config saved successfully',
    data: result,
  });
});

const getAllSalahConfigs = catchAsync(async (_req: Request, res: Response) => {
  const result = await NamazService.getAllSalahConfigs();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Salah configs fetched successfully',
    data: result,
  });
});

const getPrayerGuide = catchAsync(async (req: Request, res: Response) => {
  const { salahType } = req.params as { salahType: TSalahType };

  const result = await NamazService.getPrayerGuide(salahType);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Prayer guide fetched successfully',
    data: result,
  });
});

export const NamazController = {
  getSurahList,
  upsertSalahConfig,
  getAllSalahConfigs,
  getPrayerGuide,
};
