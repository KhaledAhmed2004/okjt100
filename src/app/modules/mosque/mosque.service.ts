import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IMosque } from './mosque.interface';
import Mosque from './mosque.model';

const createMosqueIntoDB = async (payload: IMosque) => {
  const result = await Mosque.create(payload);
  return result;
};

const getAllMosquesFromDB = async (query: Record<string, unknown>) => {
  const mosqueQuery = new QueryBuilder(Mosque.find(), query)
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await mosqueQuery.modelQuery;
  const pagination = await mosqueQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const getSingleMosqueFromDB = async (id: string) => {
  const result = await Mosque.findById(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mosque not found');
  }
  return result;
};

const updateMosqueIntoDB = async (id: string, payload: Partial<IMosque>) => {
  const { location, prayerTimes, ...remainingData } = payload;

  const modifiedUpdatedData: Record<string, unknown> = { ...remainingData };

  if (location && Object.keys(location).length > 0) {
    for (const [key, value] of Object.entries(location)) {
      modifiedUpdatedData[`location.${key}`] = value;
    }
  }

  if (prayerTimes && Object.keys(prayerTimes).length > 0) {
    for (const [key, value] of Object.entries(prayerTimes)) {
      modifiedUpdatedData[`prayerTimes.${key}`] = value;
    }
  }

  const result = await Mosque.findByIdAndUpdate(id, modifiedUpdatedData, {
    new: true,
    runValidators: true,
  }).lean();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mosque not found');
  }
  return result;
};

const deleteMosqueFromDB = async (id: string) => {
  const result = await Mosque.findByIdAndDelete(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mosque not found');
  }
  return result;
};

export const MosqueService = {
  createMosqueIntoDB,
  getAllMosquesFromDB,
  getSingleMosqueFromDB,
  updateMosqueIntoDB,
  deleteMosqueFromDB,
};
