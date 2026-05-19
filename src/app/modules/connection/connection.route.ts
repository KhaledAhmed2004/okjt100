import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ConnectionController } from './connection.controller';
import { ConnectionValidation } from './connection.validation';

const router = express.Router();

// Get connection status with a specific user
router.get(
  '/status/:userId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.checkConnectionStatusParamsSchema),
  ConnectionController.getConnectionStatus
);

// List pending requests (sent or received)
router.get(
  '/pending',
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
  '/request/:userId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.sendConnectionRequestSchema),
  ConnectionController.sendConnectionRequest
);

// Accept or reject request
router.patch(
  '/:connectionId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.respondToConnectionRequestSchema),
  ConnectionController.respondToConnectionRequest
);

// Cancel pending request (DELETE = undo the sent request)
router.delete(
  '/:connectionId/request',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.getConnectionByIdParamsSchema),
  ConnectionController.cancelConnectionRequest
);

// Remove accepted connection
router.delete(
  '/:connectionId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.getConnectionByIdParamsSchema),
  ConnectionController.removeConnection
);

export const ConnectionRoutes = router;
