"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const group_controller_1 = require("./group.controller");
const group_validation_1 = require("./group.validation");
const router = express_1.default.Router();
// Admin routes
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(group_validation_1.GroupValidation.createGroupZodSchema), group_controller_1.GroupController.createGroup);
// User routes
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), group_controller_1.GroupController.getAllGroups);
router.post('/:groupId/join', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), group_controller_1.GroupController.joinGroup);
router.get('/:groupId/posts', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), group_controller_1.GroupController.getGroupFeed);
router.post('/:groupId/posts', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(group_validation_1.GroupValidation.createPostZodSchema), group_controller_1.GroupController.createPost);
router.post('/posts/:postId/like', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), group_controller_1.GroupController.toggleLike);
router.post('/posts/:postId/comments', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(group_validation_1.GroupValidation.addCommentZodSchema), group_controller_1.GroupController.addComment);
exports.GroupRoutes = router;
