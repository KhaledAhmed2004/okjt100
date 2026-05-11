# 02. Get All Questions (Admin)

```http
GET /ask-imam
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to retrieve a paginated list of all questions submitted by users. This endpoint is designed for administrative oversight and answering questions. It supports deep searching, filtering, and sorting via `QueryBuilder`.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can access this endpoint.
- **Status check**: The [auth middleware](../../../src/app/middlewares/auth.ts) automatically blocks access if the admin account status is not `ACTIVE`.

### 2.2 Query Logic (QueryBuilder)
This endpoint implements `QueryBuilder` for flexible data retrieval:

- **Text Search**: Uses `.textSearch()` which leverages the MongoDB text index on the `question` field. This provides relevance scoring (`textScore`) and is more efficient than regex scans.
- **Filtering**: Allows filtering by any schema field (e.g., `status=pending`) using `.filter()`.
- **Sorting**: Supports multi-field sorting using `.sort()`. If a search term is present and no explicit sort is provided, it defaults to `textScore` relevance. Otherwise, it defaults to `-createdAt`.
- **Pagination**: Standard pagination via `.paginate()` using `page` and `limit`.
- **Field Selection**: Specific field projection via `.fields()`.

### 2.3 Data Population
- The `userId` field is automatically populated with the user's `name` and `email` for administrative context.

---

## 3. Behavioral Notes

- **Relevance Sorting**: When a `searchTerm` is provided, questions are sorted by search relevance (`textScore`) by default, overriding the chronological order unless an explicit `sort` is requested.
- **Data Privacy**: Only public profile information (`name`, `email`) is populated for the submitter to maintain security boundaries.
- **Empty Results**: Returns an empty array `[]` with valid pagination meta if no records match the criteria.
- **Timestamping**: `createdAt` and `updatedAt` reflect the original submission and last administrative action.

---

## 4. Implementation
- **Route**: [src/app/modules/ask-imam/ask-imam.route.ts](../../../src/app/modules/ask-imam/ask-imam.route.ts) — `router.get('/', ...)`
- **Controller**: [src/app/modules/ask-imam/ask-imam.controller.ts](../../../src/app/modules/ask-imam/ask-imam.controller.ts) — `getAllQuestions`
- **Service**: [src/app/modules/ask-imam/ask-imam.service.ts](../../../src/app/modules/ask-imam/ask-imam.service.ts) — `getAllQuestionsFromDB`

**Middleware order**: `auth(SUPER_ADMIN)` -> `AskImamController.getAllQuestions`.

---

## 5. Security
- **Role Enforcement**: Prevents non-admin users and other administrative roles from viewing questions submitted by others. Only `SUPER_ADMIN` is permitted.
- **Population Control**: Only specific public fields (`name`, `email`) are populated from the `User` model to prevent leaking sensitive data.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Questions fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 125,
    "totalPage": 13
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "userId": {
        "_id": "664a1b2c3d4e5f6a7b8c9d0f",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "question": "How to perform Wudu correctly?",
      "imageUrl": "http://localhost:5000/uploads/images/1715421000-abc123.jpg",
      "status": "pending",
      "createdAt": "2026-05-11T10:30:00.000Z",
      "updatedAt": "2026-05-11T10:30:00.000Z"
    }
  ]
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
- **Answer Question** -> [04-answer-question.md](./04-answer-question.md).
- **Get Analytics** -> [05-get-analytics.md](./05-get-analytics.md).
