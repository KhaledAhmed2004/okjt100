# 05. Get Analytics (Admin)

```http
GET /ask-imam/analytics
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to retrieve module-wide analytics for the "Ask Imam" system. This provides a high-level summary of question volume and completion status.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can access analytics.
- **Status check**: The [auth middleware](../../../src/app/middlewares/auth.ts) automatically blocks access if the admin account status is not `ACTIVE`.

### 2.2 Data Calculation Logic
The service layer performs three separate count operations to generate the analytics:
- **`total`**: `AskImam.countDocuments({})` — total number of questions ever submitted.
- **`pending`**: `AskImam.countDocuments({ status: 'pending' })` — questions awaiting an answer.
- **`answered`**: `AskImam.countDocuments({ status: 'answered' })` — questions that have been responded to.

---

## 3. Behavioral Notes

- **Real-Time Accuracy**: Analytics are calculated in real-time by querying the database; there is currently no caching or pre-aggregation used.
- **Inclusion Policy**: The `total` count includes all documents regardless of their status (e.g., if a `rejected` status is implemented later, it would be included in `total`).
- **Data Scope**: Analytics cover all users and all questions across the entire platform.
- **Enum Definitions**: Allowed statuses are `pending` and `answered`.

---

## 4. Implementation
- **Route**: [src/app/modules/ask-imam/ask-imam.route.ts](../../../src/app/modules/ask-imam/ask-imam.route.ts) — `router.get('/analytics', ...)`
- **Controller**: [src/app/modules/ask-imam/ask-imam.controller.ts](../../../src/app/modules/ask-imam/ask-imam.controller.ts) — `getAnalytics`
- **Service**: [src/app/modules/ask-imam/ask-imam.service.ts](../../../src/app/modules/ask-imam/ask-imam.service.ts) — `getAnalyticsFromDB`

**Middleware order**: `auth(SUPER_ADMIN)` -> `AskImamController.getAnalytics`.

---

## 5. Security
- **Role Enforcement**: Ensures that sensitive module-wide performance data is only visible to the `SUPER_ADMIN`. Other administrative roles are restricted.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Analytics fetched successfully",
  "data": {
    "total": 50,
    "pending": 10,
    "answered": 40
  }
}
```

### Error: Unauthorized (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized access"
}
```

---

## 7. Related Flows
- **View All Questions** -> [02-get-all-questions.md](./02-get-all-questions.md).
