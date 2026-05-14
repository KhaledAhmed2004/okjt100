# 03. Cancel Pending Request

```http
DELETE /connections/:connectionId/request
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows the **sender** of a pending connection request to cancel (undo) it before the receiver responds. Uses `DELETE` because the pending request document is permanently removed.

## Implementation
- **Route**: [connection.route.ts](file:///src/app/modules/connection/connection.route.ts)
- **Controller**: [connection.controller.ts](file:///src/app/modules/connection/connection.controller.ts) — `cancelRequest`
- **Service**: [connection.service.ts](file:///src/app/modules/connection/connection.service.ts) — `cancelRequest`

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `connectionId` | ObjectId string | ✅ | The `_id` of the pending `Connection` document (received from `POST /connections/request/:userId` or from the `connectionId` field in `GET /users/profiles`) |

## Business Rules
- **Only the sender** can cancel — receivers must use `PATCH /:connectionId/respond` with `action: "REJECT"` instead.
- The connection must be in `PENDING` status. Attempting to cancel an already `ACCEPTED` connection returns `400`.
- The connection document is **permanently deleted**. After cancellation, `GET /users/profiles` will show `connectionStatus: "NONE"` for that user again.
- No notification is sent to the receiver on cancel.

## Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection request cancelled successfully"
}
```

### Not Found (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Connection request not found"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only the sender can cancel this request"
}
```

### Bad Request (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "This request is no longer pending"
}
```

## Difference vs Remove Connection

| | Cancel Request (`DELETE /:id/request`) | Remove Connection (`DELETE /:id`) |
|---|---|---|
| **Status required** | `PENDING` | `ACCEPTED` |
| **Who can call** | Sender only | Either user |
| **Chat effect** | None | Chat marked inactive |
