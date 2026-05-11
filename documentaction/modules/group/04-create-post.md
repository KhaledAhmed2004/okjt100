# 04. Create Post

```http
POST /groups/:groupId/posts
Content-Type: application/json
Auth: User
```

> Members can create posts with text and optional attachments within a group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group |

## Request Body

| Field | Type | Description |
| :--- | :--- | :--- |
| `content` | `string` | Text content of the post |
| `attachments` | `array` | (Optional) List of image/file URLs |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `createPost`
- **Service**: `group.service.ts` — `createPostInDB`

### Business Logic
1. **Membership Check**: Verifies that the user is a member of the group before allowing them to post.

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Post created successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1930",
    "groupId": "60d5ecb86372ad46101f1929",
    "userId": "60d5ecb86372ad46101f1920",
    "content": "Assalamu alaikum, looking forward to the next session!",
    "attachments": [],
    "createdAt": "2026-05-09T10:45:00.000Z"
  }
}
```
