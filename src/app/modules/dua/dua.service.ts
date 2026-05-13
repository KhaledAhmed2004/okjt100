import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IDua } from './dua.interface';
import DuaModel from './dua.model';

const createDuaIntoDB = async (payload: Partial<IDua>) => {
  const result = await DuaModel.create(payload);
  return result;
};

const getAllDuasFromDB = async (query: Record<string, unknown>) => {
  const duaQuery = new QueryBuilder(DuaModel.find({ isDeleted: false }), query)
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await duaQuery.modelQuery;
  const pagination = await duaQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const getSingleDuaFromDB = async (id: string) => {
  const result = await DuaModel.findOne({ _id: id, isDeleted: false });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dua not found');
  }
  return result;
};

const updateDuaInDB = async (id: string, payload: Partial<IDua>) => {
  const isExist = await DuaModel.findOne({ _id: id, isDeleted: false });
  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dua not found');
  }

  const result = await DuaModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  return result;
};

const deleteDuaFromDB = async (id: string) => {
  const isExist = await DuaModel.findOne({ _id: id, isDeleted: false });
  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dua not found');
  }

  const result = await DuaModel.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );
  return result;
};

export const DuaService = {
  createDuaIntoDB,
  getAllDuasFromDB,
  getSingleDuaFromDB,
  updateDuaInDB,
  deleteDuaFromDB,
};
