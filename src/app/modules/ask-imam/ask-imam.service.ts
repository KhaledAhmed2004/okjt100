import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IAskImam } from './ask-imam.interface';
import AskImam from './ask-imam.model';

const submitQuestionIntoDB = async (payload: Partial<IAskImam>) => {
  const result = await AskImam.create(payload);
  return result;
};

const getAllQuestionsFromDB = async (query: Record<string, unknown>) => {
  const questionQuery = new QueryBuilder(AskImam.find().populate('userId', 'name email'), query)
    .textSearch()
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
  const questionQuery = new QueryBuilder(AskImam.find({ userId }), query)
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
  const result = await AskImam.findByIdAndUpdate(
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
  const total = await AskImam.countDocuments();
  const pending = await AskImam.countDocuments({ status: 'pending' });
  const answered = await AskImam.countDocuments({ status: 'answered' });

  return {
    total,
    pending,
    answered,
  };
};

export const AskImamService = {
  submitQuestionIntoDB,
  getAllQuestionsFromDB,
  getMyQuestionsFromDB,
  answerQuestionInDB,
  getAnalyticsFromDB,
};
