# 05. List My Connections

```http
GET /connections
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Fetches a paginated list of all established (ACCEPTED) connections for the logged-in user.

---

## 2. Business Rules
- **Data Formatting**: The response includes a `user` object representing the *other* person in the connection (not the logged-in user).
- **Population**: Automatically populates the other user's `name`, `profileImage`, and `role`.

---

## 3. Query Parameters

| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |
| `sort` | Sort field (prefix with `-` for descending) | `-createdAt` | `-createdAt` |
| `fields` | Comma-separated fields to select | — | `status,createdAt` |

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connections retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d1a",
      "status": "ACCEPTED",
      "chatId": "664a1b2c3d4e5f6a7b8c9d1z",
      "respondedAt": "2026-05-14T10:05:00.000Z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "user": {
        "_id": "664a1b2c3d4e5f6a7b8c9d1c",
        "name": "Jane Doe",
        "profileImage": "http://...",
        "role": "SISTER"
      }
    }
  ]
}
```
