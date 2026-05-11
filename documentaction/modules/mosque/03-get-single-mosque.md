# 03. Get Single Mosque

```http
GET /mosques/:mosqueId
Content-Type: application/json
Auth: None
```

> Retrieves full details of a specific mosque by its ID.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque |

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `getSingleMosque`
- **Service**: `mosque.service.ts` — `getSingleMosqueFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque details fetched successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "mosqueName": "Baitul Mukarram",
    "address": "Topkhana Road, Dhaka",
    "area": "Motijheel",
    "phoneNumber": "+880123456789",
    "website": "https://baitulmukarram.org",
    "location": {
      "latitude": 23.7298,
      "longitude": 90.4125
    },
    "prayerTimes": {
      "fajr": "04:30",
      "dhuhr": "12:15",
      "asr": "16:45",
      "maghrib": "18:30",
      "isha": "20:00",
      "jummah": "13:30"
    }
  }
}
```

### Scenario: Not Found (404)

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Mosque not found",
  "errorMessages": []
}
```
