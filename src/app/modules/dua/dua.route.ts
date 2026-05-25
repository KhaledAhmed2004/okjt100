import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { DuaController } from './dua.controller';
import { DuaValidation } from './dua.validation';

const router = express.Router();

router.get('/', DuaController.getAllDuas);

router.get('/:duaId', DuaController.getSingleDua);

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler([{ name: 'audio', maxCount: 1 }], { maxFileSizeMB: 100 }),
  validateRequest(DuaValidation.createDuaZodSchema),
  DuaController.createDua,
);

router.patch(
  '/:duaId',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler([{ name: 'audio', maxCount: 1 }], { maxFileSizeMB: 100 }),
  validateRequest(DuaValidation.updateDuaZodSchema),
  DuaController.updateDua,
);

router.delete('/:duaId', auth(USER_ROLES.SUPER_ADMIN), DuaController.deleteDua);

export const DuaRoutes = router;
