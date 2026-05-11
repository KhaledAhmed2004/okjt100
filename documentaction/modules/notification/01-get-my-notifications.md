# 01. Get My Notifications

```http
GET /notifications
Auth: Bearer {{accessToken}}
```

**Business Logic (`listForUser`):**
- **Query Strategy**: Notifications list ebong **unreadCount** alada query-te fetch kora hoy. Efficiency-er jonno database indexes optimized kora ache.
- **Index Optimization**: `{ userId: 1, deletedAt: 1, createdAt: -1 }` compound index use kora hoy query performance fast korar jonno.
- **Visibility**: Shudhu `deletedAt: null` records return kora hoy (Soft Delete implementation).
- **Unread Count**: `meta.unreadCount` is computed as `count({ userId, isRead: false, deletedAt: null })` — the user's total unread notifications across all pages. The mobile bell-icon red dot is rendered from this single field (`meta.unreadCount > 0`).
- **Pagination**: Cursor-based pagination use kora hoy (`nextCursor`) infinite scroll support korar jonno.

### Notification Triggers (When are they created?)

System-e nicher event-gulo ghotle notification generate hoy:

| Trigger | Type | Timing | Channels |
|---|---|---|---|
| **Event Reminder (24h)** | `REMINDER` | 24 hours before event | DB, Push |
| **Event Reminder (1h)** | `REMINDER` | 1 hour before event | DB, Push |

> **Note**: Event reminders alada collection-e schedule kora hoy ebong thik shomoy moto trigger hoy.

### Meta Object Explanation

| Field | Type | Description |
|---|---|---|
| `limit` | Number | Protiti request-e koiti notification ashbe (Default: 20). |
| `nextCursor` | String/Null | Poroborti page fetch korar jonno encoded string. Data na thakle `null`. |
| `hasMore` | Boolean | Aro notification ache kina ta bujhay (`true` hole infinite scroll continue hobe). |
| `unreadCount` | Number | User-er total unread notifications (not just this page). |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "meta": {
    "limit": 20,
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTA5VDA4OjAwOjAwLjAwMFoiLCJf...",
    "hasMore": true,
    "unreadCount": 7
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d11",
      "userId": "664a1b2c3d4e5f6a7b8c9d00",
      "title": "Event Reminder",
      "subtitle": "Surgery on 2026-04-10 at 08:00",
      "type": "REMINDER",
      "isRead": false,
      "icon": "calendar",
      "createdAt": "2026-04-09T08:00:00.000Z",
      "updatedAt": "2026-04-09T08:00:00.000Z"
    }
  ]
}
```

### Scenario: Empty State (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "meta": {
    "limit": 20,
    "nextCursor": null,
    "hasMore": false,
    "unreadCount": 0
  },
  "data": []
}
```

> `meta.unreadCount` returns the user's total unread notification count across all pages, not just this page.
