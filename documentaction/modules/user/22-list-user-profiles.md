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
3.  **Injected Distance**: If `latitude` and `longitude` are provided, the system calculates and injects `distanceInKm` directly at the database level.
4.  **Field Projection (Privacy)**: Returns specific public fields: `_id`, `name`, `profileImage`, `age`, `revertDate`, `location` (flattened).

## Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `searchTerm` | Search by name, specialty, or hospital | — | `John` |
| `latitude` | Requester's current latitude | — | `23.8103` |
| `longitude` | Requester's current longitude | — | `90.4125` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |
| `sortBy` | Sort field (e.g., `revertDate` for new reverts) | `createdAt` | `revertDate` |
| `sortOrder` | Sort direction (`asc` or `desc`) | `desc` | `desc` |

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
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Dr. Sarah Smith",
      "age": 28,
      "revertDate": "2020-05-15T00:00:00.000Z",
      "country": "USA",
      "city": "New York",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "distanceInKm": 12.45,
      "profileImage": "uploads/users/profiles/sarah.png"
    }
  ]
}
```
