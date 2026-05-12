# 04. Update Learning Content

```http
PATCH /learning-contents/:contentId
Content-Type: application/json
Auth: SUPER_ADMIN
```

> Admin existing content update korar jonno use korbe.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Request Body

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | ❌ | Updated title |
| `description` | `string` | ❌ | Updated description |
| `videoUrl` | `string` | ❌ | Updated video URL |
| `category` | `string` | ❌ | Updated category |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `updateLearningContent`
- **Service**: `learning-content.service.ts` — `updateLearningContentInDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Learning content updated successfully",
  "data": {
    "_id": "60d5ecb86372ad46101f1930",
    "title": "Advanced Fiqh",
    "description": "Deeper dive into Islamic jurisprudence",
    "videoUrl": "https://example.com/video2.mp4",
    "category": "Fiqh",
    "likesCount": 10,
    "commentsCount": 5,
    "updatedAt": "2026-05-12T11:00:00.000Z"
  }
}
```
