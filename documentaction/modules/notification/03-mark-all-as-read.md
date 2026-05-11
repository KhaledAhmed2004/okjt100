# 03. Mark All as Read

```http
PATCH /notifications/read-all
Auth: Bearer {{accessToken}}
```

> User top-right "Mark all as read" button e tap korle shob notifications `isRead: true` hoy ebong red dot disappear kore.

**Business Logic (`markAllRead`):**
- **Bulk Update**: `updateMany` use kore ek-i call-e user-er shob unread notifications read mark kora hoy.
- **Idempotency**: Jodi kono unread notification na thake, tobeo request successful hobe (0 documents updated).
