# 22. List User Profiles (Community Discovery)

```http
GET /api/v1/users/profiles?latitude=23.8103&longitude=90.4125
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Lists public profiles of users within the same community. Brothers see other Brothers, and Sisters see other Sisters. Only active users are listed. Includes distance calculation if coordinates are provided.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserProfiles`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserProfilesFromDB`

### Business Logic (`getUserProfilesFromDB`)
1.  **Server-Side Scoping**: Automatically filters users by the requesting user's `role` (BROTHER/SISTER) and ensures only `ACTIVE` profiles are visible.
2.  **High-Performance Proximity**: Uses MongoDB's native `$geoNear` aggregation for industry-standard proximity sorting.
3.  **Injected Distance**: If `latitude` and `longitude` are provided, the system **always** calculates and injects `distanceInKm` directly at the database level, regardless of the `filter` used.
4.  **Flexible Sorting**: 
    - If `filter=nearby-me` (and coordinates provided), users are sorted by distance (closest first).
    - Otherwise (default or `filter=new-reverts`), users are sorted by `createdAt` (newest first), even if distance was calculated.
5.  **Field Projection (Privacy)**: Returns specific public fields: `_id`, `name`, `profileImage`, `age`, `revertDate`, `distanceInKm`. (Note: Internal coordinates and country/city are removed for UI simplicity).

## Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `searchTerm` | Search by name | — | `John` |
| `latitude` | Requester's current latitude (required for `nearby-me` filter) | — | `23.8103` |
| `longitude` | Requester's current longitude (required for `nearby-me` filter) | — | `90.4125` |
| `filter` | Use `new-reverts` for newest members or `nearby-me` for location-based sorting | `new-reverts` | `nearby-me` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profiles fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Dr. Sarah Smith",
      "age": 28,
      "revertDate": "2020-05-15T00:00:00.000Z",
      "distanceInKm": 12.45,
      "profileImage": "/uploads/users/profiles/sarah.png"
    }
  ]
}
```
