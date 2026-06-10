import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { NamazController } from './namaz.controller';
import { NamazValidation } from './namaz.validation';

const router = express.Router();

router.get('/surah-list', NamazController.getSurahList);

router.put(
  '/salah-config/:salahType',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(
    NamazValidation.salahTypeParamSchema.merge(NamazValidation.upsertSalahConfigBodySchema),
  ),
  NamazController.upsertSalahConfig,
);

router.get(
  '/salah-config',
  auth(USER_ROLES.SUPER_ADMIN),
  NamazController.getAllSalahConfigs,
);

router.get(
  '/guide/:salahType',
  validateRequest(NamazValidation.salahTypeParamSchema),
  NamazController.getPrayerGuide,
);

export const NamazRoutes = router;
