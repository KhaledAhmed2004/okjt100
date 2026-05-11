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
exports.sendVerificationOTP = void 0;
const http_status_codes_1 = require("http-status-codes");
const user_model_1 = require("../app/modules/user/user.model");
const ApiError_1 = __importDefault(require("../errors/ApiError"));
const generateOTP_1 = __importDefault(require("../util/generateOTP"));
const emailHelper_1 = require("./emailHelper");
const emailTemplate_1 = require("../shared/emailTemplate");
const OTP_EXPIRY_MINUTES = 3;
/**
 * Generates OTP, saves to user record, and sends verification email
 * @param email - User's email address
 * @returns Object containing the generated OTP (for logging/debugging)
 * @throws ApiError if user doesn't exist or is already verified
 */
const sendVerificationOTP = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findOne({ email });
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (user.verified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'User is already verified!');
    }
    const otp = (0, generateOTP_1.default)();
    const authentication = {
        oneTimeCode: otp,
        expireAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000),
    };
    yield user_model_1.User.findOneAndUpdate({ email }, { $set: { authentication } });
    const emailData = emailTemplate_1.emailTemplate.createAccount({
        name: user.name,
        email: user.email,
        otp,
    });
    yield emailHelper_1.emailHelper.sendEmail(emailData);
    return { otp };
});
exports.sendVerificationOTP = sendVerificationOTP;
