import { PipelineStage } from 'mongoose';
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
    filter, // 'nearby-me'
    page = 1, 
    limit = 10, 
    ...filters 
  } = query;

  const match: Record<string, any> = { ...filters };
  if (searchTerm) {
    match.$or = [
      { mosqueName: { $regex: searchTerm, $options: 'i' } },
      { area: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const pipeline: PipelineStage[] = [];

  // 1. Proximity Search & Sorting Logic
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

      // If NOT explicitly nearby-me, sort by createdAt but keep distanceInKm
      if (filter !== 'nearby-me') {
        pipeline.push({ $sort: { createdAt: -1 } });
      }
    } else {
      pipeline.push({ $match: match });
      pipeline.push({ $sort: { createdAt: -1 } });
    }
  } else {
    pipeline.push({ $match: match });
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // 2. Projection (Flatten for UI)
  pipeline.push({
    $project: {
      _id: 1,
      id: '$_id',
      mosqueName: 1,
      address: 1,
      area: 1,
      phoneNumber: { $ifNull: ['$phoneNumber', ''] },
      website: { $ifNull: ['$website', ''] },
      description: { $ifNull: ['$description', ''] },
      image: { $ifNull: ['$image', ''] },
      prayerTimes: 1,
      distanceInKm: 1,
      updatedAt: 1,
      latitude: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 1] }, 0] },
      longitude: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 0] }, 0] },
      mapLink: {
        $concat: [
          'https://www.google.com/maps/search/?api=1&query=',
          { $toString: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 1] }, 0] } },
          ',',
          { $toString: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 0] }, 0] } },
        ],
      },
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

  // Ensure fields exist for consistency
  (result as any).id = result._id;
  (result as any).phoneNumber = result.phoneNumber || '';
  (result as any).website = result.website || '';
  (result as any).description = result.description || '';
  (result as any).image = result.image || '';

  // Flatten location for consistency with list API
  if (result.location && result.location.coordinates) {
    const latitude = result.location.coordinates[1];
    const longitude = result.location.coordinates[0];
    (result as any).latitude = latitude;
    (result as any).longitude = longitude;
    (result as any).mapLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    delete (result as any).location;
  } else {
    (result as any).latitude = 0;
    (result as any).longitude = 0;
    (result as any).mapLink = `https://www.google.com/maps/search/?api=1&query=0,0`;
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
