import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { PrayerTimeService } from './prayer-time.service';

const getPrayerTimes = catchAsync(async (req: Request, res: Response) => {
  const result = await PrayerTimeService.calculatePrayerTimes(req.query as any);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Prayer times retrieved successfully',
    data: result,
  });
});

export const PrayerTimeController = {
  getPrayerTimes,
};
