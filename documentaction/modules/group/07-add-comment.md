# 07. Add Comment

```http
POST /groups/posts/:postId/comments
Content-Type: application/json
Auth: User
```

> Members can add comments to a post.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post |

## Request Body

| Field | Type | Description |
| :--- | :--- | :--- |
| `comment` | `string` | Content of the comment |
| `parentCommentId` | `string` | (Optional) ID of the comment being replied to |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `addComment`
- **Service**: `group.service.ts` — `addCommentInDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Comment added successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1940",
    "postId": "60d5ecb86372ad46101f1930",
    "userId": "60d5ecb86372ad46101f1920",
    "comment": "Walaikum assalam!",
    "createdAt": "2026-05-09T11:00:00.000Z"
  }
}
```
