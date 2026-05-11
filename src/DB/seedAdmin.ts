import { User } from '../app/modules/user/user.model';
import config from '../config';
import { USER_ROLES, USER_STATUS } from '../enums/user';
import { logger } from '../shared/logger';

const payload = {
  fullName: 'Administrator',
  email: config.super_admin.email,
  role: USER_ROLES.SUPER_ADMIN,
  password: config.super_admin.password,
  revertDuration: 'N/A',
  dateOfBirth: '1970-01-01',
  verificationImage: 'https://i.ibb.co/z5YHLV9/profile.png',
  verificationVideo: 'https://i.ibb.co/z5YHLV9/profile.png',
  isVerified: true,
  status: USER_STATUS.ACTIVE,
};

export const seedSuperAdmin = async () => {
  const isExistSuperAdmin = await User.findOne({
    email: config.super_admin.email,
    role: USER_ROLES.SUPER_ADMIN,
  });
  if (!isExistSuperAdmin) {
    await User.create(payload);
    logger.info('✨ Super Admin account has been successfully created!');
  }
};
