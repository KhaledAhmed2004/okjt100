# 01. Get My Notifications

```http
GET /api/v1/notifications
Auth: Bearer {{accessToken}}
```

**Business Logic (`getNotificationFromDB`):**
- **Query Strategy**: Fetches the notification list and **unreadCount** in separate queries for accuracy.
- **Index Optimization**: Uses `{ receiver: 1, createdAt: -1 }` and `{ receiver: 1, isRead: 1 }` compound indexes to ensure fast query performance.
- **Unread Count**: The `unreadCount` represents the total number of unread notifications for the user across all pages. This is typically used to render the red dot on the notification bell icon in mobile/web apps.
- **Pagination**: Supports page-based pagination (`page`, `limit`) using the `QueryBuilder`.

### Notification Types

The system can generate notifications for the following events:

| Type | Description |
|---|---|
| `ADMIN` | Broadcast notifications sent by admins. |
| `SYSTEM` | System-generated alerts. |
| `QUESTION_ANSWERED` | When an Imam answers a user's question. |
| `NEW_QUESTION` | When a new question is submitted (Admin/Imam notification). |
| `POST_LIKED` | When someone likes a group post. |
| `POST_COMMENTED` | When someone comments on a group post. |
| `COMMENT_REPLIED` | When someone replies to a comment. |
| `CONTENT_LIKED` | When someone likes learning content. |
| `CONTENT_COMMENTED` | When someone comments on learning content. |
| `NEW_CONTENT` | When new learning content is published. |
| `NEW_KHUTBAH` | When a new Khutbah is uploaded. |
| `MOSQUE_UPDATE` | When a mosque profile is updated. |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "data": {
    "data": [
      {
        "_id": "664a1b2c3d4e5f6a7b8c9d11",
        "receiver": "664a1b2c3d4e5f6a7b8c9d00",
        "type": "ADMIN",
        "title": "System Update",
        "text": "Maintenance scheduled for tomorrow.",
        "isRead": false,
        "createdAt": "2026-04-09T08:00:00.000Z",
        "updatedAt": "2026-04-09T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPage": 1
    },
    "unreadCount": 1
  }
}
```

### Scenario: Empty State (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "data": {
    "data": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "totalPage": 0
    },
    "unreadCount": 0
  }
}
```
