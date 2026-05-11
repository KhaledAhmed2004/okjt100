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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MosqueService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const mosque_model_1 = __importDefault(require("./mosque.model"));
const createMosqueIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_model_1.default.create(payload);
    return result;
});
const getAllMosquesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const searchableFields = ['mosqueName', 'area', 'address'];
    const mosqueQuery = new QueryBuilder_1.default(mosque_model_1.default.find(), query)
        .textSearch(searchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield mosqueQuery.modelQuery;
    const pagination = yield mosqueQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const getSingleMosqueFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_model_1.default.findById(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    return result;
});
const updateMosqueIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { location, prayerTimes } = payload, remainingData = __rest(payload, ["location", "prayerTimes"]);
    const modifiedUpdatedData = Object.assign({}, remainingData);
    if (location && Object.keys(location).length > 0) {
        for (const [key, value] of Object.entries(location)) {
            modifiedUpdatedData[`location.${key}`] = value;
        }
    }
    if (prayerTimes && Object.keys(prayerTimes).length > 0) {
        for (const [key, value] of Object.entries(prayerTimes)) {
            modifiedUpdatedData[`prayerTimes.${key}`] = value;
        }
    }
    const result = yield mosque_model_1.default.findByIdAndUpdate(id, modifiedUpdatedData, {
        new: true,
        runValidators: true,
    }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    return result;
});
const deleteMosqueFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_model_1.default.findByIdAndDelete(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    return result;
});
exports.MosqueService = {
    createMosqueIntoDB,
    getAllMosquesFromDB,
    getSingleMosqueFromDB,
    updateMosqueIntoDB,
    deleteMosqueFromDB,
};
