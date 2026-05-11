# 05. Get Group Feed

```http
GET /groups/:groupId/posts?page=1&limit=10
Content-Type: application/json
Auth: User
```

> Fetches the paginated list of posts for a specific group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `getGroupFeed`
- **Service**: `group.service.ts` — `getGroupFeedFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Group feed fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1930",
      "userId": {
        "id": "60d5ecb86372ad46101f1920",
        "fullName": "John Doe",
        "profileImage": "https://storage.com/johndoe.jpg"
      },
      "content": "Assalamu alaikum, looking forward to the next session!",
      "attachments": [],
      "createdAt": "2026-05-09T10:45:00.000Z"
    }
  ]
}
```
