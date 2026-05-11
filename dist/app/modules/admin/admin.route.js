"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const admin_controller_1 = require("./admin.controller");
const user_controller_1 = require("../user/user.controller");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_validation_1 = require("../user/user.validation");
const router = express_1.default.Router();
// --- Dashboard Metrics ---
router.get('/growth-metrics', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getDashboardStats);
// Preference cards monthly trend (each month’s count)
router.get('/preference-cards/trends/monthly', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getPreferenceCardMonthly);
// Active subscriptions monthly trend (each month’s count)
router.get('/subscriptions/trends/monthly', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getActiveSubscriptionMonthly);
// --- User Management (Admin Only) ---
// Get user growth statistics
router.get('/users/stats', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.getUsersStats);
// List all users with stats (Admin)
router.get('/users', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.getAllUserRoles);
// Get specific user details by ID (Admin)
router.get('/users/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.getUserById);
// Admin: Update any user (Update fields including specialty, role, status)
router.patch('/users/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.adminUpdateUserZodSchema), user_controller_1.UserController.adminUpdateUser);
// Admin: Delete user permanently
router.delete('/users/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.deleteUser);
exports.AdminRoutes = router;
