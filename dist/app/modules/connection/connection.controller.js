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
exports.ConnectionController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const connection_service_1 = require("./connection.service");
const sendConnectionRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.user.id;
    const receiverId = req.params.userId;
    const result = yield connection_service_1.ConnectionService.sendConnectionRequest(senderId, receiverId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Connection request sent successfully',
        data: result,
    });
}));
const respondToConnectionRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const connectionId = req.params.connectionId;
    const action = req.body.action;
    const result = yield connection_service_1.ConnectionService.respondToConnectionRequest(connectionId, userId, action);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Connection request ${action.toLowerCase()}ed successfully`,
        data: result,
    });
}));
const cancelConnectionRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const connectionId = req.params.connectionId;
    yield connection_service_1.ConnectionService.cancelConnectionRequest(connectionId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Connection request cancelled successfully',
    });
}));
const removeConnection = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const connectionId = req.params.connectionId;
    yield connection_service_1.ConnectionService.removeConnection(connectionId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Connection removed successfully',
    });
}));
const getMyConnections = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield connection_service_1.ConnectionService.getMyConnections(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Connections retrieved successfully',
        data: result.data,
        meta: result.pagination,
    });
}));
const getPendingConnectionRequests = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const type = req.query.type || 'received';
    // Clone query and remove 'type' so QueryBuilder doesn't try to filter the DB by it
    const queryObj = Object.assign({}, req.query);
    delete queryObj.type;
    const result = yield connection_service_1.ConnectionService.getPendingConnectionRequests(userId, type, queryObj);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: type === 'sent' ? 'Sent connection requests fetched successfully' : 'Received connection requests fetched successfully',
        data: result.data,
        meta: result.pagination,
    });
}));
const getConnectionStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const otherUserId = req.params.userId;
    const result = yield connection_service_1.ConnectionService.getConnectionStatus(userId, otherUserId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Connection status retrieved successfully',
        data: result,
    });
}));
exports.ConnectionController = {
    sendConnectionRequest,
    respondToConnectionRequest,
    cancelConnectionRequest,
    removeConnection,
    getMyConnections,
    getPendingConnectionRequests,
    getConnectionStatus,
};
