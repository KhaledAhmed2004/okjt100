"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const chat_controller_1 = require("./chat.controller");
const user_1 = require("../../../enums/user");
const router = express_1.default.Router();
// ============ SHARED ROUTES (Student / Tutor / Admin) ============
// Create or get a chat with another user
router.post('/:otherUserId', (0, auth_1.default)(user_1.USER_ROLES.STUDENT, user_1.USER_ROLES.TUTOR, user_1.USER_ROLES.SUPER_ADMIN), chat_controller_1.ChatController.createChat);
// Get all chats for the logged-in user
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.STUDENT, user_1.USER_ROLES.TUTOR, user_1.USER_ROLES.SUPER_ADMIN), chat_controller_1.ChatController.getChat);
exports.ChatRoutes = router;
