# 02. List Learning Contents

```http
GET /learning-contents
Auth: SUPER_ADMIN, BROTHER, SISTER
```

> Shob learning content browse korar jonno. Search ebong filter support kore.

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `searchTerm` | `string` | Title ba category diye search |
| `category` | `string` | Specific category filter |
| `page` | `number` | Page number |
| `limit` | `number` | Items per page |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `getAllLearningContents`
- **Service**: `learning-content.service.ts` — `getAllLearningContentsFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Learning contents fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "60d5ecb86372ad46101f1930",
      "title": "Basic Fiqh",
      "description": "Introduction to Islamic jurisprudence",
      "videoUrl": "https://example.com/video1.mp4",
      "category": "Fiqh",
      "likesCount": 10,
      "commentsCount": 5,
      "isLiked": true,
      "createdAt": "2026-05-12T10:00:00.000Z"
    }
  ]
}
```

> `isLiked` flag current logged-in user er status dekhay.
