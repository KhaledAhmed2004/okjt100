# 01. Send Message

```http
POST /messages
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Sends a message to a specific chat. Supports text and multiple file attachments (images, audio, video, documents).

---

## 2. Business Rules
- **Authorization**: The sender must be a participant of the `chatId` provided.
- **Attachments**: Files are uploaded and converted into a unified `attachments` array.
- **Real-time**: 
  - Emits `MESSAGE_SENT` to the chat room (`chat::{chatId}`).
  - Emits `MESSAGE_SENT` to each participant's user room (`user::{userId}`).
- **Notifications**: Sends a notification to offline participants.

---

## 3. Request Body (Form-Data)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | `string` | Yes | Target Chat ID |
| `text` | `string` | No | Message text |
| `image` | `file[]` | No | Image files |
| `media` | `file[]` | No | Audio/Video files |
| `doc` | `file[]` | No | Document files |

---

## 4. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Message sent successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d99",
    "chatId": "...",
    "sender": "...",
    "text": "Hello!",
    "type": "text",
    "attachments": [],
    "createdAt": "..."
  }
}
```
