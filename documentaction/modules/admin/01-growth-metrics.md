# 01. Growth Metrics (Stats)

```http
GET /admin/growth-metrics
Example: {{baseUrl}}/admin/growth-metrics
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

> This endpoint is used for dashboard summary cards. It calculates monthly growth: current month vs last month.

## Query Parameters

| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| — | None | — | — |


## Implementation

- **Route**: `src/app/modules/admin/admin.route.ts`
- **Controller**: `src/app/modules/admin/admin.controller.ts` — `getDashboardStats`
- **Service**: `src/app/modules/admin/admin.service.ts` — `getAdminDashboardStats`

### Business Logic
1. **Aggregation Engine**: Uses `AggregationBuilder` to run complex MongoDB aggregation pipelines across multiple collections (`User`, `PreferenceCardModel`, `Subscription`).
2. **Growth Calculation**:
   - Calculates metrics for the **current month** (e.g., May) and the **previous month** (e.g., April).
   - `doctors`: Total users in the system.
   - `preferenceCards`: Total cards created.
   - `verifiedPreferenceCards`: Cards where `published: true`.
   - `activeSubscriptions`: Subscriptions where `status: 'ACTIVE'`.
3. **Growth Logic**:
   - `changePct`: The percentage difference between current and last month.
   - `direction`: Maps the growth type to UI-friendly strings: `increase` → `"up"`, `decrease` → `"down"`, others → `"neutral"`.
4. **Data Formatting**: Normalizes raw aggregation results into a consistent object structure for the frontend.

## Field Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `meta.comparisonPeriod` | `string` | Always `"month"` — current vs last calendar month |
| `{metric}.value` | `number` | Total count as of now |
| `{metric}.changePct` | `number` | Always a **positive** magnitude (e.g. `25`, `7.14`). Use `direction` for sign. |
| `{metric}.direction` | `"up" \| "down" \| "neutral"` | `"up"` = growth, `"down"` = decline, `"neutral"` = no change or first month with no prior data |

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Admin dashboard metrics",
  "data": {
    "meta": {
      "comparisonPeriod": "month"
    },
    "doctors": {
      "value": 250,
      "changePct": 25,
      "direction": "up"
    },
    "preferenceCards": {
      "value": 4500,
      "changePct": 7.14,
      "direction": "up"
    },
    "verifiedPreferenceCards": {
      "value": 4200,
      "changePct": 4,
      "direction": "up"
    },
    "activeSubscriptions": {
      "value": 120,
      "changePct": 37.5,
      "direction": "down"
    }
  }
}
```

> **Note:** `activeSubscriptions.direction: "down"` with `changePct: 37.5` means active subscriptions **decreased by 37.5%** compared to last month. `changePct` is always a positive number; `direction` tells you whether it went up or down.
