# 06. Get User by ID (Admin)

```http
GET /admin/users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Admin specific view of a user's basic info. Returns user data wrapped in a `user` object.

## Implementation
- **Route**: [admin.route.ts](file:///src/app/modules/admin/admin.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserById`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserByIdFromDB`

### Business Logic (`getUserByIdFromDB`)
1. **Retrieval**: Fetches the user by ID using `findById`.
2. **Sanitization**: Selects all fields except `password` and `authentication`.
3. **Response Wrapping**: Returns the data wrapped in a `user` property within the `data` object.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User data retrieved",
  "data": {
    "user": {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+123456789",
      "role": "BROTHER",
      "status": "ACTIVE",
      "verified": true,
      "country": "USA",
      "specialty": "Cardiology",
      "hospital": "City Hospital",
      "profilePicture": "https://i.ibb.co/z5YHLV9/profile.png",
      "createdAt": "2026-03-15T10:30:00.000Z",
      "updatedAt": "2026-03-15T10:30:00.000Z"
    }
  }
}
```
