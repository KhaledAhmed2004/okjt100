import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IKhutba } from './khutbah.interface';
import KhutbaModel from './khutbah.model';
import NotificationBuilder from '../../builder/NotificationBuilder/NotificationBuilder';
import { USER_ROLES } from '../../../enums/user';

const createKhutbaIntoDB = async (payload: Partial<IKhutba>) => {
  const result = await KhutbaModel.create(payload);

  // Notify all users about new Khutbah
  new NotificationBuilder()
    .toRole(USER_ROLES.BROTHER)
    .setTitle('New Khutbah')
    .setText(`New Khutbah published: ${payload.title}`)
    .setType('NEW_KHUTBAH')
    .setResource('Khutbah', (result._id as any).toString())
    .viaAll()
    .send()
    .catch(err => console.error('Notification Error:', err));

  new NotificationBuilder()
    .toRole(USER_ROLES.SISTER)
    .setTitle('New Khutbah')
    .setText(`New Khutbah published: ${payload.title}`)
    .setType('NEW_KHUTBAH')
    .setResource('Khutbah', (result._id as any).toString())
    .viaAll()
    .send()
    .catch(err => console.error('Notification Error:', err));

  return result;
};

const getAllKhutbahsFromDB = async (query: Record<string, unknown>) => {
  const khutbaQuery = new QueryBuilder(KhutbaModel.find(), query)
    .textSearch()
    .filter()
    .sort()
    .paginate()
    .fields();

  if (!query.sort && !query.searchTerm) {
    khutbaQuery.modelQuery = khutbaQuery.modelQuery.sort('-date');
  }

  const data = await khutbaQuery.modelQuery;
  const pagination = await khutbaQuery.getPaginationInfo();

  return {
    data,
    pagination,
  };
};

const getSingleKhutbaFromDB = async (id: string) => {
  const result = await KhutbaModel.findById(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khutba not found');
  }
  return result;
};

const updateKhutbaInDB = async (id: string, payload: Partial<IKhutba>) => {
  const result = await KhutbaModel.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).lean();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khutba not found');
  }
  return result;
};

const deleteKhutbaFromDB = async (id: string) => {
  const result = await KhutbaModel.findByIdAndDelete(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khutba not found');
  }
  return result;
};

export const KhutbaService = {
  createKhutbaIntoDB,
  getAllKhutbahsFromDB,
  getSingleKhutbaFromDB,
  updateKhutbaInDB,
  deleteKhutbaFromDB,
};
