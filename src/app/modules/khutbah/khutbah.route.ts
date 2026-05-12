import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { KhutbaController } from './khutbah.controller';
import { KhutbaValidation } from './khutbah.validation';

const router = express.Router();

router.get('/', KhutbaController.getAllKhutbahs);

router.get('/:khutbaId', KhutbaController.getSingleKhutba);

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  fileHandler([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ], { maxFileSizeMB: 100 }),
  validateRequest(KhutbaValidation.createKhutbaZodSchema),
  KhutbaController.createKhutba,
);

router.patch(
  '/:khutbaId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  fileHandler([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ], { maxFileSizeMB: 100 }),
  validateRequest(KhutbaValidation.updateKhutbaZodSchema),
  KhutbaController.updateKhutba,
);

router.delete(
  '/:khutbaId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  KhutbaController.deleteKhutba,
);

export const KhutbaRoutes = router;
