# 08. Delete User (Admin)

```http
DELETE /admin/users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Permanently removes a user from the database.

## Implementation
- **Route**: [admin.route.ts](file:///src/app/modules/admin/admin.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `deleteUser`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `deleteUserPermanentlyFromDB`

### Business Logic (`deleteUserPermanentlyFromDB`)
1. **Validation**: Checks if the user exists.
2. **Permanent Removal**: Uses `findByIdAndDelete` to remove the user record entirely.
3. **Response Sanitization**: Returns the deleted document (excluding `password` and `authentication` fields).

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User deleted",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "BROTHER"
  }
}
```
