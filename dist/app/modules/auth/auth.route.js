"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const rateLimit_1 = require("../../middlewares/rateLimit");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const auth_controller_1 = require("./auth.controller");
const auth_validation_1 = require("./auth.validation");
const router = express_1.default.Router();
// 10 req/min per IP — guards against brute-force password attempts and
// spray attacks against the token verification endpoint, which does expensive
// RSA signature validation.
const loginRateLimit = (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 10,
    routeName: 'auth:login',
});
const socialLoginRateLimit = (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 10,
    routeName: 'auth:social-login',
});
const passwordResetRateLimit = (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 5,
    routeName: 'auth:password-reset',
});
// User login
router.post('/login', loginRateLimit, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createLoginZodSchema), auth_controller_1.AuthController.loginUser);
// Social login (Google / Apple ID token verification)
router.post('/social-login', socialLoginRateLimit, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createSocialLoginZodSchema), auth_controller_1.AuthController.socialLogin);
// User logout — invalidate active sessions/tokens
router.post('/logout', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), auth_controller_1.AuthController.logoutUser);
// Password reset request — send OTP via email
router.post('/forgot-password', passwordResetRateLimit, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createForgetPasswordZodSchema), auth_controller_1.AuthController.forgetPassword);
// OTP verification — verify via code
router.post('/verify-otp', passwordResetRateLimit, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createVerifyEmailZodSchema), auth_controller_1.AuthController.verifyEmail);
// Password reset — set new password with valid token
router.post('/reset-password', passwordResetRateLimit, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createResetPasswordZodSchema), auth_controller_1.AuthController.resetPassword);
// Change password — authenticated user provides old/new password
router.post('/change-password', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createChangePasswordZodSchema), auth_controller_1.AuthController.changePassword);
// Resend verification OTP
router.post('/resend-otp', auth_controller_1.AuthController.resendVerifyEmail);
// Refresh token — renew access token
router.post('/refresh-token', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.createRefreshTokenZodSchema), auth_controller_1.AuthController.refreshToken);
exports.AuthRoutes = router;
