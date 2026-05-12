# 05. Delete Mosque

```http
DELETE /mosques/:mosqueId
Content-Type: application/json
Auth: Admin
```

> Permanently removes a mosque entry from the database.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque |

## Implementation

- **Route**: `mosque.route.ts`
- **Controller**: `mosque.controller.ts` — `deleteMosque`
- **Service**: `mosque.service.ts` — `deleteMosqueFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque deleted successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929"
  }
}
```
