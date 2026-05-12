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
exports.GroupService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const group_model_1 = require("./group.model");
const mongoose_1 = __importDefault(require("mongoose"));
const createGroupIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield group_model_1.Group.create(payload);
    return result;
});
const getAllGroupsFromDB = (query, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    // Map internal role (BROTHER/SISTER) to group userType (Male/Female)
    const mappedGender = userRole === USER_ROLES.BROTHER ? 'Male' : 'Female';
    const groupQuery = new QueryBuilder_1.default(group_model_1.Group.find({ userType: mappedGender }), query)
        .textSearch(['name'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield groupQuery.modelQuery;
    const pagination = yield groupQuery.getPaginationInfo();
    return { data, pagination };
});
const joinGroupInDB = (groupId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const group = yield group_model_1.Group.findById(groupId).session(session);
        if (!group)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Group not found');
        const isAlreadyMember = yield group_model_1.GroupMember.findOne({ groupId, userId }).session(session);
        if (isAlreadyMember)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Already a member');
        const result = yield group_model_1.GroupMember.create([{ groupId, userId, role: 'member' }], { session });
        yield group_model_1.Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } }, { session });
        yield session.commitTransaction();
        return result[0];
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const createPostInDB = (groupId, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isMember = yield group_model_1.GroupMember.findOne({ groupId, userId });
    if (!isMember)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only members can post');
    const result = yield group_model_1.GroupPost.create(Object.assign(Object.assign({}, payload), { groupId, userId }));
    return result;
});
const getGroupFeedFromDB = (groupId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const postQuery = new QueryBuilder_1.default(group_model_1.GroupPost.find({ groupId }).populate('userId', 'name profileImage'), query)
        .sort()
        .paginate()
        .fields();
    const data = yield postQuery.modelQuery;
    const pagination = yield postQuery.getPaginationInfo();
    return { data, pagination };
});
const toggleLikeInDB = (postId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const isLiked = yield group_model_1.PostLike.findOne({ postId, userId });
    if (isLiked) {
        yield group_model_1.PostLike.findByIdAndDelete(isLiked._id);
        return { liked: false };
    }
    else {
        yield group_model_1.PostLike.create({ postId, userId });
        return { liked: true };
    }
});
const addCommentInDB = (postId, userId, comment) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield group_model_1.PostComment.create({ postId, userId, comment });
    return result;
});
exports.GroupService = {
    createGroupIntoDB,
    getAllGroupsFromDB,
    joinGroupInDB,
    createPostInDB,
    getGroupFeedFromDB,
    toggleLikeInDB,
    addCommentInDB,
};
