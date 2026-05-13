import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IAskQuestion } from './ask-question.interface';
import AskQuestion from './ask-question.model';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';

import AggregationBuilder from '../../builder/AggregationBuilder';

const submitQuestionIntoDB = async (payload: Partial<IAskQuestion>) => {
  const result = await AskQuestion.create(payload);
  return result;
};

const getAllQuestionsFromDB = async (query: Record<string, unknown>) => {
  const questionQuery = new QueryBuilder(AskQuestion.find().populate('userId', 'name email'), query)
    .textSearch(['question'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await questionQuery.modelQuery;
  const pagination = await questionQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const getMyQuestionsFromDB = async (userId: string, query: Record<string, unknown>) => {
  const questionQuery = new QueryBuilder(AskQuestion.find({ userId }), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await questionQuery.modelQuery;
  const pagination = await questionQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const answerQuestionInDB = async (id: string, answer: string) => {
  const result = await AskQuestion.findByIdAndUpdate(
    id,
    {
      answer,
      status: 'answered',
      answeredAt: new Date(),
    },
    { new: true, runValidators: true },
  ).lean();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Question not found');
  }

  // Notify the user
  if (result.userId) {
    new NotificationBuilder()
      .to(result.userId.toString())
      .setTitle('Question Answered')
      .setText('An Imam has answered your question.')
      .setType('QUESTION_ANSWERED')
      .setResource('AskQuestion', id)
      .viaAll()
      .send()
      .catch(err => console.error('Notification Error:', err));
  }

  return result;
};

const getQuestionMetricsFromDB = async () => {
  const aggregationBuilder = new AggregationBuilder(AskQuestion);

  // Total questions growth
  const totalStats = await aggregationBuilder.calculateGrowth({ period: 'month' });

  // Answered questions growth
  aggregationBuilder.reset();
  const answeredStats = await aggregationBuilder.calculateGrowth({
    filter: { status: 'answered' },
    period: 'month',
  });

  // Pending questions growth
  aggregationBuilder.reset();
  const pendingStats = await aggregationBuilder.calculateGrowth({
    filter: { status: 'pending' },
    period: 'month',
  });

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

  return {
    meta: {
      comparisonPeriod: 'month',
    },
    totalQuestions: formatMetric(totalStats),
    answeredQuestions: formatMetric(answeredStats),
    pendingQuestions: formatMetric(pendingStats),
  };
};

export const AskQuestionService = {
  submitQuestionIntoDB,
  getAllQuestionsFromDB,
  getMyQuestionsFromDB,
  answerQuestionInDB,
  getQuestionMetricsFromDB,
};
