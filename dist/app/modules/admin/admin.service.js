"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const user_1 = require("../../../enums/user");
const user_model_1 = require("../user/user.model");
const khutbah_model_1 = __importDefault(require("../khutbah/khutbah.model"));
const ask_question_model_1 = __importDefault(require("../ask-question/ask-question.model"));
const support_ticket_model_1 = require("../support-ticket/support-ticket.model");
const formatMetric = (stat) => ({
    value: stat.total,
    changePct: stat.growth,
    direction: stat.growthType === 'increase'
        ? 'up'
        : stat.growthType === 'decrease'
            ? 'down'
            : 'neutral',
});
const getAdminDashboardStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const questionBuilder = new AggregationBuilder_1.default(ask_question_model_1.default);
    const khutbaBuilder = new AggregationBuilder_1.default(khutbah_model_1.default);
    const [totalUsers, activeUsers, pendingVerification, activeQuestions, uploadedKhutba,] = yield Promise.all([
        userBuilder.calculateGrowth({ period: 'month' }),
        userBuilder.calculateGrowth({ filter: { status: user_1.USER_STATUS.ACTIVE }, period: 'month' }),
        userBuilder.calculateGrowth({ filter: { status: user_1.USER_STATUS.PENDING }, period: 'month' }),
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
});
const getRecentActivities = () => __awaiter(void 0, void 0, void 0, function* () {
    const [recentUsers, recentQuestions, recentKhutbahs, recentTickets] = yield Promise.all([
        user_model_1.User.find({ deletedAt: { $exists: false } })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name role status profileImage createdAt')
            .lean(),
        ask_question_model_1.default.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('question status createdAt userId')
            .populate('userId', 'name')
            .lean(),
        khutbah_model_1.default.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('title mosqueName createdAt thumbnailUrl')
            .lean(),
        support_ticket_model_1.SupportTicket.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('subject status ticketNumber createdAt')
            .lean()
    ]);
    const activities = [
        ...recentUsers.map((user) => ({
            id: user._id,
            type: 'REGISTRATION',
            title: `${user.name} registered as a ${user.role}`,
            status: user.status,
            timestamp: user.createdAt,
            image: user.profileImage,
        })),
        ...recentQuestions.map((q) => {
            var _a;
            return ({
                id: q._id,
                type: 'QUESTION_ASKED',
                title: `Question asked by ${((_a = q.userId) === null || _a === void 0 ? void 0 : _a.name) || 'User'}: ${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}`,
                status: q.status,
                timestamp: q.createdAt,
            });
        }),
        ...recentKhutbahs.map((k) => ({
            id: k._id,
            type: 'KHUTBAH_UPLOADED',
            title: `Khutbah uploaded: ${k.title} at ${k.mosqueName}`,
            status: 'active',
            timestamp: k.createdAt,
            image: k.thumbnailUrl,
        })),
        ...recentTickets.map((t) => ({
            id: t._id,
            type: 'SUPPORT_TICKET',
            title: `Support Ticket Opened: #${t.ticketNumber} - ${t.subject}`,
            status: t.status,
            timestamp: t.createdAt,
        }))
    ];
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
});
exports.AdminService = {
    getAdminDashboardStats,
    getRecentActivities,
};
