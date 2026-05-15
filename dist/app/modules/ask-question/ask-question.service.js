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
exports.AskQuestionService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const ask_question_model_1 = __importDefault(require("./ask-question.model"));
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const submitQuestionIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield ask_question_model_1.default.create(payload);
    return result;
});
const getAllQuestionsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const questionQuery = new QueryBuilder_1.default(ask_question_model_1.default.find().populate('userId', 'name email'), query)
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
    const questionQuery = new QueryBuilder_1.default(ask_question_model_1.default.find({ userId }), query)
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
    const result = yield ask_question_model_1.default.findByIdAndUpdate(id, {
        answer,
        status: 'answered',
        answeredAt: new Date(),
    }, { new: true, runValidators: true }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Question not found');
    }
    // Notify the user
    if (result.userId) {
        new NotificationBuilder_1.default()
            .to(result.userId.toString())
            .setTitle('Question Answered')
            .setText('An Imam has answered your question.')
            .setType('QUESTION_ANSWERED')
            .setResource('AskQuestion', id)
            .viaAll()
            .send()
            .catch(err => console.error('Notification Error:', err));
    }
    return result;
});
const getQuestionMetricsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const aggregationBuilder = new AggregationBuilder_1.default(ask_question_model_1.default);
    // Total questions growth
    const totalStats = yield aggregationBuilder.calculateGrowth({
        period: 'month',
    });
    // Answered questions growth
    const answeredStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: 'answered' },
        period: 'month',
    });
    // Pending questions growth
    const pendingStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: 'pending' },
        period: 'month',
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: stat.growth,
        direction: stat.growthType === 'increase'
            ? 'up'
            : stat.growthType === 'decrease'
                ? 'down'
                : 'neutral',
    });
    return {
        meta: {
            comparisonPeriod: 'month',
        },
        totalQuestions: formatMetric(totalStats),
        answeredQuestions: formatMetric(answeredStats),
        pendingQuestions: formatMetric(pendingStats),
    };
});
exports.AskQuestionService = {
    submitQuestionIntoDB,
    getAllQuestionsFromDB,
    getMyQuestionsFromDB,
    answerQuestionInDB,
    getQuestionMetricsFromDB,
};
