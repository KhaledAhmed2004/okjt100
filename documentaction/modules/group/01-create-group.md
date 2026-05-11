# 01. Create Group

```http
POST /groups
Content-Type: application/json
Auth: Admin
```

> Admins can create new user groups with gender restrictions and categories.

## Request Body

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Name of the group |
| `description` | `string` | Detailed description |
| `userType` | `string` | `Male` or `Female` |
| `categoryId` | `string` | ID of the assigned category |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `createGroup`
- **Service**: `group.service.ts` — `createGroupIntoDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Group created successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "name": "Quran Study Circle",
    "description": "A group for brothers to study Quran",
    "userType": "Male",
    "categoryId": "60d5ecb86372ad46101f1920",
    "memberCount": 0,
    "createdAt": "2026-05-09T10:00:00.000Z"
  }
}
```
