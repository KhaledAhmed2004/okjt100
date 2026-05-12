import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { GroupController } from './group.controller';
import { GroupValidation } from './group.validation';

const router = express.Router();

// Admin routes
router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(GroupValidation.createGroupZodSchema),
  GroupController.createGroup,
);

// User routes
router.get(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  GroupController.getAllGroups,
);

router.post(
  '/:groupId/join',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  GroupController.joinGroup,
);

router.get(
  '/:groupId/posts',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  GroupController.getGroupFeed,
);

router.post(
  '/:groupId/posts',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(GroupValidation.createPostZodSchema),
  GroupController.createPost,
);

router.post(
  '/posts/:postId/like',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  GroupController.toggleLike,
);

router.post(
  '/posts/:postId/comments',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(GroupValidation.addCommentZodSchema),
  GroupController.addComment,
);

router.patch(
  '/posts/:postId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(GroupValidation.updatePostZodSchema),
  GroupController.updatePost,
);

router.delete(
  '/posts/:postId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.deletePost,
);

router.patch(
  '/comments/:commentId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(GroupValidation.updateCommentZodSchema),
  GroupController.updateComment,
);

router.delete(
  '/comments/:commentId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.deleteComment,
);

export const GroupRoutes = router;
