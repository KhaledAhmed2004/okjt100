"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const notification_routes_1 = require("../app/modules/notification/notification.routes");
const subscription_route_1 = require("../app/modules/subscription/subscription.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const legal_route_1 = require("../app/modules/legal/legal.route");
const khutbah_route_1 = require("../app/modules/khutbah/khutbah.route");
const mosque_route_1 = require("../app/modules/mosque/mosque.route");
const ask_question_route_1 = require("../app/modules/ask-question/ask-question.route");
const group_route_1 = require("../app/modules/group/group.route");
const pending_email_route_1 = require("../app/modules/pending-email/pending-email.route");
const support_ticket_route_1 = require("../app/modules/support-ticket/support-ticket.route");
const learning_content_route_1 = require("../app/modules/learning-content/learning-content.route");
const dua_route_1 = require("../app/modules/dua/dua.route");
const connection_route_1 = require("../app/modules/connection/connection.route");
const chat_route_1 = require("../app/modules/chat/chat.route");
const message_route_1 = require("../app/modules/message/message.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/notifications',
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: '/subscriptions',
        route: subscription_route_1.SubscriptionRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/legal',
        route: legal_route_1.LegalRoutes,
    },
    {
        path: '/khutba',
        route: khutbah_route_1.KhutbaRoutes,
    },
    {
        path: '/mosques',
        route: mosque_route_1.MosqueRoutes,
    },
    {
        path: '/ask-question',
        route: ask_question_route_1.AskQuestionRoutes,
    },
    {
        path: '/groups',
        route: group_route_1.GroupRoutes,
    },
    {
        path: '/admin/pending-emails',
        route: pending_email_route_1.PendingEmailRoutes,
    },
    {
        path: '/support-tickets',
        route: support_ticket_route_1.SupportTicketRoutes,
    },
    {
        path: '/learning-contents',
        route: learning_content_route_1.LearningContentRoutes,
    },
    {
        path: '/duas',
        route: dua_route_1.DuaRoutes,
    },
    {
        path: '/connections',
        route: connection_route_1.ConnectionRoutes,
    },
    {
        path: '/chats',
        route: chat_route_1.ChatRoutes,
    },
    {
        path: '/messages',
        route: message_route_1.MessageRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
