# 02. Monthly Preference Cards Trend

```http
GET /admin/preference-cards/trends/monthly
Example: {{baseUrl}}/admin/preference-cards/trends/monthly?year=2026&compareYear=2025&timezone=UTC
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Returns monthly analytics for preference cards — includes an inline YoY comparison (current year vs. last year), with `peak` and `slowest` months pre-computed server-side.

## Query Parameters

| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `year` | Filter data by a specific year | `currentYear` | `2026` |
| `from` | Start date for custom range (YYYY-MM-DD) | `year-01-01` | `2026-01-01` |
| `to` | End date for custom range (YYYY-MM-DD) | `year-12-31` | `2026-12-31` |


## Implementation

- **Route**: `src/app/modules/admin/admin.route.ts`
- **Controller**: `src/app/modules/admin/admin.controller.ts` — `getPreferenceCardMonthly`
- **Service**: `src/app/modules/admin/admin.service.ts` — `getPreferenceCardMonthlyTrend`

## Field Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `meta.year` | `number` | Primary year |
| `meta.granularity` | `string` | Always `"monthly"` |
| `meta.compareYear` | `number` | Comparison year for YoY |
| `meta.timezone` | `string` | Always `"UTC"` |
| `summary.totalCount` | `number` | Sum of all months' `count` for `meta.year` |
| `summary.periodAvg` | `number` | `Math.round(totalCount / 12)` — average count per month |
| `summary.yoyGrowthPct` | `number` | Year-level total YoY % vs `compareYear` (rounded to 1 decimal). `0` if last year had no data. |
| `summary.peak` | `object \| null` | `{ month, label, count }` for the month with highest `count`, or `null` if no months have data |
| `summary.slowest` | `object \| null` | `{ month, label, count }` for the month with lowest non-zero `count`, or `null` if no data |
| `series[].month` | `string` | Year-month key (e.g. `"2026-01"`) |
| `series[].label` | `string` | Server-formatted month label (e.g. `"January 2026"`) |
| `series[].count` | `number` | Count for that month |
| `series[].lastYearCount` | `number` | Same month's count in `compareYear` (`0` if no data) |
| `series[].yoyGrowthPct` | `number` | Per-month YoY % vs same month last year. |
| `series[].isPeak` | `boolean` | `true` for the month matching `summary.peak` (only set when count > 0) |
| `series[].isSlowest` | `boolean` | `true` for the month matching `summary.slowest` (only set when count > 0) |

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Preference card monthly trend",
  "data": {
    "meta": {
      "year": 2026,
      "granularity": "monthly",
      "compareYear": 2025,
      "timezone": "UTC"
    },
    "summary": {
      "totalCount": 2847,
      "periodAvg": 237,
      "yoyGrowthPct": 20.0,
      "peak": {
        "month": "2026-08",
        "label": "August 2026",
        "count": 382
      },
      "slowest": {
        "month": "2026-01",
        "label": "January 2026",
        "count": 200
      }
    },
    "series": [
      {
        "month": "2026-01",
        "label": "January 2026",
        "count": 200,
        "lastYearCount": 172,
        "yoyGrowthPct": 16.3,
        "isPeak": false,
        "isSlowest": true
      }
      // ... 11 more months follow the same shape
    ]
  }
}
```

### Error Scenarios
- **401 Unauthorized**: Missing or invalid token.
- **403 Forbidden**: Token valid, but user is not `SUPER_ADMIN`.
- **500 Server Error**: Internal system failure.
