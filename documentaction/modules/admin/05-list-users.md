# 05. List Users (Admin)

```http
GET /admin/users
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> it's give lists all users, with this search, filtered by various criteria, and paginated results.

## Implementation
- **Route**: [admin.route.ts](file:///src/app/modules/admin/admin.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getAllUserRoles`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getAllUserRolesFromDB`

### Business Logic (`getAllUserRolesFromDB`)
1. **Filtering**: Supports `search` (name/email), `email`, `role`, `status`, and `specialty`.
2. **Preference Card Stats**: Joins with `PreferenceCard` collection to calculate:
    - `cardsCount`: Total number of cards created by the user.
    - `specialties`: A unique list of specialties derived from the user's cards.
3. **Subscription Info**: Joins with `Subscription` collection to get:
    - `subscriptionStatus`: Defaults to `inactive` if no subscription found.
    - `subscriptionPlan`: Defaults to `FREE`.
4. **Pagination & Sorting**: Implements custom aggregation pipeline with `$facet` for data and total count.
5. **Projection**: Removes sensitive fields like `password` and `authentication`.

## Data Invariants & Transformation Logic

### 1. ID Handling (`_id` → `id`)
The system maps the database `_id` (ObjectId) to a clean `id` (String) in the final JSON response. This is handled within the `$project` stage of the aggregation pipeline in [user.service.ts](file:///src/app/modules/user/user.service.ts) — specifically within the `getAllUserRolesFromDB` function.

### 2. Conditional Field Visibility (Omit vs. Null)
The API follows a "Clean Response" policy where optional fields are omitted if they contain no data. This behavior is enforced by the `$project` stage in the `getAllUserRolesFromDB` function:
- **`hospital`, `specialty`, `phone`**: These fields are defined as optional in [user.interface.ts](file:///src/app/modules/user/user.interface.ts). If they are missing in the database document, the aggregation pipeline does not create them with null/empty values, thus they are excluded from the JSON output.
- **`profilePicture`**: Has a default value defined in [user.model.ts](file:///src/app/modules/user/user.model.ts), ensuring it is almost always present in the response.

### 3. Verification & Status Logic
- **`verified`**: The default state is `false` as defined in [user.model.ts](file:///src/app/modules/user/user.model.ts). It is flipped to `true` only via the `verifyEmailToDB` function in [auth.service.ts](file:///src/app/modules/auth/auth.service.ts).
- **`status`**: Defaults to `ACTIVE` via [user.model.ts](file:///src/app/modules/user/user.model.ts). Access control for other statuses (`RESTRICTED`, `DELETE`) is enforced globally in the `auth` middleware [auth.ts](file:///src/app/middlewares/auth.ts).

## Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `search` | Name or email regex search | — | `John` |
| `email` | Exact or regex email match | — | `dr.john@example.com` |
| `role` | Filter by role (`SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER`) | — | `BROTHER` |
| `status` | Filter by status (`ACTIVE`, `INACTIVE`, `RESTRICTED`, `DELETE`) | — | `ACTIVE` |
| `specialty` | Filter by specialty (regex match on calculated list) | — | `Surgery` |
| `page` | Pagination page number | `1` | `1` |
| `limit` | Pagination limit | `10` | `10` |
| `sortBy` | Field name for sorting | `createdAt` | `createdAt` |
| `sortOrder` | Sort direction (`asc` or `desc`) | `desc` | `desc` |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User list fetched",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 27,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Dr. John Doe",
      "role": "BROTHER",
      "email": "dr.john@example.com",
      "phone": "+123456789",
      "profilePicture": "https://i.ibb.co/z5YHLV9/profile.png",
      "status": "ACTIVE",
      "verified": true,
      "specialties": ["Cardiology", "Surgery"],
      "cardsCount": 5,
      "subscriptionStatus": "active",
      "subscriptionPlan": "PREMIUM",
      "createdAt": "2026-03-15T10:30:00.000Z",
      "updatedAt": "2026-03-15T10:30:00.000Z"
    }
  ]
}
```
