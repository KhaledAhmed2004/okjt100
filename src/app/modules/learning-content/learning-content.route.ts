import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { fileHandler } from '../../middlewares/fileHandler';
import validateRequest from '../../middlewares/validateRequest';
import { LearningContentController } from './learning-content.controller';
import { LearningContentValidation } from './learning-content.validation';

const router = express.Router();

router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  LearningContentController.getAllLearningContents,
);

router.get(
  '/:contentId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  LearningContentController.getSingleLearningContent,
);

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler([{ name: 'video', maxCount: 1, subfolder: 'learning-contents/videos' }], { maxFileSizeMB: 500 }),
  validateRequest(LearningContentValidation.createLearningContentZodSchema),
  LearningContentController.createLearningContent,
);

router.patch(
  '/:contentId',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler([{ name: 'video', maxCount: 1, subfolder: 'learning-contents/videos' }], { maxFileSizeMB: 500 }),
  validateRequest(LearningContentValidation.updateLearningContentZodSchema),
  LearningContentController.updateLearningContent,
);

router.delete(
  '/:contentId',
  auth(USER_ROLES.SUPER_ADMIN),
  LearningContentController.deleteLearningContent,
);

// Likes
router.post(
  '/:contentId/like',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  LearningContentController.toggleLike,
);

// Comments
router.post(
  '/:contentId/comments',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(LearningContentValidation.addCommentZodSchema),
  LearningContentController.addComment,
);

router.get(
  '/:contentId/comments',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  LearningContentController.getComments,
);

router.delete(
  '/comments/:commentId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER),
  LearningContentController.deleteComment,
);

export const LearningContentRoutes = router;
