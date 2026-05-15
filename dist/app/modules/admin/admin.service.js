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
const getAdminDashboardStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    // 1. Total Users
    const totalUsers = yield userBuilder.calculateGrowth({
        period: 'month',
    });
    // 2. Active Users
    const activeUsers = yield userBuilder.calculateGrowth({
        filter: { status: user_1.USER_STATUS.ACTIVE },
        period: 'month',
    });
    // 3. Pending Verification (Users waiting for approval)
    const pendingVerification = yield userBuilder.calculateGrowth({
        filter: { status: user_1.USER_STATUS.PENDING },
        period: 'month',
    });
    // 4. Active Questions (Pending answers)
    const questionBuilder = new AggregationBuilder_1.default(ask_question_model_1.default);
    const activeQuestions = yield questionBuilder.calculateGrowth({
        filter: { status: 'pending' },
        period: 'month',
    });
    // 5. Uploaded Khutba
    const khutbaBuilder = new AggregationBuilder_1.default(khutbah_model_1.default);
    const uploadedKhutba = yield khutbaBuilder.calculateGrowth({
        period: 'month',
    });
    const formatMetric = (stat) => ({
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
});
const getRecentActivities = () => __awaiter(void 0, void 0, void 0, function* () {
    const recentUsers = yield user_model_1.User.find({
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
});
exports.AdminService = {
    getAdminDashboardStats,
    getRecentActivities,
};
