import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { KhutbaRoutes } from '../app/modules/khutbah/khutbah.route';
import { MosqueRoutes } from '../app/modules/mosque/mosque.route';
import { AskImamRoutes } from '../app/modules/ask-imam/ask-imam.route';
import { GroupRoutes } from '../app/modules/group/group.route';
import { PendingEmailRoutes } from '../app/modules/pending-email/pending-email.route';
import { SupportTicketRoutes } from '../app/modules/support-ticket/support-ticket.route';

const router = express.Router();

const apiRoutes = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },
  {
    path: '/admin',
    route: AdminRoutes,
  },
  {
    path: '/legal',
    route: LegalRoutes,
  },
  {
    path: '/khutba',
    route: KhutbaRoutes,
  },
  {
    path: '/mosques',
    route: MosqueRoutes,
  },
  {
    path: '/ask-imam',
    route: AskImamRoutes,
  },
  {
    path: '/groups',
    route: GroupRoutes,
  },
  {
    path: '/admin/pending-emails',
    route: PendingEmailRoutes,
  },
  {
    path: '/support-tickets',
    route: SupportTicketRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
