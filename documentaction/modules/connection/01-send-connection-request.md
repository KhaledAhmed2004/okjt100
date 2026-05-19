# 01. Send Connection Request

```http
POST /connections/request/:userId
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Allows a user to send a connection request to another user. If the request is successful, a pending connection record is created, and the receiver is notified via Socket.IO and Push Notification.

---

## 2. Business Rules
- **Self-Connect**: Users cannot send requests to themselves.
- **Receiver Status**: The receiver must exist and have an `ACTIVE` status.
- **Pending Limit**: A user can have a maximum of **50** outgoing pending requests at any time to prevent spam.
- **Duplicates**: Only one connection/request can exist between two users at a time (prevented by `connectionKey` unique index). If a connection is already `ACCEPTED`, returns "You are already connected with this user".
- **Notifications**: 
  - Emits `CONNECTION_REQUEST` to the receiver's room.
  - Sends a `SYSTEM` type in-app notification to the receiver.

---

## 3. Input Validation (Zod)
- `params.userId`: Must be a valid MongoDB ObjectId.

---

## 4. Implementation
- **Route**: [src/app/modules/connection/connection.route.ts](../../../src/app/modules/connection/connection.route.ts)
- **Controller**: [src/app/modules/connection/connection.controller.ts](../../../src/app/modules/connection/connection.controller.ts)
- **Service**: [src/app/modules/connection/connection.service.ts](../../../src/app/modules/connection/connection.service.ts)

---

## 5. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Connection request sent successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d1a",
    "sender": "664a1b2c3d4e5f6a7b8c9d1b",
    "receiver": "664a1b2c3d4e5f6a7b8c9d1c",
    "status": "PENDING",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  }
}
```

### Rate Limited (429)
```json
{
  "success": false,
  "statusCode": 429,
  "message": "You have reached the maximum number of pending requests (50)"
}
```
