# 02. List My Chats

```http
GET /chats?searchTerm=John
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Fetches all chat conversations for the logged-in user, including last message preview, unread count, and participant presence.

---

## 2. Business Rules
- **Search**: `searchTerm` filters by the other participant's name.
- **Last Message**: Includes the most recent message in each chat.
- **Unread Count**: Calculates the number of messages not yet read by the logged-in user.
- **Presence**: Includes real-time `isOnline` status and `lastActive` timestamp for the other participant.

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat Retrieve Successfully",
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d1z",
      "participants": [
        {
          "_id": "664a1b2c3d4e5f6a7b8c9d1c",
          "name": "Jane Doe",
          "image": "...",
          "role": "SISTER"
        }
      ],
      "status": true,
      "lastMessage": {
        "text": "Hello there!",
        "createdAt": "..."
      },
      "unreadCount": 2,
      "presence": {
        "isOnline": true,
        "lastActive": 1715680000000
      }
    }
  ]
}
```
