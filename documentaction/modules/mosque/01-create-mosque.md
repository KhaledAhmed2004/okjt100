# 01. Create Mosque

```http
POST /mosques
Content-Type: application/json
Auth: Admin
```

> Adds a new mosque to the database with location and prayer times.

## Request Body

| Field | Type | Description |
| :--- | :--- | :--- |
| `mosqueName` | `string` | Name of the mosque |
| `address` | `string` | Full address |
| `area` | `string` | Area/Neighborhood |
| `phoneNumber` | `string` | Contact number |
| `website` | `string` | (Optional) Valid URL |
| `location` | `object` | Latitude and Longitude |
| `prayerTimes` | `object` | 5 daily prayer times (HH:MM) and optional Jummah |

### Example Body
```json
{
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
```

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `createMosque`
- **Service**: `mosque.service.ts` — `createMosqueIntoDB`

### Business Logic
1. **Validation**: Validates input using Zod (required fields, phone format, URL format, time format).
2. **Database Insertion**: Saves the mosque record.

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Mosque created successfully.",
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
    },
    "createdAt": "2026-05-09T10:00:00.000Z",
    "updatedAt": "2026-05-09T10:00:00.000Z"
  }
}
```

### Scenario: Validation Error (400)

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    {
      "path": "mosqueName",
      "message": "Mosque name is required"
    }
  ]
}
```
