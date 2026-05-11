import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AdminService } from './admin.service';

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getAdminDashboardStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin dashboard metrics',
    data: result,
  });
});

const getPreferenceCardMonthly = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getPreferenceCardMonthlyTrend(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Preference card monthly trend',
    data: result,
  });
});

const getActiveSubscriptionMonthly = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getActiveSubscriptionMonthlyTrend(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Active subscription monthly trend',
    data: result,
  });
});

export const AdminController = {
  getDashboardStats,
  getPreferenceCardMonthly,
  getActiveSubscriptionMonthly,
};
