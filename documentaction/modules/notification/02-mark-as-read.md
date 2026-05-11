# 02. Mark as Read

```http
PATCH /notifications/:notificationId/read
Auth: Bearer {{accessToken}}
```

> Single notification ke read mark kore. Tap-er shathe shathe (optimistic) call hoy background e.

## Implementation
- **Route**: [notification.routes.ts](file:///src/app/modules/notification/notification.routes.ts)
- **Controller**: [notification.controller.ts](file:///src/app/modules/notification/notification.controller.ts) — `markRead`
- **Service**: [notification.service.ts](file:///src/app/modules/notification/notification.service.ts) — `markRead`

**Business Logic (`markRead`):**
- **Ownership Check**: Shudhu notification-er real owner-i eiti read mark korte pare.
- **Validation**: Notification existence check kora hoy.
- **Idempotency**: Notification jodi aggei `isRead: true` thake, tobeo server success response return korbe without error.
