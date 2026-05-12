"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskImamRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const ask_imam_controller_1 = require("./ask-imam.controller");
const ask_imam_validation_1 = require("./ask-imam.validation");
const router = express_1.default.Router();
// User routes
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, fileHandler_1.fileHandler)([{ name: 'image', maxCount: 1 }]), (0, validateRequest_1.default)(ask_imam_validation_1.AskImamValidation.submitQuestionZodSchema), ask_imam_controller_1.AskImamController.submitQuestion);
router.get('/my-questions', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), ask_imam_controller_1.AskImamController.getMyQuestions);
// Admin routes
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), ask_imam_controller_1.AskImamController.getAllQuestions);
router.get('/analytics', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), ask_imam_controller_1.AskImamController.getAnalytics);
router.patch('/:questionId/answer', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(ask_imam_validation_1.AskImamValidation.answerQuestionZodSchema), ask_imam_controller_1.AskImamController.answerQuestion);
exports.AskImamRoutes = router;
