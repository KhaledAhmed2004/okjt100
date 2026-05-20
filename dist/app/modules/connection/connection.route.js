"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const connection_controller_1 = require("./connection.controller");
const connection_validation_1 = require("./connection.validation");
const router = express_1.default.Router();
// Get connection status with a specific user
router.get('/status/:userId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.checkConnectionStatusParamsSchema), connection_controller_1.ConnectionController.getConnectionStatus);
// List pending requests (sent or received)
router.get('/requests', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), connection_controller_1.ConnectionController.getPendingConnectionRequests);
// List my accepted connections
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), connection_controller_1.ConnectionController.getMyConnections);
// Send connection request
router.post('/request/:userId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.sendConnectionRequestSchema), connection_controller_1.ConnectionController.sendConnectionRequest);
// Accept or reject request
router.patch('/:connectionId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.respondToConnectionRequestSchema), connection_controller_1.ConnectionController.respondToConnectionRequest);
// Cancel pending request (DELETE = undo the sent request)
router.delete('/:connectionId/request', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.getConnectionByIdParamsSchema), connection_controller_1.ConnectionController.cancelConnectionRequest);
// Remove accepted connection
router.delete('/:connectionId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.getConnectionByIdParamsSchema), connection_controller_1.ConnectionController.removeConnection);
exports.ConnectionRoutes = router;
