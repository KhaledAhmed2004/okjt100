# 01. Create Learning Content

```http
POST /learning-contents
Content-Type: application/json
Auth: SUPER_ADMIN
```

> Admin new learning content (video) create korar jonno ei endpoint use korbe.

## Request Body

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | ✅ | Video title |
| `description` | `string` | ✅ | Video description |
| `videoUrl` | `string` | ✅ | URL of the video |
| `category` | `string` | ✅ | Content category (e.g. "Fiqh", "Hadith") |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `createLearningContent`
- **Service**: `learning-content.service.ts` — `createLearningContentIntoDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Learning content created successfully",
  "data": {
    "_id": "60d5ecb86372ad46101f1930",
    "title": "Basic Fiqh",
    "description": "Introduction to Islamic jurisprudence",
    "videoUrl": "https://example.com/video1.mp4",
    "category": "Fiqh",
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "2026-05-12T10:00:00.000Z",
    "updatedAt": "2026-05-12T10:00:00.000Z"
  }
}
```
