# 04. Update Mosque

```http
PATCH /mosques/:mosqueId
Content-Type: application/json
Auth: Admin
```

> Updates specific fields of an existing mosque entry.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque |

## Request Body

| Field | Type | Description |
| :--- | :--- | :--- |
| `mosqueName` | `string` | (Optional) Updated name |
| `prayerTimes` | `object` | (Optional) Updated prayer times |
| `...` | `any` | Any other fields from the model |

### Example Body
```json
{
  "prayerTimes": {
    "fajr": "04:45"
  }
}
```

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `updateMosque`
- **Service**: `mosque.service.ts` — `updateMosqueIntoDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque updated successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "mosqueName": "Baitul Mukarram",
    "prayerTimes": {
      "fajr": "04:45",
      "dhuhr": "12:15",
      "asr": "16:45",
      "maghrib": "18:30",
      "isha": "20:00"
    }
  }
}
```
