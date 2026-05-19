# 02. Respond to Request

```http
PATCH /connections/:connectionId
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Allows the receiver of a connection request to either `ACCEPT` or `REJECT` it.

---

## 2. Business Rules
- **Authorization**: Only the `receiver` of the request can respond.
- **Status Check**: The request must currently be in `PENDING` status.
- **Action: ACCEPT** (Wrapped in Mongoose Transaction for Atomicity):
  - Updates status to `ACCEPTED`.
  - Automatically creates a `Chat` between the two users (or reactivates an existing one).
  - Emits `CONNECTION_ACCEPTED` to the sender.
  - Sends a `SYSTEM` notification to the sender.
- **Action: REJECT**:
  - Deletes the connection record from the database.
  - Emits `CONNECTION_REJECTED` to the sender.

---

## 3. Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `action` | `string` | Yes | Either `ACCEPT` or `REJECT` |

```json
{
  "action": "ACCEPT"
}
```

---

## 4. Responses

### Success (200) - ACCEPTED
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection request accepted successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d1a",
    "status": "ACCEPTED",
    "chatId": "664a1b2c3d4e5f6a7b8c9d1z",
    "respondedAt": "2026-05-14T10:05:00.000Z"
  }
}
```
