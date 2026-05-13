import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IMosque } from './mosque.interface';
import Mosque from './mosque.model';

const createMosqueIntoDB = async (payload: IMosque) => {
  // Transform legacy location format if provided
  const loc = payload.location as any;
  if (loc && loc.latitude !== undefined && loc.longitude !== undefined) {
    payload.location = {
      type: 'Point',
      coordinates: [loc.longitude, loc.latitude],
    } as any;
  }

  const result = await Mosque.create(payload);
  return result;
};

const getAllMosquesFromDB = async (query: Record<string, unknown>) => {
  const { 
    latitude, 
    longitude, 
    searchTerm, 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc', 
    ...filters 
  } = query;

  const match: Record<string, any> = { ...filters };
  if (searchTerm) {
    match.$or = [
      { mosqueName: { $regex: searchTerm, $options: 'i' } },
      { area: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const pipeline: PipelineStage[] = [];

  // 1. Proximity Search
  if (latitude && longitude) {
    const userLat = parseFloat(latitude as string);
    const userLng = parseFloat(longitude as string);

    if (!isNaN(userLat) && !isNaN(userLng)) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [userLng, userLat] },
          distanceField: 'distanceInKm',
          spherical: true,
          distanceMultiplier: 0.001,
          query: match,
        },
      });
    } else {
      pipeline.push({ $match: match });
    }
  } else {
    pipeline.push({ $match: match });
    const sortField = sortBy as string;
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortDir } });
  }

  // 2. Projection (Flatten for UI)
  pipeline.push({
    $project: {
      mosqueName: 1,
      address: 1,
      area: 1,
      phoneNumber: 1,
      website: 1,
      prayerTimes: 1,
      latitude: { $arrayElemAt: ['$location.coordinates', 1] },
      longitude: { $arrayElemAt: ['$location.coordinates', 0] },
      distanceInKm: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  });

  // 3. Pagination
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: Number(limit) }],
      totalCount: [{ $count: 'total' }],
    },
  });

  const result = await Mosque.aggregate(pipeline);
  const data = result[0].data;
  const total = result[0].totalCount[0]?.total || 0;
  const totalPages = Math.ceil(total / Number(limit));

  return {
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    },
  };
};

const getSingleMosqueFromDB = async (id: string) => {
  const result = await Mosque.findById(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mosque not found');
  }

  // Flatten location for consistency with list API
  if (result.location && result.location.coordinates) {
    (result as any).latitude = result.location.coordinates[1];
    (result as any).longitude = result.location.coordinates[0];
    delete result.location;
  }

  return result;
};

const updateMosqueIntoDB = async (id: string, payload: Partial<IMosque>) => {
  const { location, prayerTimes, ...remainingData } = payload;

  const modifiedUpdatedData: Record<string, unknown> = { ...remainingData };

  if (location) {
    const { latitude, longitude, ...remainingLocation } = location as any;
    if (latitude !== undefined && longitude !== undefined) {
      modifiedUpdatedData['location'] = {
        ...remainingLocation,
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    } else {
      for (const [key, value] of Object.entries(location)) {
        modifiedUpdatedData[`location.${key}`] = value;
      }
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
