# API Inventory & Implementation Tracker

> **Tracker view** — every endpoint, its wiring status, and where it appears across screens. For full specs, follow the **Spec** column. For UX flows, follow the **On a screen?** column.

> **Mount prefixes** (see `src/routes/index.ts`): `/users`, `/auth`, `/notifications`, `/subscriptions`, `/admin`, `/legal`, `/khutba`, `/mosques`, `/ask-imam`, `/groups`.
> **Base URL:** `/api/v1`
> **Documentation:** `/api/v1/docs` (Swagger UI)

**Status legend**: ✅ Done · 🟡 Spec done, code pending · ❌ Not implemented · — Orphan / not used

---

## Auth Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 1.1 | POST | `/auth/login` | Public | ✅ | [Module 1.1](./modules/auth/01-login.md) | — |
| 1.2 | POST | `/auth/verify-otp` | Public | ✅ | [Module 1.2](./modules/auth/02-verify-otp.md) | — |
| 1.3 | POST | `/auth/forgot-password` | Public | ✅ | [Module 1.3](./modules/auth/03-forgot-password.md) | — |
| 1.4 | POST | `/auth/reset-password` | Reset Token | ✅ | [Module 1.4](./modules/auth/04-reset-password.md) | — |
| 1.5 | POST | `/auth/refresh-token` | Refresh Token | ✅ | [Module 1.5](./modules/auth/05-refresh-token.md) | — |
| 1.6 | POST | `/auth/logout` | Bearer | ✅ | [Module 1.6](./modules/auth/06-logout.md) | — |
| 1.7 | POST | `/auth/resend-otp` | Public | ✅ | [Module 1.7](./modules/auth/07-resend-otp.md) | — |
| 1.8 | POST | `/auth/social-login` | Public | ✅ | [Module 1.8](./modules/auth/08-social-login.md) | — |
| 1.9 | POST | `/auth/change-password` | Bearer | ✅ | [Module 1.9](./modules/auth/09-change-password.md) | — |
| 1.10 | POST | `/auth/restore-account` | Public | ✅ | [Module 1.10](./modules/auth/10-restore-account.md) | — |

## User Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 2.1 | POST | `/users` | Public / SUPER_ADMIN | ✅ | [Module 2.1](./modules/user/01-create-user.md) | — |
| 2.2 | GET | `/users/:userId/user` | User / Admin | ✅ | [Module 2.2](./modules/user/02-get-user-details-public.md) | — |
| 2.3 | GET | `/users/me` | Bearer | ✅ | [Module 2.3](./modules/user/03-get-own-profile.md) | — |
| 2.4 | PATCH | `/users/me` | Bearer | ✅ | [Module 2.4](./modules/user/04-update-own-profile.md) | — |
| 2.6 | DELETE | `/users/me` | Bearer | ✅ | [Module 2.6](./modules/user/06-delete-account.md) | — |
| 2.7 | POST | `/users/email-change-request` | Bearer | ✅ | [Module 2.7](./modules/user/07-email-change-request.md) | — |
| 2.8 | POST | `/users/email-change-confirm` | Bearer | ✅ | [Module 2.8](./modules/user/08-email-change-confirm.md) | — |
| 2.9 | GET | `/users/data-export` | Bearer | ✅ | [Module 2.9](./modules/user/09-data-export.md) | — |
| 2.10 | GET | `/users/sessions` | Bearer | ✅ | [Module 2.10](./modules/user/10-list-sessions.md) | — |
| 2.11 | DELETE | `/users/sessions/:sessionId` | Bearer | ✅ | [Module 2.11](./modules/user/11-revoke-session.md) | — |
| 2.12 | DELETE | `/users/sessions` | Bearer | ✅ | [Module 2.12](./modules/user/12-revoke-all-sessions.md) | — |
| 2.13 | POST | `/users/reverify` | Public | ✅ | [Module 2.13](./modules/user/13-reverify-account.md) | — |
| 2.14 | GET | `/users` | SUPER_ADMIN | ✅ | [Module 2.14](./modules/user/14-list-users-admin.md) | — |
| 2.15 | GET | `/users/metrics` | SUPER_ADMIN | ✅ | [Module 2.15](./modules/user/15-user-stats-admin.md) | — |
| 2.16 | GET | `/users/:userId` | SUPER_ADMIN | ✅ | [Module 2.16](./modules/user/16-get-user-admin.md) | — |
| 2.17 | PATCH | `/users/:userId` | SUPER_ADMIN | ✅ | [Module 2.17](./modules/user/17-update-user-admin.md) | — |
| 2.18 | DELETE | `/users/:userId` | SUPER_ADMIN | ✅ | [Module 2.18](./modules/user/18-delete-user-admin.md) | — |
| 2.19 | PATCH | `/users/:userId/review` | SUPER_ADMIN | ✅ | [Module 2.19](./modules/user/21-review-user-admin.md) | — |

