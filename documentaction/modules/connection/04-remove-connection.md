# 04. Remove Connection

```http
DELETE /connections/:connectionId
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows either user in an **accepted** connection to permanently remove it. Both the connection record and the associated chat session are invalidated.

## Implementation
- **Route**: [connection.route.ts](file:///src/app/modules/connection/connection.route.ts)
- **Controller**: [connection.controller.ts](file:///src/app/modules/connection/connection.controller.ts) — `removeConnection`
- **Service**: [connection.service.ts](file:///src/app/modules/connection/connection.service.ts) — `removeConnection`

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `connectionId` | ObjectId string | ✅ | The `_id` of the `Connection` document (received from `GET /connections` or from the `connectionId` field in `GET /users/profiles`) |

## Business Rules
- **Either user** (sender or receiver) can remove an accepted connection.
- The associated `Chat` document is marked **inactive** (`status: false`) — message history is preserved but new messages are blocked.
- The connection document is **permanently deleted**. Users can re-connect later by sending a new request.
- A real-time `CONNECTION_REMOVED` socket event is emitted to the other user.

## Socket Event Emitted
```
Event: CONNECTION_REMOVED
Room: user::<otherUserId>
Payload: { connectionId, chatId }
```

## Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection removed successfully"
}
```

### Not Found (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Connection not found"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You are not part of this connection"
}
```

## Difference vs Cancel Request

| | Remove Connection (`DELETE /:id`) | Cancel Request (`DELETE /:id/request`) |
|---|---|---|
| **Status required** | `ACCEPTED` | `PENDING` |
| **Who can call** | Either user | Sender only |
| **Chat effect** | Chat marked inactive | No effect |
| **Socket event** | `CONNECTION_REMOVED` | None |
