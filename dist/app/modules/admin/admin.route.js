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
const router = express_1.default.Router();
// --- Dashboard Metrics ---
router.get('/growth-metrics', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getDashboardStats);
// Preference cards monthly trend (each month’s count)
router.get('/preference-cards/trends/monthly', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getPreferenceCardMonthly);
// Active subscriptions monthly trend (each month’s count)
router.get('/subscriptions/trends/monthly', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), admin_controller_1.AdminController.getActiveSubscriptionMonthly);
exports.AdminRoutes = router;
