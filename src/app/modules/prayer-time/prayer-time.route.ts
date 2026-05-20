import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { PrayerTimeController } from './prayer-time.controller';
import { PrayerTimeValidation } from './prayer-time.validation';

const router = express.Router();

router.get(
  '/',
  validateRequest(PrayerTimeValidation.getPrayerTimesZodSchema),
  PrayerTimeController.getPrayerTimes
);

export const PrayerTimeRoutes = router;
