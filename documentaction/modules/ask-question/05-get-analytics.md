# 05. Get Analytics (Admin)

```http
GET /ask-question/analytics
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to retrieve module-wide analytics for the "Ask Question" system.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can access analytics.

### 2.2 Data Calculation Logic
- **`total`**: Total number of questions.
- **`pending`**: Questions awaiting an answer.
- **`answered`**: Questions that have been responded to.

---

## 3. Implementation
- **Route**: [src/app/modules/ask-question/ask-question.route.ts](../../../src/app/modules/ask-question/ask-question.route.ts) — `router.get('/analytics', ...)`
- **Controller**: [src/app/modules/ask-question/ask-question.controller.ts](../../../src/app/modules/ask-question/ask-question.controller.ts) — `getAnalytics`
- **Service**: [src/app/modules/ask-question/ask-question.service.ts](../../../src/app/modules/ask-question/ask-question.service.ts) — `getAnalyticsFromDB`

---

## 4. Responses

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
