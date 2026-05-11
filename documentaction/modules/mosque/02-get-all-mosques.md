# 02. Get All Mosques

```http
GET /mosques?page=1&limit=10&searchTerm=Baitul&area=Motijheel
Content-Type: application/json
Auth: None
```

> Fetches a paginated list of mosques with optional search and filtering.

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 10) |
| `searchTerm`| `string` | Search by name, area, or address |
| `area` | `string` | Filter by specific area |
| `sortBy` | `string` | Sort field (default: `mosqueName`) |
| `sortOrder` | `string` | `asc` or `desc` (default: `asc`) |

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `getAllMosques`
- **Service**: `mosque.service.ts` — `getAllMosquesFromDB`

### Business Logic
1. **Query Building**: Applies filters and search terms to the database query.
2. **Pagination**: Calculates skip and limit for results.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosques fetched successfully.",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "mosqueName": "Baitul Mukarram",
      "area": "Motijheel",
      "prayerTimes": {
        "fajr": "04:30",
        "dhuhr": "12:15",
        "asr": "16:45",
        "maghrib": "18:30",
        "isha": "20:00"
      }
    }
  ]
}
```
