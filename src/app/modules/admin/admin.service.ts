import AggregationBuilder from '../../builder/AggregationBuilder';
import { USER_STATUS } from '../../../enums/user';
import { User } from '../user/user.model';
import KhutbaModel from '../khutbah/khutbah.model';
import AskQuestion from '../ask-question/ask-question.model';
import { SupportTicket } from '../support-ticket/support-ticket.model';

const formatMetric = (stat: any) => ({
  value: stat.total,
  changePct: stat.growth,
  direction:
    stat.growthType === 'increase'
      ? 'up'
      : stat.growthType === 'decrease'
        ? 'down'
        : 'neutral',
});

const getAdminDashboardStats = async () => {
  const userBuilder = new AggregationBuilder(User);
  const questionBuilder = new AggregationBuilder(AskQuestion);
  const khutbaBuilder = new AggregationBuilder(KhutbaModel);

  const [
    totalUsers,
    activeUsers,
    pendingVerification,
    activeQuestions,
    uploadedKhutba,
  ] = await Promise.all([
    userBuilder.calculateGrowth({ period: 'month' }),
    userBuilder.calculateGrowth({ filter: { status: USER_STATUS.ACTIVE }, period: 'month' }),
    userBuilder.calculateGrowth({ filter: { status: USER_STATUS.PENDING }, period: 'month' }),
    questionBuilder.calculateGrowth({ filter: { status: 'pending' }, period: 'month' }),
    khutbaBuilder.calculateGrowth({ period: 'month' })
  ]);

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
  const [recentUsers, recentQuestions, recentKhutbahs, recentTickets] = await Promise.all([
    User.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name role status profileImage createdAt')
      .lean(),
    AskQuestion.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('question status createdAt userId')
      .populate('userId', 'name')
      .lean(),
    KhutbaModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title mosqueName createdAt thumbnailUrl')
      .lean(),
    SupportTicket.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('subject status ticketNumber createdAt')
      .lean()
  ]);

  const activities: any[] = [
    ...recentUsers.map((user: any) => ({
      id: user._id,
      type: 'REGISTRATION',
      title: `${user.name} registered as a ${user.role}`,
      status: user.status,
      timestamp: user.createdAt,
      image: user.profileImage,
    })),
    ...recentQuestions.map((q: any) => ({
      id: q._id,
      type: 'QUESTION_ASKED',
      title: `Question asked by ${q.userId?.name || 'User'}: ${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}`,
      status: q.status,
      timestamp: q.createdAt,
    })),
    ...recentKhutbahs.map((k: any) => ({
      id: k._id,
      type: 'KHUTBAH_UPLOADED',
      title: `Khutbah uploaded: ${k.title} at ${k.mosqueName}`,
      status: 'active',
      timestamp: k.createdAt,
      image: k.thumbnailUrl,
    })),
    ...recentTickets.map((t: any) => ({
      id: t._id,
      type: 'SUPPORT_TICKET',
      title: `Support Ticket Opened: #${t.ticketNumber} - ${t.subject}`,
      status: t.status,
      timestamp: t.createdAt,
    }))
  ];

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
};

export const AdminService = {
  getAdminDashboardStats,
  getRecentActivities,
};