## Ask Imam Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 3.1 | POST | `/ask-imam` | User | ✅ | [Module 3.1](./modules/ask-imam/01-submit-question.md) | — |
| 3.2 | GET | `/ask-imam` | User / Imam | ✅ | [Module 3.2](./modules/ask-imam/02-get-all-questions.md) | — |
| 3.3 | GET | `/ask-imam/my-questions` | User | ✅ | [Module 3.3](./modules/ask-imam/03-get-my-questions.md) | — |
| 3.4 | PATCH | `/ask-imam/:questionId/answer` | Imam | ✅ | [Module 3.4](./modules/ask-imam/04-answer-question.md) | — |
| 3.5 | GET | `/ask-imam/analytics` | Imam / Admin | ✅ | [Module 3.5](./modules/ask-imam/05-get-analytics.md) | — |

## Group Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 4.1 | POST | `/groups` | User | ✅ | [Module 4.1](./modules/group/01-create-group.md) | — |
| 4.2 | GET | `/groups` | User | ✅ | [Module 4.2](./modules/group/02-list-groups.md) | — |
| 4.3 | POST | `/groups/:groupId/join` | User | ✅ | [Module 4.3](./modules/group/03-join-group.md) | — |
| 4.4 | POST | `/groups/:groupId/posts` | User | ✅ | [Module 4.4](./modules/group/04-create-post.md) | — |
| 4.5 | GET | `/groups/feed` | User | ✅ | [Module 4.5](./modules/group/05-get-feed.md) | — |
| 4.6 | POST | `/groups/posts/:postId/like` | User | ✅ | [Module 4.6](./modules/group/06-like-post.md) | — |
| 4.7 | POST | `/groups/posts/:postId/comments` | User | ✅ | [Module 4.7](./modules/group/07-add-comment.md) | — |

## Khutbah Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 5.1 | POST | `/khutba` | Imam / Admin | ✅ | [Module 5.1](./modules/khutbah/01-create-khutba.md) | — |
| 5.2 | GET | `/khutba` | Public | ✅ | [Module 5.2](./modules/khutbah/02-get-all-khutbahs.md) | — |
| 5.3 | GET | `/khutba/:khutbahId` | Public | ✅ | [Module 5.3](./modules/khutbah/03-get-single-khutba.md) | — |
| 5.4 | PATCH | `/khutba/:khutbahId` | Imam / Admin | ✅ | [Module 5.4](./modules/khutbah/04-update-khutba.md) | — |
| 5.5 | DELETE | `/khutba/:khutbahId` | Imam / Admin | ✅ | [Module 5.5](./modules/khutbah/05-delete-khutba.md) | — |

## Mosque Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 6.1 | POST | `/mosques` | Admin | ✅ | [Module 6.1](./modules/mosque/01-create-mosque.md) | — |
| 6.2 | GET | `/mosques` | Public | ✅ | [Module 6.2](./modules/mosque/02-get-all-mosques.md) | — |
| 6.3 | GET | `/mosques/:mosqueId` | Public | ✅ | [Module 6.3](./modules/mosque/03-get-single-mosque.md) | — |
| 6.4 | PATCH | `/mosques/:mosqueId` | Admin | ✅ | [Module 6.4](./modules/mosque/04-update-mosque.md) | — |
| 6.5 | DELETE | `/mosques/:mosqueId` | Admin | ✅ | [Module 6.5](./modules/mosque/05-delete-mosque.md) | — |

