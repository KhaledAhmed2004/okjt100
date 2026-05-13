import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import AggregationBuilder from '../../builder/AggregationBuilder';
import { USER_STATUS } from '../../../enums/user';
import { User } from '../user/user.model';
import KhutbaModel from '../khutbah/khutbah.model';
import AskQuestion from '../ask-question/ask-question.model';

const getAdminDashboardStats = async () => {
  const userBuilder = new AggregationBuilder(User as any);
  
  // 1. Total Users
  const totalUsers = await userBuilder.calculateGrowth({
    period: 'month',
  });

  // 2. Active Users
  const activeUsers = await userBuilder.calculateGrowth({
    filter: { status: USER_STATUS.ACTIVE },
    period: 'month',
  });

  // 3. Pending Verification (Users waiting for approval)
  const pendingVerification = await userBuilder.calculateGrowth({
    filter: { status: USER_STATUS.PENDING },
    period: 'month',
  });

  // 4. Active Questions (Pending answers)
  const questionBuilder = new AggregationBuilder(AskQuestion as any);
  const activeQuestions = await questionBuilder.calculateGrowth({
    filter: { status: 'pending' },
    period: 'month',
  });

  // 5. Uploaded Khutba
  const khutbaBuilder = new AggregationBuilder(KhutbaModel as any);
  const uploadedKhutba = await khutbaBuilder.calculateGrowth({
    period: 'month',
  });

  const formatMetric = (stat: any) => ({
    value: stat.total,
    changePct: stat.growth,
    direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
  });

  return {
    meta: {
      comparisonPeriod: 'month',
    },
    totalUsers: formatMetric(totalUsers),
    activeUsers: formatMetric(activeUsers),
    pendingVerification: formatMetric(pendingVerification),
    activeQuestions: formatMetric(activeQuestions),
    uploadedKhutba: formatMetric(uploadedKhutba),
  };
};

const getRecentActivities = async () => {
  const recentUsers = await User.find({
    deletedAt: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('name role status profileImage createdAt')
    .lean();

  const activities = recentUsers.map((user) => ({
    id: user._id,
    type: 'REGISTRATION',
    title: `${user.name} registered as a ${user.role}`,
    status: user.status,
    timestamp: user.createdAt,
    image: user.profileImage,
  }));

  return activities;
};

export const AdminService = {
  getAdminDashboardStats,
  getRecentActivities,
};
