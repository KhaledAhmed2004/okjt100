"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const http_status_codes_1 = require("http-status-codes");
const google_auth_library_1 = require("google-auth-library");
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const authHelpers_1 = require("../../../helpers/authHelpers");
const emailHelper_1 = require("../../../helpers/emailHelper");
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const cryptoToken_1 = __importDefault(require("../../../util/cryptoToken"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const resetToken_model_1 = require("./resetToken/resetToken.model");
const user_model_1 = require("../user/user.model");
const user_1 = require("../../../enums/user");
const auth_constants_1 = require("../../../config/auth.constants");
const googleClient = new google_auth_library_1.OAuth2Client();
// All valid Google client IDs — iOS, Android, Web each get a separate one.
// verifyIdToken accepts an array; token is valid if aud matches ANY of them.
const googleAudience = [
    config_1.default.google.clientIdIos,
    config_1.default.google.clientIdAndroid,
    config_1.default.google.clientIdWeb,
].filter(Boolean);
const loginUserFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { email, password, deviceToken } = payload;
    // `tokenVersion` is `select: false` on the schema — pull it explicitly
    // here so the issued JWT carries the current rotation counter.
    const isExistUser = yield user_model_1.User.findOne({ email }).select('+password +tokenVersion');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }
    if (isExistUser.status === user_1.USER_STATUS.DELETED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deleted. Contact support.');
    }
    if (isExistUser.status === user_1.USER_STATUS.RESTRICTED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is restricted. Contact support.');
    }
    if (isExistUser.status === user_1.USER_STATUS.INACTIVE) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is inactive. Please activate it or contact support.');
    }
    if (!isExistUser.verified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Please verify your account, then try to login again');
    }
    if (!password) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password is required!');
    }
    if (!(yield user_model_1.User.isMatchPassword(password, isExistUser.password))) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }
    // JWT: access token
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
        tokenVersion: (_a = isExistUser.tokenVersion) !== null && _a !== void 0 ? _a : 0,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    // JWT: refresh token
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
        tokenVersion: (_b = isExistUser.tokenVersion) !== null && _b !== void 0 ? _b : 0,
    }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in);
    const isOnboardingCompleted = isExistUser.isOnboardingCompleted;
    // ✅ save device token
    if (deviceToken) {
        yield user_model_1.User.addDeviceToken(isExistUser._id.toString(), deviceToken);
    }
    return { tokens: { accessToken, refreshToken }, isOnboardingCompleted };
});
// logout
const logoutUserFromDB = (user, deviceToken) => __awaiter(void 0, void 0, void 0, function* () {
    if (!deviceToken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Device token is required');
    }
    yield user_model_1.User.removeDeviceToken(user.id, deviceToken);
});
//forget password
const forgetPasswordToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.findOne({ email });
    // Silent success: if user doesn't exist, don't throw error
    if (!isExistUser) {
        return;
    }
    // Clear any existing reset tokens for this user (invalidate old requests)
    yield resetToken_model_1.ResetToken.deleteMany({ user: isExistUser._id });
    //send mail
    const otp = (0, generateOTP_1.default)();
    const value = {
        otp,
        email: isExistUser.email,
    };
    console.log('Sending email to:', isExistUser.email, 'with OTP:', otp);
    const forgetPassword = emailTemplate_1.emailTemplate.resetPassword(value);
    emailHelper_1.emailHelper.sendEmail(forgetPassword);
    //save to DB (atomic update for OTP)
    const authentication = {
        oneTimeCode: otp,
        expireAt: new Date(Date.now() + auth_constants_1.OTP_TTL_MS),
    };
    yield user_model_1.User.findOneAndUpdate({ email, status: { $ne: user_1.USER_STATUS.DELETED } }, { $set: { authentication } });
});
//verify email
const verifyEmailToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { email, otp } = payload;
    if (!otp) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP is required');
    }
    // Atomic find and update to prevent race conditions (double-submit)
    // We use current time in query to ensure the OTP is still valid
    const filter = {
        email,
        'authentication.oneTimeCode': otp,
        'authentication.expireAt': { $gt: new Date() },
        status: { $ne: user_1.USER_STATUS.DELETED },
    };
    const isExistUser = yield user_model_1.User.findOne(filter).select('+authentication +tokenVersion');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or expired verification code');
    }
    let message;
    let data;
    let tokens;
    if (!isExistUser.verified) {
        // Mark as verified and clear OTP
        const isOnboardingCompleted = isExistUser.isOnboardingCompleted;
        yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            $set: {
                verified: true,
                'authentication.oneTimeCode': null,
                'authentication.expireAt': null,
            },
        });
        // Auto-login for new users after verification
        const accessToken = jwtHelper_1.jwtHelper.createToken({
            id: isExistUser._id.toString(),
            role: isExistUser.role,
            email: isExistUser.email,
            tokenVersion: (_a = isExistUser.tokenVersion) !== null && _a !== void 0 ? _a : 0,
        }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
        const refreshToken = jwtHelper_1.jwtHelper.createToken({
            id: isExistUser._id.toString(),
            role: isExistUser.role,
            email: isExistUser.email,
            tokenVersion: (_b = isExistUser.tokenVersion) !== null && _b !== void 0 ? _b : 0,
        }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in);
        tokens = { accessToken, refreshToken };
        message = 'Email verify successfully';
        return { data: Object.assign(Object.assign({}, tokens), { isOnboardingCompleted }), message, tokens };
    }
    else {
        // For password reset flow
        yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            $set: {
                'authentication.isResetPassword': true,
                'authentication.oneTimeCode': null,
                'authentication.expireAt': null,
            },
        });
        //create token ;
        const createToken = (0, cryptoToken_1.default)();
        yield resetToken_model_1.ResetToken.create({
            user: isExistUser._id,
            token: createToken,
            expireAt: new Date(Date.now() + auth_constants_1.RESET_TOKEN_TTL_MS),
        });
        message =
            'Verification Successful: Please securely store and utilize this code for reset password';
        data = { resetToken: createToken };
    }
    return { data, message, tokens };
});
//reset password
const resetPasswordToDB = (token, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { newPassword } = payload;
    if (!token) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Reset token is required');
    }
    // Use a transaction or atomic approach:
    // Find valid token and its user in one go
    const isExistToken = yield resetToken_model_1.ResetToken.findOne({
        token,
        expireAt: { $gt: new Date() },
    });
    if (!isExistToken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid or expired reset token');
    }
    // Check user permission (one-time flag)
    const isExistUser = yield user_model_1.User.findOne({
        _id: isExistToken.user,
        'authentication.isResetPassword': true,
        status: { $ne: user_1.USER_STATUS.DELETED },
    }).select('+authentication');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Invalid request or session. Please click 'Forgot Password' again.");
    }
    // Hash new password
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    // Update user AND increment tokenVersion to invalidate all existing sessions
    // Also clear the reset flag atomically
    yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
        $set: {
            password: hashPassword,
            'authentication.isResetPassword': false,
        },
        $inc: { tokenVersion: 1 },
    });
    // Delete the used token immediately
    yield resetToken_model_1.ResetToken.deleteOne({ _id: isExistToken._id });
    // Optional: Invalidate all other reset tokens for this user
    yield resetToken_model_1.ResetToken.deleteMany({ user: isExistUser._id });
});
const changePasswordToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, newPassword } = payload;
    const isExistUser = yield user_model_1.User.findById(user.id).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    //current password match
    if (currentPassword &&
        !(yield user_model_1.User.isMatchPassword(currentPassword, isExistUser.password))) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password is incorrect');
    }
    //newPassword and current password
    if (currentPassword === newPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please give different password from current password');
    }
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    // Update user AND increment tokenVersion to invalidate all existing sessions
    // Also clear the reset flag atomically
    yield user_model_1.User.findOneAndUpdate({ _id: user.id }, {
        $set: { password: hashPassword },
        $inc: { tokenVersion: 1 },
    }, { new: true });
});
const resendVerifyEmailToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, authHelpers_1.sendVerificationOTP)(email);
});
// Social login (Google / Apple ID token verification)
const socialLoginToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { provider, idToken, nonce, deviceToken, platform, appVersion } = payload;
    let email;
    let name;
    let providerId;
    if (provider === 'google') {
        const ticket = yield googleClient.verifyIdToken({
            idToken,
            audience: googleAudience,
        });
        const tokenPayload = ticket.getPayload();
        if (!tokenPayload || !tokenPayload.email) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid Google ID token');
        }
        // Reject tokens where Google has not verified the email. Prevents an
        // attacker from minting tokens for arbitrary unverified addresses.
        if (!tokenPayload.email_verified) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Google account email is not verified');
        }
        // Nonce replay protection: Google echoes the raw nonce in the token
        // when the client passes it to the SDK. Flutter's google_sign_in
        // plugin doesn't expose nonce, so we only enforce the check if the
        // client actually sent one.
        if (nonce && tokenPayload.nonce !== nonce) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Nonce mismatch');
        }
        email = tokenPayload.email;
        name = tokenPayload.name || email.split('@')[0];
        providerId = tokenPayload.sub;
    }
    else {
        // Apple — nonce is mandatory (Apple best practice + plugin supports it)
        if (!nonce) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Nonce is required for Apple sign-in');
        }
        const applePayload = yield apple_signin_auth_1.default.verifyIdToken(idToken, {
            audience: config_1.default.apple_client_id,
            ignoreExpiration: false,
        });
        if (!applePayload.sub) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid Apple ID token');
        }
        // Apple puts SHA256(nonce) in the token — hash the client-provided
        // raw nonce and compare.
        const expectedHash = crypto_1.default
            .createHash('sha256')
            .update(nonce)
            .digest('hex');
        if (applePayload.nonce !== expectedHash) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Nonce mismatch');
        }
        email = applePayload.email;
        providerId = applePayload.sub;
        name = email ? email.split('@')[0] : 'Apple User';
    }
    // Find user strictly by provider ID. Matching on email here would let an
    // attacker who controls a provider account with the same email address
    // hijack a local/password account — see OWASP "Account Linking" guidance.
    const providerField = provider === 'google' ? 'googleId' : 'appleId';
    let user = yield user_model_1.User.findOne({ [providerField]: providerId }).select('+tokenVersion');
    if (user) {
        // Status checks
        if (user.status === user_1.USER_STATUS.DELETED) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deleted. Contact support.');
        }
        if (user.status === user_1.USER_STATUS.RESTRICTED) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is restricted. Contact support.');
        }
    }
    else {
        // No user linked to this provider identity. If the email already
        // belongs to another account, refuse to auto-link — the user must
        // authenticate with that account first and link the provider
        // explicitly from a settings flow.
        if (email) {
            const existingByEmail = yield user_model_1.User.findOne({ email });
            if (existingByEmail) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'An account with this email already exists. Please sign in with your password and link your social account from settings.');
            }
        }
        // Create new user
        if (!email) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email is required to create an account. Please allow email sharing.');
        }
        user = yield user_model_1.User.create({
            name,
            email,
            verified: true,
            [providerField]: providerId,
        });
        // Re-fetch with tokenVersion
        user = yield user_model_1.User.findById(user._id).select('+tokenVersion');
        if (!user) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create user');
        }
    }
    const isOnboardingCompleted = user.isOnboardingCompleted;
    // Register device token
    if (deviceToken) {
        yield user_model_1.User.addDeviceToken(user._id.toString(), deviceToken, platform, appVersion);
    }
    // Issue tokens
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: (_a = user.tokenVersion) !== null && _a !== void 0 ? _a : 0,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: (_b = user.tokenVersion) !== null && _b !== void 0 ? _b : 0,
    }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in);
    return { tokens: { accessToken, refreshToken }, isOnboardingCompleted };
});
// Refresh token: verify and issue new tokens with rotation
const refreshTokenToDB = (token) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!token) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Refresh token is required');
    }
    // Verify the refresh token
    const decoded = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_refresh_secret);
    const userId = decoded.id;
    const tokenVersion = decoded.tokenVersion;
    // Pull the hidden `tokenVersion` so we can compare against the
    // version baked into the refresh token.
    const user = yield user_model_1.User.findById(userId).select('+tokenVersion');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
    }
    if (user.status === user_1.USER_STATUS.DELETED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'User account is deleted');
    }
    // Reuse Detection: If the token version in the JWT doesn't match the DB version,
    // it means the token was already used (rotated) or invalidated.
    if (user.tokenVersion !== tokenVersion) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Refresh token expired or already used. Please login again.');
    }
    // Increment tokenVersion in DB to invalidate ALL currently issued tokens
    // and ensure the new ones are unique.
    const updatedUser = yield user_model_1.User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true });
    if (!updatedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to rotate token');
    }
    // Issue new tokens with the NEW tokenVersion
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: updatedUser._id.toString(),
        role: updatedUser.role,
        email: updatedUser.email,
        tokenVersion: (_a = updatedUser.tokenVersion) !== null && _a !== void 0 ? _a : 0,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    const newRefreshToken = jwtHelper_1.jwtHelper.createToken({
        id: updatedUser._id.toString(),
        role: updatedUser.role,
        email: updatedUser.email,
        tokenVersion: (_b = updatedUser.tokenVersion) !== null && _b !== void 0 ? _b : 0,
    }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in);
    return { tokens: { accessToken, refreshToken: newRefreshToken } };
});
exports.AuthService = {
    verifyEmailToDB,
    loginUserFromDB,
    forgetPasswordToDB,
    resetPasswordToDB,
    changePasswordToDB,
    resendVerifyEmailToDB,
    logoutUserFromDB,
    socialLoginToDB,
    refreshTokenToDB,
};
