# 02. List Groups

```http
GET /groups?page=1&limit=10&searchTerm=Quran
Content-Type: application/json
Auth: User
```

> Fetches a paginated list of groups. Results are automatically filtered based on the logged-in user's role (BROTHER users see Male groups, SISTER users see Female groups).

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 10) |
| `searchTerm`| `string` | Search by group name |
| `categoryId`| `string` | Filter by category |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `getAllGroups`
- **Service**: `group.service.ts` — `getAllGroupsFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Groups fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "name": "Quran Study Circle",
      "description": "A group for brothers to study Quran",
      "memberCount": 25,
      "userType": "Male"
    }
  ]
}
```
