import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ConnectionValidation } from './connection.validation';
import { ConnectionController } from './connection.controller';

const router = express.Router();

// Get connection status with a specific user
router.get(
  '/status/:userId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.statusCheckZodSchema),
  ConnectionController.getConnectionStatus
);

// List pending requests (sent or received)
router.get(
  '/pending',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  ConnectionController.getPendingRequests
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
  validateRequest(ConnectionValidation.sendRequestZodSchema),
  ConnectionController.sendRequest
);

// Accept or reject request
router.patch(
  '/:connectionId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.respondToRequestZodSchema),
  ConnectionController.respondToRequest
);

// Cancel pending request (DELETE = undo the sent request)
router.delete(
  '/:connectionId/request',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.cancelRequest
);

// Remove accepted connection
router.delete(
  '/:connectionId',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER),
  validateRequest(ConnectionValidation.connectionIdParamSchema),
  ConnectionController.removeConnection
);

export const ConnectionRoutes = router;
