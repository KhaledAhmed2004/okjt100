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
| `latitude` | `number` | User's latitude for distance calculation |
| `longitude` | `number` | User's longitude for distance calculation |
| `filter` | `string` | Use `nearby-me` to sort by distance. Otherwise, default sorting is by `createdAt`. |

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `getAllMosques`
- **Service**: `mosque.service.ts` — `getAllMosquesFromDB`

### Business Logic
1. **Always-On Distance**: If `latitude` and `longitude` are provided, the system **always** calculates `distanceInKm` regardless of the filter.
2. **Nearby Me Filter**: If `filter=nearby-me` is used with coordinates, the list is sorted by proximity (closest first).
3. **Default Sorting**: If no filter is provided, the list defaults to sorting by `updatedAt` (newest first).
4. **Clean Projection**: Returns only essential fields for the UI: `mosqueName`, `address`, `area`, `prayerTimes`, `distanceInKm`, and `updatedAt`.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosques fetched successfully.",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "mosqueName": "Baitul Mukarram",
      "address": "Topkhana Road, Dhaka",
      "area": "Motijheel",
      "prayerTimes": {
        "fajr": "04:30",
        "dhuhr": "12:15",
        "asr": "16:45",
        "maghrib": "18:30",
        "isha": "20:00",
        "jummah": "13:30"
      },
      "distanceInKm": 2.5,
      "updatedAt": "2026-05-13T15:32:05.022Z"
    }
  ]
}
```
