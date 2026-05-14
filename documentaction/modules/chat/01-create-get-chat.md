# 01. Create or Get Chat

```http
POST /chats/:otherUserId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Creates a new chat between the logged-in user and another user, or retrieves an existing one if it already exists.

---

## 2. Business Rules
- **Idempotency**: If a chat with the same participants already exists, it is returned instead of creating a new one.
- **Reactivation**: If an existing chat was marked as inactive (`status: false`), it is automatically reactivated (`status: true`).

---

## 3. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Create Chat Successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d1z",
    "participants": ["664a1b2c3d4e5f6a7b8c9d1b", "664a1b2c3d4e5f6a7b8c9d1c"],
    "status": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```
