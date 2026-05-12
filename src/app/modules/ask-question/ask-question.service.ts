import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IAskQuestion } from './ask-question.interface';
import AskQuestion from './ask-question.model';

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
  return result;
};

const getAnalyticsFromDB = async () => {
  const total = await AskQuestion.countDocuments();
  const pending = await AskQuestion.countDocuments({ status: 'pending' });
  const answered = await AskQuestion.countDocuments({ status: 'answered' });

  return {
    total,
    pending,
    answered,
  };
};

export const AskQuestionService = {
  submitQuestionIntoDB,
  getAllQuestionsFromDB,
  getMyQuestionsFromDB,
  answerQuestionInDB,
  getAnalyticsFromDB,
};