## Notification Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 7.1 | GET | `/notifications` | Bearer | ✅ | [Module 7.1](./modules/notification/01-get-my-notifications.md) | — |
| 7.2 | PATCH | `/notifications/:notificationId/read` | Bearer | ✅ | [Module 7.2](./modules/notification/02-mark-as-read.md) | — |
| 7.3 | PATCH | `/notifications/read-all` | Bearer | ✅ | [Module 7.3](./modules/notification/03-mark-all-as-read.md) | — |
| 7.4 | DELETE | `/notifications/:notificationId` | Bearer | ✅ | [Module 7.4](./modules/notification/04-delete-notification.md) | — |

## Legal Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 8.1 | GET | `/legal` | Public | ✅ | [Module 8.1](./modules/legal/01-list-legal-pages.md) | — |
| 8.2 | GET | `/legal/:slug` | Public | ✅ | [Module 8.2](./modules/legal/02-get-legal-page-by-slug.md) | — |
| 8.3 | POST | `/legal` | SUPER_ADMIN | ✅ | [Module 8.3](./modules/legal/03-create-legal-page.md) | — |
| 8.4 | PATCH | `/legal/:slug` | SUPER_ADMIN | ✅ | [Module 8.4](./modules/legal/04-update-legal-page.md) | — |
| 8.5 | DELETE | `/legal/:slug` | SUPER_ADMIN | ✅ | [Module 8.5](./modules/legal/05-delete-legal-page.md) | — |

## Admin Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 9.1 | GET | `/admin/growth-metrics` | SUPER_ADMIN | ✅ | [Module 9.1](./modules/admin/01-growth-metrics.md) | — |
| 9.2 | GET | `/admin/preference-cards/trends/monthly` | SUPER_ADMIN | ✅ | [Module 9.2](./modules/admin/02-monthly-preference-cards-trend.md) | — |
| 9.3 | GET | `/admin/subscriptions/trends/monthly` | SUPER_ADMIN | ✅ | [Module 9.3](./modules/admin/03-monthly-active-subscriptions-trend.md) | — |

## Learning Content Module

| ID | Method | Endpoint | Roles | Status | Spec | On a screen? |
|---|---|---|---|:---:|---|---|
| 10.1 | POST | `/learning-contents` | SUPER_ADMIN | ✅ | [Module 10.1](./modules/learning-content/01-create-content.md) | — |
| 10.2 | GET | `/learning-contents` | Bearer | ✅ | [Module 10.2](./modules/learning-content/02-list-contents.md) | — |
| 10.3 | GET | `/learning-contents/:contentId` | Bearer | ✅ | [Module 10.3](./modules/learning-content/03-get-content.md) | — |
| 10.4 | PATCH | `/learning-contents/:contentId` | SUPER_ADMIN | ✅ | [Module 10.4](./modules/learning-content/04-update-content.md) | — |
| 10.5 | DELETE | `/learning-contents/:contentId` | SUPER_ADMIN | ✅ | [Module 10.5](./modules/learning-content/05-delete-content.md) | — |
| 10.6 | POST | `/learning-contents/:contentId/like` | BROTHER, SISTER | ✅ | [Module 10.6](./modules/learning-content/06-like-content.md) | — |
| 10.7 | POST | `/learning-contents/:contentId/comments` | BROTHER, SISTER | ✅ | [Module 10.7](./modules/learning-content/07-add-comment.md) | — |
| 10.8 | GET | `/learning-contents/:contentId/comments` | Bearer | ✅ | [Module 10.8](./modules/learning-content/08-list-comments.md) | — |
| 10.9 | DELETE | `/learning-contents/comments/:commentId` | Bearer | ✅ | [Module 10.9](./modules/learning-content/09-delete-comment.md) | — |
