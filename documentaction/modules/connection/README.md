# Connection Module APIs

> **Section**: Backend API specifications for the Connection module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - User Profile — Send connection request, check status
> - App - Connection List — View accepted connections, respond to pending requests

---

## Database Design

### Connection Model (`connections`)
Stores connection requests and established connections between users.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sender` | ObjectId | ✅ | Reference to the user who sent the request (ref `User`) |
| `receiver` | ObjectId | ✅ | Reference to the user who receives the request (ref `User`) |
| `connectionKey` | String | ✅ | Deterministic key `min(userId, otherUserId)_max(userId, otherUserId)` |
| `status` | String | ✅ | Enum: `PENDING`, `ACCEPTED` |
| `chatId` | ObjectId | ❌ | Reference to the created Chat (ref `Chat`) |
| `respondedAt` | Date | ❌ | Timestamp when the request was accepted |

**Indexes**:
- `{ connectionKey: 1 }` (Unique) — Prevents duplicate A->B and B->A requests
- `{ receiver: 1, status: 1 }` — Fast lookup for incoming pending requests
- `{ sender: 1, status: 1 }` — Fast lookup for outgoing pending requests

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/connections/request/:userId` | `BROTHER`, `SISTER` | ✅ Done: Sends a connection request. | [01-send-connection-request.md](./01-send-connection-request.md) |
| 02 | PATCH | `/connections/:connectionId/respond` | BROTHER, SISTER | ✅ Done: Accepts or rejects a request (`action: ACCEPT \| REJECT`). | [02-respond-to-request.md](./02-respond-to-request.md) |
| 03 | DELETE | `/connections/:connectionId/request` | `BROTHER`, `SISTER` | ✅ Done: Sender cancels a **PENDING** request (undo send). | [03-cancel-request.md](./03-cancel-request.md) |
| 04 | DELETE | `/connections/:connectionId` | `BROTHER`, `SISTER` | ✅ Done: Either user removes an **ACCEPTED** connection. | [04-remove-connection.md](./04-remove-connection.md) |
| 05 | GET | `/connections` | `BROTHER`, `SISTER` | ✅ Done: Fetches my accepted connections. | [05-list-my-connections.md](./05-list-my-connections.md) |
| 06 | GET | `/connections/pending` | `BROTHER`, `SISTER` | ✅ Done: Fetches pending requests (`?type=sent\|received`). | [06-list-pending-requests.md](./06-list-pending-requests.md) |
| 07 | GET | `/connections/status/:userId` | `BROTHER`, `SISTER` | ✅ Done: Checks connection status with a user. | [07-check-connection-status.md](./07-check-connection-status.md) |

---

## Cross-Module Usage

### Enriched User Profile Discovery (`GET /users/profiles`)

The **User module's** community discovery endpoint (`GET /api/v1/users/profiles`) performs a server-side `$lookup` against the `connections` collection for every profile returned in the paginated list. This means the frontend does **not** need to call `GET /connections/status/:userId` for each profile card — the status is already embedded.

Each item in the `data[]` array includes:

| Field | Type | Description |
| :--- | :--- | :--- |
| `connectionStatus` | `string` | One of `NONE`, `PENDING_SENT`, `PENDING_RECEIVED`, `CONNECTED` |
| `connectionId` | `ObjectId \| null` | The `_id` of the `Connection` document, or `null` if status is `NONE` |

**How statuses are derived from this module's model:**

| `connections` document state | `connectionStatus` |
| :--- | :--- |
| Document does not exist | `NONE` |
| Document exists with `status: "PENDING"` | `PENDING` |
| Document exists with `status: "ACCEPTED"` | `ACCEPTED` |

> **Note**: Rejecting or cancelling a request **deletes** the connection document entirely (see `cancelRequest` and `respondToRequest(REJECT)` in the service). This means a rejected/cancelled state always surfaces as `NONE` in subsequent profile list calls.

