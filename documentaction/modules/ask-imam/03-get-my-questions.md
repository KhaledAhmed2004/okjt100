# 03. Get My Questions

```http
GET /ask-imam/my-questions
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Allows a registered user (`BROTHER` or `SISTER`) to retrieve a paginated list of questions they have submitted. This endpoint provides users with visibility into their submission history and the status of their questions (pending or answered).

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only users with roles `BROTHER` or `SISTER` can access their own questions.
- **Status check**: The [auth middleware](../../../src/app/middlewares/auth.ts) automatically blocks access if the user status is `DELETED`, `RESTRICTED`, `SUSPENDED`, `REJECTED`, or `INACTIVE`.
- **Identity Enforcement**: The `userId` is automatically extracted from the authenticated token and used to filter the results, ensuring users can only see their own data.

### 2.2 Data Isolation & Filtering
- **Hard Filter**: The service layer enforces a mandatory filter on `userId` derived from the request's auth token. Any `userId` provided in query parameters is ignored.
- **QueryBuilder**: Users can apply additional filters (e.g., `status=answered`), sorting, and pagination within their own dataset.

### 2.3 Query Logic (QueryBuilder)
- **Filtering**: Uses `.filter()` to handle optional filters (e.g., `status`).
- **Sorting**: Uses `.sort()`. Defaults to `-createdAt` if no sort parameter is provided.
- **Pagination**: Uses `.paginate()` with `page` and `limit` parameters.
- **Field Selection**: Uses `.fields()` for projecting specific fields.

---

## 3. Behavioral Notes

- **Ownership Integrity**: Strictly prevents cross-user data access. A user cannot view questions submitted by another user even if they know the other user's ID.
- **Submission History**: Users can see both their unanswered (`pending`) and responded (`answered`) questions.
- **Empty Results**: Returns an empty array `[]` with valid pagination meta if the user has not submitted any questions.
- **Timestamping**: `createdAt` and `updatedAt` reflect the original submission and last activity.

---

## 4. Implementation
- **Route**: [src/app/modules/ask-imam/ask-imam.route.ts](../../../src/app/modules/ask-imam/ask-imam.route.ts) — `router.get('/my-questions', ...)`
- **Controller**: [src/app/modules/ask-imam/ask-imam.controller.ts](../../../src/app/modules/ask-imam/ask-imam.controller.ts) — `getMyQuestions`
- **Service**: [src/app/modules/ask-imam/ask-imam.service.ts](../../../src/app/modules/ask-imam/ask-imam.service.ts) — `getMyQuestionsFromDB`

**Middleware order**: `auth(BROTHER, SISTER)` -> `AskImamController.getMyQuestions`.

---

## 5. Security
- **Data Isolation**: Strictly prevents one user from viewing another user's questions by ignoring any `userId` provided in the query string and using the one from the JWT instead.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your questions fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "userId": "664a1b2c3d4e5f6a7b8c9d0f",
      "question": "How to perform Wudu correctly?",
      "imageUrl": "http://localhost:5000/uploads/images/1715421000-abc123.jpg",
      "status": "answered",
      "answer": "Wudu is performed by washing...",
      "answeredAt": "2026-05-11T12:00:00.000Z",
      "createdAt": "2026-05-11T10:30:00.000Z",
      "updatedAt": "2026-05-11T12:00:00.000Z"
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
- **Submit Question** -> [01-submit-question.md](./01-submit-question.md).
