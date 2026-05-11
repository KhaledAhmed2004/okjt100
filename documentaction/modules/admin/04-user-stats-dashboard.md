# 04. User Stats (Dashboard)

```http
GET /admin/users/stats
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Aggregated growth metrics for the admin dashboard.

## Implementation
- **Route**: [admin.route.ts](file:///src/app/modules/admin/admin.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUsersStats`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUsersStatsFromDB`

### Business Logic (`getUsersStatsFromDB`)
1. **Metric Calculation**: Calculates current month's totals for:
    - `totalUsers`: All users in the database.
    - `activeUsers`: Users with status `ACTIVE`.
    - `inactiveUsers`: Users with status `INACTIVE`.
    - `blockedUsers`: Users with status `RESTRICTED`.
2. **Growth Analysis**: Uses [AggregationBuilder.calculateGrowth()](file:///src/app/modules/builder/AggregationBuilder.ts) to compare current month data with the previous month.
3. **Trend Detection**: Determines `direction` (`up`, `down`, or `neutral`) based on the calculated percentage change.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User statistics retrieved",
  "data": {
    "meta": { "comparisonPeriod": "month" },
    "totalUsers": { "value": 250, "changePct": 25, "direction": "up" },
    "activeUsers": { "value": 198, "changePct": 10, "direction": "up" },
    "inactiveUsers": { "value": 32, "changePct": 5, "direction": "down" },
    "blockedUsers": { "value": 20, "changePct": 0, "direction": "neutral" }
  }
}
```
