# 03. Mark Chat as Read

```http
POST /messages/chat/:chatId/read
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Marks all messages in a specific chat as read for the logged-in user.

---

## 2. Business Rules
- **Filtering**: Only updates messages where the logged-in user is NOT the sender and hasn't already read the message.
- **Real-time**: Emits `MESSAGE_READ` for each updated message to the chat room.
- **Cache**: Resets the unread count cache for this user in this chat.

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat marked as read",
  "data": {
    "modifiedCount": 5,
    "updatedIds": ["...", "..."]
  }
}
```
