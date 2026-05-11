import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { AskImamController } from './ask-imam.controller';
import { AskImamValidation } from './ask-imam.validation';

const router = express.Router();

// User routes
router.post(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  fileHandler([{ name: 'image', maxCount: 1 }]),
  validateRequest(AskImamValidation.submitQuestionZodSchema),
  AskImamController.submitQuestion,
);

router.get(
  '/my-questions',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  AskImamController.getMyQuestions,
);

// Admin routes
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  AskImamController.getAllQuestions,
);

router.get(
  '/analytics',
  auth(USER_ROLES.SUPER_ADMIN),
  AskImamController.getAnalytics,
);

router.patch(
  '/:questionId/answer',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(AskImamValidation.answerQuestionZodSchema),
  AskImamController.answerQuestion,
);

export const AskImamRoutes = router;
