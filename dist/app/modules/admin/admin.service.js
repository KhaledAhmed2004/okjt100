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
const user_model_1 = require("../user/user.model");
// import { PreferenceCardModel } from '../preference-card/preference-card.model';
const subscription_model_1 = require("../subscription/subscription.model");
const subscription_interface_1 = require("../subscription/subscription.interface");
const getAdminDashboardStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const doctorBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const doctors = yield doctorBuilder.calculateGrowth({
        period: 'month',
    });
    // Total preference cards
    // const cardBuilder = new AggregationBuilder(PreferenceCardModel as any);
    // const preferenceCards = await cardBuilder.calculateGrowth({
    //   period: 'month',
    // });
    // // Verified (published) preference cards
    // const verifiedPreferenceCards = await cardBuilder.calculateGrowth({
    //   filter: { published: true },
    //   period: 'month',
    // });
    const preferenceCards = { total: 0, growth: 0, growthType: 'neutral' };
    const verifiedPreferenceCards = { total: 0, growth: 0, growthType: 'neutral' };
    // Active subscriptions
    const subBuilder = new AggregationBuilder_1.default(subscription_model_1.Subscription);
    const activeSubscriptions = yield subBuilder.calculateGrowth({
        filter: { status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE },
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
        doctors: formatMetric(doctors),
        preferenceCards: formatMetric(preferenceCards),
        verifiedPreferenceCards: formatMetric(verifiedPreferenceCards),
        activeSubscriptions: formatMetric(activeSubscriptions),
    };
});
// Helper for monthly trends with YoY and Peak/Slowest analysis
const getMonthlyTrendAnalytics = (Model_1, query_1, ...args_1) => __awaiter(void 0, [Model_1, query_1, ...args_1], void 0, function* (Model, query, filter = {}) {
    const { year, from, to } = query;
    const now = new Date();
    const targetYear = year ? Number(year) : now.getFullYear();
    const compareYear = targetYear - 1;
    const builder = new AggregationBuilder_1.default(Model);
    // Current year trends
    const series = yield builder.getTimeTrends({
        timeUnit: 'month',
        year: targetYear,
        from,
        to,
        filter,
    });
    // Last year trends for comparison (YoY)
    builder.reset();
    const lastYearSeries = yield builder.getTimeTrends({
        timeUnit: 'month',
        year: compareYear,
        filter,
    });
    const formattedSeries = series.map((s, index) => {
        var _a;
        const lastYearCount = ((_a = lastYearSeries[index]) === null || _a === void 0 ? void 0 : _a.transactionCount) || 0;
        const currentCount = s.transactionCount;
        let yoyGrowthPct = 0;
        if (lastYearCount > 0) {
            yoyGrowthPct = ((currentCount - lastYearCount) / lastYearCount) * 100;
        }
        else if (currentCount > 0) {
            yoyGrowthPct = 100;
        }
        return {
            month: s.month,
            label: s.label,
            count: currentCount,
            lastYearCount,
            yoyGrowthPct: Number(yoyGrowthPct.toFixed(1)),
            isPeak: false,
            isSlowest: false,
        };
    });
    // Calculate Peak and Slowest
    const validCounts = formattedSeries.filter((s) => s.count > 0);
    if (validCounts.length > 0) {
        const maxCount = Math.max(...formattedSeries.map((s) => s.count));
        const minCount = Math.min(...validCounts.map((s) => s.count));
        formattedSeries.forEach((s) => {
            if (s.count === maxCount && maxCount > 0)
                s.isPeak = true;
            if (s.count === minCount && minCount > 0)
                s.isSlowest = true;
        });
    }
    const totalCount = formattedSeries.reduce((acc, s) => acc + s.count, 0);
    const totalLastYearCount = formattedSeries.reduce((acc, s) => acc + s.lastYearCount, 0);
    const peakMonth = formattedSeries.find((s) => s.isPeak);
    const slowestMonth = formattedSeries.find((s) => s.isSlowest);
    let totalYoyGrowth = 0;
    if (totalLastYearCount > 0) {
        totalYoyGrowth =
            ((totalCount - totalLastYearCount) / totalLastYearCount) * 100;
    }
    return {
        meta: {
            year: targetYear,
            granularity: 'monthly',
            compareYear,
            timezone: 'UTC',
        },
        summary: {
            totalCount,
            periodAvg: Math.round(totalCount / 12),
            yoyGrowthPct: Number(totalYoyGrowth.toFixed(1)),
            peak: peakMonth
                ? { month: peakMonth.month, label: peakMonth.label, count: peakMonth.count }
                : null,
            slowest: slowestMonth
                ? { month: slowestMonth.month, label: slowestMonth.label, count: slowestMonth.count }
                : null,
        },
        series: formattedSeries,
    };
});
// Monthly trend for total preference cards
const getPreferenceCardMonthlyTrend = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // return await getMonthlyTrendAnalytics(PreferenceCardModel, query);
    return {
        meta: { year: 2026, granularity: 'monthly', compareYear: 2025, timezone: 'UTC' },
        summary: { totalCount: 0, periodAvg: 0, yoyGrowthPct: 0, peak: null, slowest: null },
        series: [],
    };
});
// Monthly trend for active subscriptions
const getActiveSubscriptionMonthlyTrend = (query) => __awaiter(void 0, void 0, void 0, function* () {
    return yield getMonthlyTrendAnalytics(subscription_model_1.Subscription, query, {
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
    });
});
exports.AdminService = {
    getAdminDashboardStats,
    getPreferenceCardMonthlyTrend,
    getActiveSubscriptionMonthlyTrend,
};
