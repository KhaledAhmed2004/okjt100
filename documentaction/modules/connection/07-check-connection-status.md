# 07. Check Connection Status

```http
GET /connections/status/:userId
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Checks the current connection status between the logged-in user and another specific user. This is primarily used for UI buttons (e.g., "Connect", "Pending", "Message").

---

## 2. Business Rules
Returns one of the following statuses:
- `PENDING_SENT`: Logged-in user sent the request, waiting for receiver.
- `PENDING_RECEIVED`: Other user sent the request, waiting for logged-in user.
- `ACCEPTED`: Users are connected.
- `NONE`: No connection or request exists.

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection status retrieved successfully",
  "data": {
    "status": "PENDING_SENT",
    "connectionId": "664a1b2c3d4e5f6a7b8c9d1a"
  }
}
```
