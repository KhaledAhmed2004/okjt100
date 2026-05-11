# API Conventions (Shared)

> Single source of truth for cross-cutting API conventions used across **App Screens** and **Dashboard Screens** docs.
> Screen docs link here instead of repeating the same blocks.
> Anything **specific** to a feature (TTLs, rate limits, custom headers) stays in that feature's screen doc.

---

## Base URL & Versioning

| Item | Value |
|---|---|
| Base URL | `{{baseUrl}}/api/v1` |
| Version strategy | Path-based (`/api/v1`, `/api/v2`) — never query string |
| Content-Type | `application/json` (unless multipart upload) |
| Charset | UTF-8 |
| Date/time format | ISO 8601 UTC (`2026-05-03T10:35:00.000Z`) |

---

## Standard Headers

| Header | When | Value |
|---|---|---|
| `Authorization` | Authenticated routes | `Bearer {{accessToken}}` |
| `X-Device-Id` | Login, refresh-token, logout, push-related routes | Stable per-install UUID |
| `Accept-Language` | All routes (recommended) | Device locale (e.g. `en`, `bn`, `ar`) |
| `Idempotency-Key` | POST routes that create payments / bookings | Client-generated UUID |

---

## Response Envelope

All endpoints return responses through `sendResponse()`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable message",
  "data": { },
  "meta": { }
}
```

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | `true` for 2xx, `false` for 4xx/5xx |
| `statusCode` | number | Mirrors HTTP status code |
| `message` | string | Localized when `Accept-Language` is sent |
| `data` | object \| array \| null | Payload — null on actions that have no body |
| `meta` | object | Present on paginated responses (see below) |

---

## Error Shape

Error responses use the same envelope plus an optional `errorSources` array:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errorSources": [
    { "path": "email", "message": "Invalid email" },
    { "path": "password", "message": "Must be at least 8 characters" }
  ]
}
```

| Field | When |
|---|---|
| `errorSources` | Validation errors (Zod) — one entry per failed field |
| `stack` | Only in non-production environments |

---

## Status Codes

| Code | Meaning | Used for |
|---|---|---|
| `200` | OK | Successful read / action |
| `201` | Created | Resource created |
| `204` | No Content | Action with no response body |
| `400` | Bad Request | Validation failure |
| `401` | Unauthorized | Missing / invalid / expired token |
| `403` | Forbidden | Authenticated but not allowed |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate / state conflict |
| `410` | Gone | Resource expired (e.g. expired OTP / reset token) |
| `422` | Unprocessable | Semantically invalid (use sparingly — prefer 400) |
| `423` | Locked | Resource temporarily locked (e.g. OTP locked) |
| `429` | Too Many Requests | Rate limited |
| `500` | Server Error | Unexpected failure |

---

## Pagination, Sorting, Filtering, Search

All list endpoints powered by `QueryBuilder` accept the following query parameters:

| Param | Type | Default | Example | Notes |
|---|---|---|---|---|
| `page` | number | `1` | `?page=2` | 1-indexed |
| `limit` | number | `10` | `?limit=20` | Max `100` |
| `sort` | string | `-createdAt` | `?sort=-updatedAt,name` | Comma-separated; prefix `-` for descending |
| `fields` | string | all | `?fields=name,email` | Whitelisted projection |
| `searchTerm` | string | — | `?searchTerm=sara` | Matches indexed text fields per module |
| `<field>` | any | — | `?role=USER&status=ACTIVE` | Direct equality filter |

**Paginated response shape**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": [ /* items */ ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 137,
    "totalPages": 14
  }
}
```

> Operators like `gte` / `lte` / `in` are passed as `?price[gte]=100&price[lte]=500&tags[in]=a,b`.

---

## File Uploads

Routes that accept files use `multipart/form-data` and the `fileHandler` middleware.

| Item | Value |
|---|---|
| Field name | Documented per route (`avatar`, `attachments[]`, etc.) |
| Default max file size | `5 MB` per file (override per route) |
| Allowed mime types | Whitelisted per route |
| Response | URL(s) returned in `data` |

---

## Authentication & Tokens

| Token | Lifetime | Where stored (client) | Notes |
|---|---|---|---|
| Access token | Short-lived (per feature — see screen doc) | Memory / secure storage | JWT, sent as `Bearer` |
| Refresh token | Long-lived (per feature — see screen doc) | Secure storage | Rotated on every refresh |
| Reset / one-time token | Very short | Memory only | Single-use |

**Refresh policy** — refresh tokens are **rotated**: the old token is invalidated on every successful refresh. Reuse of an old refresh token revokes the entire session family.

---

## Rate Limiting

When a request is rate-limited the server responds with `429` and these headers:

| Header | Meaning |
|---|---|
| `Retry-After` | Seconds until the next attempt is allowed |
| `X-RateLimit-Limit` | Window allowance |
| `X-RateLimit-Remaining` | Remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

---

## Localization

- Send `Accept-Language` on every request (`en`, `bn`, `ar`, …).
- `message` and `errorSources[].message` are localized.
- Server-stored values (names, titles) are returned as-is — translation is the client's responsibility unless the schema documents a localized field map.

---

## Idempotency

POST routes that create financial or booking-like resources accept an `Idempotency-Key` header. Repeating the same key within 24 hours returns the original response without re-executing side effects.

---

## Webhook & Event Conventions

> Documented per integration in the relevant feature doc. Common envelope:

```json
{
  "event": "payment.succeeded",
  "id": "evt_...",
  "createdAt": "2026-05-03T10:35:00.000Z",
  "data": { }
}
```

---

## Postman

- Collection: `public/postman-collection.json`
- Use `{{baseUrl}}` and `{{accessToken}}` variables — never hardcode.
- Update on **every** route change.
