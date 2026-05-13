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
| `sortBy` | `string` | Sort field (default: `createdAt`) |
| `sortOrder` | `string` | `asc` or `desc` (default: `desc`) |
| `latitude` | `number` | User's latitude for distance calculation |
| `longitude` | `number` | User's longitude for distance calculation |

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `getAllMosques`
- **Service**: `mosque.service.ts` — `getAllMosquesFromDB`

### Business Logic
1. **Dual-Purpose Logic**: Supports both Admin (dashboard sorting) and Public User (proximity search) in a single endpoint.
2. **Proximity Search**: If `latitude` and `longitude` are provided, uses MongoDB's native `$geoNear` for distance-based sorting and injects `distanceInKm`.
3. **Admin Sorting**: If coordinates are NOT provided, falls back to traditional sorting using `sortBy` and `sortOrder`.
4. **Pagination**: Efficiently calculates metadata via `$facet`.
5. **Flattened Response**: Automatically transforms nested GeoJSON into top-level `latitude`/`longitude` for frontend convenience.

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
      "_id": "60d5ecb86372ad46101f1929",
      "mosqueName": "Baitul Mukarram",
      "address": "Baitul Mukarram, Dhaka",
      "area": "Motijheel",
      "latitude": 23.7289,
      "longitude": 90.4125,
      "distanceInKm": 2.5,
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
