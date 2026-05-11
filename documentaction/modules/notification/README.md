# Notification Module APIs

> **Section**: Backend API specifications for the notification module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - [App Notifications](../../app-screens/07-notifications.md) — Bell, list, mark-read, delete

---

## Overview

System-e bibhinno action-er upor vitti kore user-der notification pathano hoy. Ei notification gula main-ly 3-ti channel-e jete pare:
1. **Push Notification**: Firebase (FCM) er maddhome mobile device-e.
2. **Socket Notification**: Socket.io er maddhome real-time app-er bhitor.
3. **Database Notification**: MongoDB-te save thake jeta user pore "Notification List" theke dekhte pare.

### Notification Types & Triggers

Current system-e nicher dhoron-er notification gula trigger hoy:

#### 1. Event Reminders (Calendar)
- **Trigger 1**: Event shuru hovar **24 ghonta age**.
- **Trigger 2**: Event shuru hovar **1 ghonta age**.
- **Channels**: Push, Database, Socket.
- **Content**: `Your event "{{title}}" is in 24 hours/1 hour`.
- **Logic**: `EventService` theke `scheduleEventReminders` call kora hoy.

#### 2. Preference Card Notifications
- **Trigger**: Jokhon kono notun **Preference Card** create ba add kora hoy.
- **Channels**: Database, Socket.
- **Content**: `New Card Added: {{surgeonName}} — {{procedure}}`.
- **Logic**: `PreferenceCardService` theke `NotificationService.createForPreferenceCard` call kora hoy.

#### 3. Event Scheduled Confirmation
- **Trigger**: Jokhon kono notun **Event** schedule kora hoy.
- **Channels**: Database, Socket.
- **Content**: `Event Scheduled: {{title}} on {{whenText}}`.
- **Logic**: `EventService` theke `NotificationService.createForEventScheduled` call kora hoy.

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation | Used By |
|---|---|---|---|---|---|
| 01 | GET | `/notifications` | Bearer | [01-get-my-notifications.md](./01-get-my-notifications.md) | [App Notifications](../../app-screens/07-notifications.md) |
| 02 | PATCH | `/notifications/:notificationId/read` | Bearer | [02-mark-as-read.md](./02-mark-as-read.md) | [App Notifications](../../app-screens/07-notifications.md) |
| 03 | PATCH | `/notifications/read-all` | Bearer | [03-mark-all-as-read.md](./03-mark-all-as-read.md) | [App Notifications](../../app-screens/07-notifications.md) |
| 04 | DELETE | `/notifications/:notificationId` | Bearer | [04-delete-notification.md](./04-delete-notification.md) | [App Notifications](../../app-screens/07-notifications.md) |

---

## Fan-out & Infrastructure

Notification system-er backend logic multiple layers-e divided:

### 1. Multi-Channel Fan-out
Kono trigger hole `sendNotifications` helper use kora hoy:
- **Persistence**: MongoDB-te save hoy.
- **Real-time**: Socket.io-r maddhome user-er specific room-e event emit hoy (`get-notification::${userId}`).
- **Push**: User-er saved `deviceTokens` use kore Firebase (FCM) push notification pathano hoy.

### 2. Notification Builder
Complex logic ebong future scheduling-er jonno `NotificationBuilder` use kora hoy:
- **Chainable API**: `.to(user).useTemplate(name).viaAll().send()`.
- **Scheduling**: `scheduleAfter('2h')` use kore future notifications schedule kora jay.
- **Polymorphic Reference**: `resourceType` ebong `resourceId` use kore notification-ke Preference Card ba Event-er shathe link kora hoy.

### 3. Automatic Expiry
- **TTL Index**: Notification schema-te `expiresAt` field-er opor TTL index ache, jeta default-e **30 days** por notification auto-delete kore dei.

---

## Module-level helpers

Notifications use a multi-channel fan-out pattern that's shared across triggering services:

- **Model**: [notification.model.ts](file:///src/app/modules/notification/notification.model.ts) — Schema (`userId`, `type`, `title`, `subtitle`, `isRead`, `icon`).
- **Helper**: [notificationsHelper.ts](file:///src/app/modules/notification/notificationsHelper.ts) — Socket emission (`notification:new`) + FCM push.
- **Builder**: [NotificationBuilder.ts](file:///src/app/builder/NotificationBuilder/NotificationBuilder.ts) — Unified API for complex multi-channel notifications.

For cross-cutting error responses (401, 429, 400), see [Common Error Scenarios](../../README.md#common-error-scenarios).

---

## API Status

| # | Endpoint | Method | Auth | Status | Notes |
|---|---|---|---|:---:|---|
| 01 | `/notifications` | `GET` | Bearer | Done | Paginated list — backend returns `unreadCount` in `meta` |
| 02 | `/notifications/:notificationId/read` | `PATCH` | Bearer | Done | Mark single as read |
| 03 | `/notifications/read-all` | `PATCH` | Bearer | Done | Mark all as read |
| 04 | `/notifications/:notificationId` | `DELETE` | Bearer | Done | Soft delete (`deletedAt`) |
