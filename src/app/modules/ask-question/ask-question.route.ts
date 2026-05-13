import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { AskQuestionController } from './ask-question.controller';
import { AskQuestionValidation } from './ask-question.validation';

const router = express.Router();

// User routes
router.post(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  fileHandler([{ name: 'image', maxCount: 1 }]),
  validateRequest(AskQuestionValidation.submitQuestionZodSchema),
  AskQuestionController.submitQuestion,
);

router.get(
  '/my-questions',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  AskQuestionController.getMyQuestions,
);

// Admin routes
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  AskQuestionController.getAllQuestions,
);

router.get(
  '/metrics',
  auth(USER_ROLES.SUPER_ADMIN),
  AskQuestionController.getQuestionMetrics,
);

router.patch(
  '/:questionId/answer',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(AskQuestionValidation.answerQuestionZodSchema),
  AskQuestionController.answerQuestion,
);

export const AskQuestionRoutes = router;
