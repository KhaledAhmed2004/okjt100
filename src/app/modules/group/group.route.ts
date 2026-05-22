import express, { NextFunction, Request, Response } from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { GroupController } from './group.controller';
import { GroupValidation } from './group.validation';
import { fileHandler } from '../../middlewares/fileHandler';

const router = express.Router();

const normalizeAttachments = (req: Request, res: Response, next: NextFunction) => {
  try {
    let uploaded: string[] = [];
    if (req.body.attachments) {
      if (typeof req.body.attachments === 'string') {
        uploaded = [req.body.attachments];
      } else if (Array.isArray(req.body.attachments)) {
        uploaded = req.body.attachments;
      }
    }

    let existing: string[] = [];
    if (req.body.existingAttachments) {
      if (typeof req.body.existingAttachments === 'string') {
        try {
          existing = JSON.parse(req.body.existingAttachments);
        } catch (err) {
          existing = [req.body.existingAttachments];
        }
      } else if (Array.isArray(req.body.existingAttachments)) {
        existing = req.body.existingAttachments;
      }
    }

    const hasExisting = req.body.existingAttachments !== undefined;
    const hasUploaded = req.body.attachments !== undefined;

    const merged = [...existing, ...uploaded];
    if (hasExisting || hasUploaded || merged.length > 0) {
      req.body.attachments = merged;
    }

    // Clean up temporary helper field
    delete req.body.existingAttachments;
    next();
  } catch (error) {
    next(error);
  }
};

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
  fileHandler([{ name: 'attachments', maxCount: 5 }]),
  normalizeAttachments,
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
  fileHandler([{ name: 'attachments', maxCount: 5 }]),
  normalizeAttachments,
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
