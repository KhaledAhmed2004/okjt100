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
exports.UserService = void 0;
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const subscription_model_1 = require("../subscription/subscription.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const authHelpers_1 = require("../../../helpers/authHelpers");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const user_model_1 = require("./user.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const createUserToDB = (payload_1, ...args_1) => __awaiter(void 0, [payload_1, ...args_1], void 0, function* (payload, isAdmin = false) {
    // If created by admin, auto-verify. Otherwise, start unverified.
    const userData = Object.assign(Object.assign({}, payload), { verified: isAdmin ? true : false });
    const createUser = yield user_model_1.User.create(userData);
    if (!createUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
    }
    // Only send OTP for public registrations (non-admins)
    if (!isAdmin) {
        try {
            yield (0, authHelpers_1.sendVerificationOTP)(createUser.email);
        }
        catch (err) {
            console.error('Signup OTP send failed:', err);
        }
    }
    return createUser;
});
const getUserProfileFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    return isExistUser;
});
const updateProfileToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // //unlink file here
    // if (payload.image) {
    //   unlinkFile(isExistUser.image);
    // }
    //unlink file here
    if (payload.profilePicture) {
        (0, unlinkFile_1.default)(isExistUser.profilePicture);
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    });
    return updateDoc;
});
const getAllUsersFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const userQuery = new QueryBuilder_1.default(user_model_1.User.find(), query)
        .search(['name', 'email'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const users = yield userQuery.modelQuery;
    const paginationInfo = yield userQuery.getPaginationInfo();
    return {
        meta: paginationInfo,
        data: users,
    };
});
const getUsersStatsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const aggregationBuilder = new AggregationBuilder_1.default(user_model_1.User);
    // Overall user growth
    const totalStats = yield aggregationBuilder.calculateGrowth({ period: 'month' });
    // Status based growth
    aggregationBuilder.reset();
    const activeStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: user_1.USER_STATUS.ACTIVE },
        period: 'month'
    });
    aggregationBuilder.reset();
    const inactiveStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: user_1.USER_STATUS.INACTIVE },
        period: 'month'
    });
    aggregationBuilder.reset();
    const blockedStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: user_1.USER_STATUS.RESTRICTED },
        period: 'month'
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: stat.growth,
        direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
    });
    return {
        meta: {
            comparisonPeriod: 'month',
        },
        totalUsers: formatMetric(totalStats),
        activeUsers: formatMetric(activeStats),
        inactiveUsers: formatMetric(inactiveStats),
        blockedUsers: formatMetric(blockedStats),
    };
});
const getAllUserRolesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { search, email, role = user_1.USER_ROLES.USER, status, specialty, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const match = {};
    if (status)
        match.status = status;
    if (role)
        match.role = role;
    if (email)
        match.email = { $regex: email, $options: 'i' };
    if (search) {
        match.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    const basePipeline = [
        { $match: match },
        // Lookup preference cards created by this user
        {
            $lookup: {
                from: 'preferencecards',
                let: { userIdStr: { $toString: '$_id' } },
                pipeline: [
                    { $match: { $expr: { $eq: ['$createdBy', '$$userIdStr'] } } },
                ],
                as: 'cards',
            },
        },
        // Compute specialties and cards count
        {
            $addFields: {
                cardsCount: { $size: '$cards' },
                specialties: {
                    $setDifference: [
                        {
                            $setUnion: [
                                {
                                    $map: {
                                        input: '$cards',
                                        as: 'c',
                                        in: { $ifNull: ['$$c.surgeon.specialty', null] },
                                    },
                                },
                                [],
                            ],
                        },
                        [null],
                    ],
                },
            },
        },
        // Optional specialty filter
        ...(specialty
            ? [
                {
                    $match: {
                        specialties: { $elemMatch: { $regex: specialty, $options: 'i' } },
                    },
                },
            ]
            : []),
        // Lookup subscription status
        {
            $lookup: {
                from: subscription_model_1.Subscription.collection.name,
                localField: '_id',
                foreignField: 'userId',
                as: 'subscription',
            },
        },
        {
            $addFields: {
                subscriptionStatus: {
                    $ifNull: [{ $arrayElemAt: ['$subscription.status', 0] }, 'inactive'],
                },
                subscriptionPlan: {
                    $ifNull: [{ $arrayElemAt: ['$subscription.plan', 0] }, 'FREE'],
                },
            },
        },
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                specialty: 1,
                hospital: 1,
                status: 1,
                verified: 1,
                role: 1,
                profilePicture: 1,
                specialties: 1,
                cardsCount: 1,
                subscriptionStatus: 1,
                subscriptionPlan: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    ];
    const sortStage = {
        $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
    };
    const paginatedPipeline = [
        ...basePipeline,
        sortStage,
        { $skip: skip },
        { $limit: Number(limit) },
    ];
    const countPipeline = [
        ...basePipeline,
        { $count: 'total' },
    ];
    const [data, countResult] = yield Promise.all([
        user_model_1.User.aggregate(paginatedPipeline),
        user_model_1.User.aggregate(countPipeline),
    ]);
    const total = ((_a = countResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    const totalPages = Math.ceil(total / Number(limit));
    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
            hasNext: Number(page) < totalPages,
            hasPrev: Number(page) > 1,
        },
        data,
    };
});
const updateUserStatusInDB = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.isExistUserById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const updatedUser = yield user_model_1.User.findByIdAndUpdate(id, { status }, { new: true });
    return updatedUser;
});
const deleteUserPermanentlyFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const deletedUser = yield user_model_1.User.findByIdAndDelete(id)
        .select('-password -authentication');
    return deletedUser;
});
const updateUserByAdminInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('+password');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // Whitelist fields admin can update (excluding password/auth info)
    if (payload.name !== undefined)
        user.name = payload.name;
    if (payload.email !== undefined)
        user.email = payload.email;
    if (payload.phone !== undefined)
        user.phone = payload.phone;
    if (payload.country !== undefined)
        user.country = payload.country;
    if (payload.specialty !== undefined)
        user.specialty = payload.specialty;
    if (payload.hospital !== undefined)
        user.hospital = payload.hospital;
    if (payload.location !== undefined)
        user.location = payload.location;
    if (payload.gender !== undefined)
        user.gender = payload.gender;
    if (payload.dateOfBirth !== undefined)
        user.dateOfBirth = payload.dateOfBirth;
    if (payload.profilePicture !== undefined)
        user.profilePicture = payload.profilePicture;
    if (payload.status !== undefined)
        user.status = payload.status;
    if (payload.role !== undefined)
        user.role = payload.role;
    yield user.save();
    const plain = user.toObject();
    delete plain.password;
    delete plain.authentication;
    return plain;
});
const getUserByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    // Only return user info; remove task/bid side data
    const user = yield user_model_1.User.findById(id).select('-password -authentication');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return { user };
});
const getUserDetailsByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('-password -authentication');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return user;
});
const completeOnboardingToDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const updatedUser = yield user_model_1.User.findByIdAndUpdate(id, { $set: { isOnboardingCompleted: true } }, { new: true });
    return updatedUser;
});
exports.UserService = {
    createUserToDB,
    getUserProfileFromDB,
    updateProfileToDB,
    getAllUsersFromDB,
    getAllUserRolesFromDB,
    updateUserStatusInDB,
    updateUserByAdminInDB,
    deleteUserPermanentlyFromDB,
    getUserByIdFromDB,
    getUserDetailsByIdFromDB,
    getUsersStatsFromDB,
    completeOnboardingToDB,
};
