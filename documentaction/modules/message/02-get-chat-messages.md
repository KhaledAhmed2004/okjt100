# 02. Get Chat Messages

```http
GET /messages/chat/:chatId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Fetches a paginated list of messages for a specific chat conversation.

---

## 2. Business Rules
- **Sorting**: Messages are returned in ascending order of `createdAt` (oldest to newest) for a natural chat flow.
- **Participant Data**: Includes details of the *other* participant in the chat for UI display.

---

## 3. Query Parameters
Supports standard [QueryBuilder](../../../src/app/builder/QueryBuilder.ts) parameters:
- `page`, `limit`, `searchTerm` (searches within message text).

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Messages fetched successfully",
  "meta": { ... },
  "data": {
    "messages": [ ... ],
    "participant": {
      "_id": "...",
      "name": "Jane Doe",
      "profile": "..."
    }
  }
}
```
