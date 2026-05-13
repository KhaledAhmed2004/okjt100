# 04. Create Post

```http
POST /groups/:groupId/posts
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Members can create posts with text and optional attachments within a group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group |

## Request Body

```json
{
  "content": "Assalamu alaikum, looking forward to the next session!", // Text content of the post
  "attachments": [] // (Optional) List of image/file URLs
}
```

## Request Body Details

| Field | Type | Description |
| :--- | :--- | :--- |
| `content` | `string` | Text content of the post |
| `attachments` | `array` | (Optional) List of image/file URLs (Max 5) |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `createPost`
- **Service**: `group.service.ts` — `createPostInDB`

### Business Logic
1. **Membership Check**: Verifies that the user is a member of the group before allowing them to post.
2. **`SUPER_ADMIN` Bypass**: The `SUPER_ADMIN` has implicit membership and can post in any group without joining.
3. **Attachment Limit**: Maximum of 5 attachments are allowed per post.

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
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "2026-05-09T10:45:00.000Z"
  }
}
```

### Scenario: Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only members can post"
}
```
