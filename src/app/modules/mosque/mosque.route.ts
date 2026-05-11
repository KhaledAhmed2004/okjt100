import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { MosqueController } from './mosque.controller';
import { MosqueValidation } from './mosque.validation';

const router = express.Router();

router.get('/', MosqueController.getAllMosques);

router.get('/:mosqueId', MosqueController.getSingleMosque);

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(MosqueValidation.createMosqueZodSchema),
  MosqueController.createMosque,
);

router.patch(
  '/:mosqueId',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(MosqueValidation.updateMosqueZodSchema),
  MosqueController.updateMosque,
);

router.delete(
  '/:mosqueId',
  auth(USER_ROLES.SUPER_ADMIN),
  MosqueController.deleteMosque,
);

export const MosqueRoutes = router;
