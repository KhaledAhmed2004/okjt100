# 06. List Pending Requests

```http
GET /connections/pending
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Fetches a paginated list of pending connection requests, either sent by the user or received by them.

---

## 2. Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `type` | Whether to fetch requests you `sent` or `received` | `received` | `sent` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |
| `sort` | Sort field (prefix with `-` for descending) | `-createdAt` | `-createdAt` |
| `fields` | Comma-separated fields to select | — | `status,createdAt` |

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending requests retrieved successfully",
  "meta": { ... },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d1a",
      "sender": {
        "_id": "664a1b2c3d4e5f6a7b8c9d1b",
        "name": "John Smith",
        "profileImage": "http://..."
      },
      "receiver": "664a1b2c3d4e5f6a7b8c9d1c",
      "status": "PENDING",
      "createdAt": "2026-05-14T11:00:00.000Z"
    }
  ]
}
```
