"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const notification_controller_1 = require("./notification.controller");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const notification_validation_1 = require("./notification.validation");
const router = express_1.default.Router();
// Notification list + unread count
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(notification_validation_1.listNotificationsSchema), notification_controller_1.NotificationController.listMyNotifications);
// Mark specific notification as read
router.patch('/:notificationId/read', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(notification_validation_1.markReadSchema), notification_controller_1.NotificationController.markRead);
// Mark all notifications as read
router.patch('/read-all', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), notification_controller_1.NotificationController.markAllRead);
// Delete notification
router.delete('/:notificationId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(notification_validation_1.paramIdSchema), notification_controller_1.NotificationController.deleteNotification);
exports.NotificationRoutes = router;
