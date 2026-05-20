import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ConnectionController } from './connection.controller';
import { ConnectionValidation } from './connection.validation';

const router = express.Router();

// List pending requests (sent or received)
router.get(
  '/requests',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  ConnectionController.getPendingConnectionRequests
);

// List my accepted connections
router.get(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  ConnectionController.getMyConnections
);

// Send connection request
router.post(
  '/',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.sendConnectionRequestSchema),
  ConnectionController.sendConnectionRequest
);

// Accept a pending connection request
router.post(
  '/:connectionId/accept',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.acceptConnection
);

// Reject a pending connection request
router.post(
  '/:connectionId/reject',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.rejectConnection
);

// Cancel a pending request (sender undoes their own request)
router.post(
  '/:connectionId/cancel',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.cancelConnectionRequest
);

// Remove an accepted connection
router.post(
  '/:connectionId/remove',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.removeConnection
);

export const ConnectionRoutes = router;
