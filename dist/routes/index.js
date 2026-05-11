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
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
