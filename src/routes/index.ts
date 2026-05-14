import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { KhutbaRoutes } from '../app/modules/khutbah/khutbah.route';
import { MosqueRoutes } from '../app/modules/mosque/mosque.route';
import { AskQuestionRoutes } from '../app/modules/ask-question/ask-question.route';
import { GroupRoutes } from '../app/modules/group/group.route';
import { PendingEmailRoutes } from '../app/modules/pending-email/pending-email.route';
import { SupportTicketRoutes } from '../app/modules/support-ticket/support-ticket.route';
import { LearningContentRoutes } from '../app/modules/learning-content/learning-content.route';
import { DuaRoutes } from '../app/modules/dua/dua.route';
import { ConnectionRoutes } from '../app/modules/connection/connection.route';
import { ChatRoutes } from '../app/modules/chat/chat.route';
import { MessageRoutes } from '../app/modules/message/message.route';

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
    path: '/ask-question',
    route: AskQuestionRoutes,
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
  {
    path: '/learning-contents',
    route: LearningContentRoutes,
  },
  {
    path: '/duas',
    route: DuaRoutes,
  },
  {
    path: '/connections',
    route: ConnectionRoutes,
  },
  {
    path: '/chats',
    route: ChatRoutes,
  },
  {
    path: '/messages',
    route: MessageRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
