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
exports.AskImamService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const ask_imam_model_1 = __importDefault(require("./ask-imam.model"));
const submitQuestionIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield ask_imam_model_1.default.create(payload);
    return result;
});
const getAllQuestionsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const questionQuery = new QueryBuilder_1.default(ask_imam_model_1.default.find().populate('userId', 'name email'), query)
        .textSearch()
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield questionQuery.modelQuery;
    const pagination = yield questionQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const getMyQuestionsFromDB = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const questionQuery = new QueryBuilder_1.default(ask_imam_model_1.default.find({ userId }), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield questionQuery.modelQuery;
    const pagination = yield questionQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const answerQuestionInDB = (id, answer) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield ask_imam_model_1.default.findByIdAndUpdate(id, {
        answer,
        status: 'answered',
        answeredAt: new Date(),
    }, { new: true, runValidators: true }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Question not found');
    }
    return result;
});
const getAnalyticsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const total = yield ask_imam_model_1.default.countDocuments();
    const pending = yield ask_imam_model_1.default.countDocuments({ status: 'pending' });
    const answered = yield ask_imam_model_1.default.countDocuments({ status: 'answered' });
    return {
        total,
        pending,
        answered,
    };
});
exports.AskImamService = {
    submitQuestionIntoDB,
    getAllQuestionsFromDB,
    getMyQuestionsFromDB,
    answerQuestionInDB,
    getAnalyticsFromDB,
};
