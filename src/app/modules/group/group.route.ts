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
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(GroupValidation.createGroupZodSchema),
  GroupController.createGroup,
);

router.patch(
  '/:groupId',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(GroupValidation.updateGroupZodSchema),
  GroupController.updateGroup,
);

router.delete(
  '/:groupId',
  auth(USER_ROLES.SUPER_ADMIN),
  GroupController.deleteGroup,
);

// User routes
router.get(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.getAllGroups,
);

router.get(
  '/:groupId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.getSingleGroup,
);

router.post(
  '/:groupId/join',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.joinGroup,
);

router.post(
  '/:groupId/leave',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.leaveGroup,
);

router.delete(
  '/:groupId/members/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  GroupController.kickMember,
);

router.get(
  '/:groupId/posts',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.getGroupFeed,
);

router.post(
  '/:groupId/posts',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  validateRequest(GroupValidation.createPostZodSchema),
  GroupController.createPost,
);

router.post(
  '/posts/:postId/like',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.toggleLike,
);

router.post(
  '/posts/:postId/comments',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  validateRequest(GroupValidation.addCommentZodSchema),
  GroupController.addComment,
);

router.get(
  '/posts/:postId/comments',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.getPostComments,
);

router.patch(
  '/posts/:postId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
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
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  validateRequest(GroupValidation.updateCommentZodSchema),
  GroupController.updateComment,
);

router.delete(
  '/comments/:commentId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.SUPER_ADMIN),
  GroupController.deleteComment,
);

router.patch(
  '/posts/:postId/pin',
  auth(USER_ROLES.SUPER_ADMIN),
  GroupController.togglePinPost,
);

export const GroupRoutes = router;
