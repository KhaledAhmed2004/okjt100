import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { calculateDistance } from '../../helpers/distanceHelper';
import { IMosque } from './mosque.interface';
import Mosque from './mosque.model';

const createMosqueIntoDB = async (payload: IMosque) => {
  const result = await Mosque.create(payload);
  return result;
};

const getAllMosquesFromDB = async (query: Record<string, unknown>) => {
  const { latitude, longitude } = query;

  const mosqueQuery = new QueryBuilder(Mosque.find().lean(), query)
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = (await mosqueQuery.modelQuery) as IMosque[];
  const pagination = await mosqueQuery.getPaginationInfo();

  if (latitude && longitude) {
    const userLat = parseFloat(latitude as string);
    const userLng = parseFloat(longitude as string);

    if (!isNaN(userLat) && !isNaN(userLng)) {
      data.forEach(mosque => {
        if (
          mosque.location &&
          mosque.location.latitude &&
          mosque.location.longitude
        ) {
          mosque.distanceInKm = calculateDistance(
            userLat,
            userLng,
            mosque.location.latitude,
            mosque.location.longitude,
          );
        }
      });
    }
  }

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
