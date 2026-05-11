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
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const DeviceTokenSchema = new mongoose_1.Schema({
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'] },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: () => new Date() },
}, { _id: false });
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.USER,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: function () {
            // Password is not required for OAuth users
            return !this.googleId && !this.appleId;
        },
        minlength: 8,
        select: false, // hide password by default
    },
    location: {
        type: String,
        trim: true,
    },
    country: {
        type: String,
        required: function () {
            return !this.googleId && !this.appleId;
        },
        trim: true,
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
    },
    dateOfBirth: {
        type: String,
    },
    phone: {
        type: String,
        required: function () {
            return !this.googleId && !this.appleId;
        },
        trim: true,
    },
    specialty: {
        type: String,
        trim: true,
    },
    hospital: {
        type: String,
        trim: true,
    },
    profilePicture: {
        type: String,
        default: 'https://i.ibb.co/z5YHLV9/profile.png',
    },
    isOnboardingCompleted: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: Object.values(user_1.USER_STATUS),
        default: user_1.USER_STATUS.ACTIVE,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    deviceTokens: {
        type: [DeviceTokenSchema],
        default: [],
    },
    tokenVersion: {
        type: Number,
        default: 0,
        select: false,
    },
    about: {
        type: String,
    },
    googleId: {
        type: String,
        sparse: true, // allows multiple null values
        unique: true, // but each non-null googleId must be unique — one Google account → one user
    },
    appleId: {
        type: String,
        sparse: true,
        unique: true,
    },
    authentication: {
        type: {
            isResetPassword: {
                type: Boolean,
                default: false,
            },
            oneTimeCode: {
                type: String,
                default: null,
            },
            expireAt: {
                type: Date,
                default: null,
            },
        },
        select: false, // hide auth info by default
    },
}, { timestamps: true });
// Index on the embedded device token field — makes the cross-user
// rebinding guard in `addDeviceToken` cheap even at scale.
userSchema.index({ 'deviceTokens.token': 1 });
//exist user check
userSchema.statics.isExistUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield exports.User.findById(id);
    return isExist;
});
userSchema.statics.isExistUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield exports.User.findOne({ email });
    return isExist;
});
//is match password
userSchema.statics.isMatchPassword = (password, hashPassword) => __awaiter(void 0, void 0, void 0, function* () {
    return yield bcrypt_1.default.compare(password, hashPassword);
});
// Hash password only when it has been set or changed. Email uniqueness
// is enforced by the `{ unique: true }` index on the email field — no
// manual `findOne` check is needed (the DB guarantees atomicity, which
// a "check then write" cannot). Duplicate-key errors are translated in
// the global error handler.
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.password && this.isModified('password')) {
            this.password = yield bcrypt_1.default.hash(this.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
// ✅ add device token (upsert: refresh lastSeenAt / metadata if token already exists)
userSchema.statics.addDeviceToken = (userId, token, platform, appVersion) => __awaiter(void 0, void 0, void 0, function* () {
    // Step 1: Cross-user rebinding guard. Same physical device can get
    // re-used by a different account (User A logs out → User B logs in on
    // the same phone). FCM sends back the same token. If User A still has
    // it, pushes meant for User A land on User B's device. Strip the token
    // from any other user before attaching it here.
    yield exports.User.updateMany({ _id: { $ne: userId }, 'deviceTokens.token': token }, { $pull: { deviceTokens: { token } } });
    // Step 2: Try to refresh metadata on an existing token first.
    const updated = yield exports.User.findOneAndUpdate({ _id: userId, 'deviceTokens.token': token }, {
        $set: Object.assign(Object.assign({ 'deviceTokens.$.lastSeenAt': new Date() }, (platform ? { 'deviceTokens.$.platform': platform } : {})), (appVersion ? { 'deviceTokens.$.appVersion': appVersion } : {})),
    }, { new: true });
    if (updated)
        return updated;
    // Step 3: Not present — push a new sub-document.
    return yield exports.User.findByIdAndUpdate(userId, {
        $push: {
            deviceTokens: {
                token,
                platform,
                appVersion,
                lastSeenAt: new Date(),
            },
        },
    }, { new: true });
});
// ✅ remove device token (match the token field inside the sub-document)
userSchema.statics.removeDeviceToken = (userId, token) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findByIdAndUpdate(userId, { $pull: { deviceTokens: { token } } }, { new: true });
});
exports.User = (0, mongoose_1.model)('User', userSchema);
