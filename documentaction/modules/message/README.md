# Message Module APIs

> **Section**: Backend API specifications for the Message module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## Database Design

### Message Model (`messages`)
Stores individual messages within a chat.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | ObjectId | ✅ | Reference to the Chat (ref `Chat`) |
| `sender` | ObjectId | ✅ | Reference to the sender (ref `User`) |
| `text` | String | ❌ | Message text content |
| `type` | String | ✅ | `text`, `image`, `media`, `doc`, `mixed` |
| `attachments` | Array | ❌ | Unified attachment objects |
| `readBy` | Array<ObjectId>| ❌ | Users who have read the message |

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/messages` | `BROTHER`, `SISTER` | ✅ Done: Sends a message with optional attachments. | [01-send-message.md](./01-send-message.md) |
| 02 | GET | `/messages/chat/:chatId` | `BROTHER`, `SISTER` | ✅ Done: Fetches all messages in a chat. | [02-get-chat-messages.md](./02-get-chat-messages.md) |
| 03 | POST | `/messages/chat/:chatId/read` | `BROTHER`, `SISTER` | ✅ Done: Marks all messages in a chat as read. | [03-mark-chat-as-read.md](./03-mark-chat-as-read.md) |
