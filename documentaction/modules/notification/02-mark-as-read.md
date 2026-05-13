# 02. Mark as Read

```http
PATCH /api/v1/notifications/:notificationId/read
Auth: Bearer {{accessToken}}
```

> Marks a single notification as read. This is typically called immediately when a user taps on a notification.

## Implementation
- **Route**: [notification.routes.ts](file:///src/app/modules/notification/notification.routes.ts)
- **Controller**: [notification.controller.ts](file:///src/app/modules/notification/notification.controller.ts) — `readNotification`
- **Service**: [notification.service.ts](file:///src/app/modules/notification/notification.service.ts) — `markNotificationAsReadIntoDB`

**Business Logic (`readNotification`):**
- **Ownership Check**: Only the intended recipient (`receiver`) of the notification can mark it as read.
- **Validation**: Verifies the notification exists in the database.
- **Idempotency**: If the notification is already marked as read (`isRead: true`), the server will still return a success response.
- **Timestamp**: Updates the `readAt` field with the current server time upon successful update.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d11",
    "receiver": "664a1b2c3d4e5f6a7b8c9d00",
    "type": "ADMIN",
    "title": "System Update",
    "text": "Maintenance scheduled for tomorrow.",
    "isRead": true,
    "readAt": "2026-05-13T10:00:00.000Z",
    "createdAt": "2026-04-09T08:00:00.000Z",
    "updatedAt": "2026-05-13T10:00:00.000Z"
  }
}
```
