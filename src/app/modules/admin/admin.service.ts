import AggregationBuilder from '../../builder/AggregationBuilder';
import { User } from '../user/user.model';
// import { PreferenceCardModel } from '../preference-card/preference-card.model';
import { Subscription } from '../subscription/subscription.model';
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.interface';

const getAdminDashboardStats = async () => {
  const doctorBuilder = new AggregationBuilder(User as any);
  const doctors = await doctorBuilder.calculateGrowth({
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
  const subBuilder = new AggregationBuilder(Subscription as any);
  const activeSubscriptions = await subBuilder.calculateGrowth({
    filter: { status: SUBSCRIPTION_STATUS.ACTIVE },
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
    doctors: formatMetric(doctors),
    preferenceCards: formatMetric(preferenceCards),
    verifiedPreferenceCards: formatMetric(verifiedPreferenceCards),
    activeSubscriptions: formatMetric(activeSubscriptions),
  };
};

// Helper for monthly trends with YoY and Peak/Slowest analysis
const getMonthlyTrendAnalytics = async (
  Model: any,
  query: Record<string, any>,
  filter: Record<string, any> = {},
) => {
  const { year, from, to } = query;
  const now = new Date();
  const targetYear = year ? Number(year) : now.getFullYear();
  const compareYear = targetYear - 1;

  const builder = new AggregationBuilder(Model);

  // Current year trends
  const series = await builder.getTimeTrends({
    timeUnit: 'month',
    year: targetYear,
    from,
    to,
    filter,
  });

  // Last year trends for comparison (YoY)
  builder.reset();
  const lastYearSeries = await builder.getTimeTrends({
    timeUnit: 'month',
    year: compareYear,
    filter,
  });

  const formattedSeries = series.map((s: any, index: number) => {
    const lastYearCount = lastYearSeries[index]?.transactionCount || 0;
    const currentCount = s.transactionCount;
    let yoyGrowthPct = 0;

    if (lastYearCount > 0) {
      yoyGrowthPct = ((currentCount - lastYearCount) / lastYearCount) * 100;
    } else if (currentCount > 0) {
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
  const validCounts = formattedSeries.filter((s: any) => s.count > 0);
  if (validCounts.length > 0) {
    const maxCount = Math.max(...formattedSeries.map((s: any) => s.count));
    const minCount = Math.min(...validCounts.map((s: any) => s.count));

    formattedSeries.forEach((s: any) => {
      if (s.count === maxCount && maxCount > 0) s.isPeak = true;
      if (s.count === minCount && minCount > 0) s.isSlowest = true;
    });
  }

  const totalCount = formattedSeries.reduce(
    (acc: number, s: any) => acc + s.count,
    0,
  );
  const totalLastYearCount = formattedSeries.reduce(
    (acc: number, s: any) => acc + s.lastYearCount,
    0,
  );
  const peakMonth = formattedSeries.find((s: any) => s.isPeak);
  const slowestMonth = formattedSeries.find((s: any) => s.isSlowest);

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
};

// Monthly trend for total preference cards
const getPreferenceCardMonthlyTrend = async (query: Record<string, any>) => {
  // return await getMonthlyTrendAnalytics(PreferenceCardModel, query);
  return {
    meta: { year: 2026, granularity: 'monthly', compareYear: 2025, timezone: 'UTC' },
    summary: { totalCount: 0, periodAvg: 0, yoyGrowthPct: 0, peak: null, slowest: null },
    series: [],
  };
};

// Monthly trend for active subscriptions
const getActiveSubscriptionMonthlyTrend = async (query: Record<string, any>) => {
  return await getMonthlyTrendAnalytics(Subscription, query, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });
};

export const AdminService = {
  getAdminDashboardStats,
  getPreferenceCardMonthlyTrend,
  getActiveSubscriptionMonthlyTrend,
};
