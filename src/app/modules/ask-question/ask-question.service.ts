import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IAskQuestion } from './ask-question.interface';
import AskQuestion from './ask-question.model';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';
import AggregationBuilder from '../../builder/AggregationBuilder';
import { validateObjectId } from '../../../shared/validateObjectId';
import { errorLogger } from '../../../shared/logger';

const submitQuestionIntoDB = async (payload: Partial<IAskQuestion>) => {
  const result = await AskQuestion.create(payload);
  return result;
};

const getAllQuestionsFromDB = async (query: Record<string, unknown>) => {
  const questionQuery = new QueryBuilder(
    AskQuestion.find().populate('userId', 'name email'),
    query,
  )
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await questionQuery.modelQuery;
  const pagination = await questionQuery.getPaginationInfo();

  return { data, pagination };
};

const getMyQuestionsFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const questionQuery = new QueryBuilder(AskQuestion.find({ userId }), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await questionQuery.modelQuery;
  const pagination = await questionQuery.getPaginationInfo();

  return { data, pagination };
};

const answerQuestionInDB = async (id: string, answer: string) => {
  // Guard: reject malformed ObjectIds before any DB call to prevent raw CastErrors
  validateObjectId(id, 'question ID');

  const question = await AskQuestion.findById(id);
  if (!question) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Question not found');
  }

  const isFirstAnswer = question.status === 'pending';

  // Deactivate the current active version (handles re-answers)
  question.answers.forEach(a => {
    a.isActive = false;
  });

  // Push new version — 1-indexed, always increments
  const nextVersion = question.answers.length + 1;
  question.answers.push({
    version:   nextVersion,
    text:      answer,
    isActive:  true,
    createdAt: new Date(),
  });

  // Flip status only on the first answer
  if (isFirstAnswer) {
    question.status = 'answered';
  }

  const result = await question.save();

  // Notify only on first answer — re-answers must not re-notify the user
  if (isFirstAnswer && question.userId) {
    new NotificationBuilder()
      .to(question.userId.toString())
      .setTitle('Question Answered')
      .setText('An Imam has answered your question.')
      .setType('QUESTION_ANSWERED')
      .setResource('AskQuestion', id)
      .viaAll()
      .send()
      .catch(err =>
        errorLogger.error('Failed to send QUESTION_ANSWERED notification', {
          questionId: id,
          recipientId: question.userId?.toString(),
          err,
        }),
      );
  }

  return result;
};

const getQuestionMetricsFromDB = async () => {
  const aggregationBuilder = new AggregationBuilder(AskQuestion);

  const totalStats = await aggregationBuilder.calculateGrowth({
    period: 'month',
  });

  const answeredStats = await aggregationBuilder.calculateGrowth({
    filter: { status: 'answered' },
    period: 'month',
  });

  const pendingStats = await aggregationBuilder.calculateGrowth({
    filter: { status: 'pending' },
    period: 'month',
  });

  const formatMetric = (stat: any) => ({
    value:      stat.total,
    changePct:  stat.growth,
    direction:
      stat.growthType === 'increase'
        ? 'up'
        : stat.growthType === 'decrease'
          ? 'down'
          : 'neutral',
  });

  return {
    meta: { comparisonPeriod: 'month' },
    totalQuestions:   formatMetric(totalStats),
    answeredQuestions: formatMetric(answeredStats),
    pendingQuestions:  formatMetric(pendingStats),
  };
};

export const AskQuestionService = {
  submitQuestionIntoDB,
  getAllQuestionsFromDB,
  getMyQuestionsFromDB,
  answerQuestionInDB,
  getQuestionMetricsFromDB,
};
