# 04. Answer Question (Admin)

```http
PATCH /ask-imam/:questionId/answer
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to provide a formal answer to a specific user question. This action updates the question's state and records the timestamp of the response.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can provide answers.
- **Status check**: The [auth middleware](../../../src/app/middlewares/auth.ts) automatically blocks access if the admin account status is not `ACTIVE`.

### 2.2 Input Validation (Zod — `answerQuestionZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `answer` | `string` | Yes | Minimum 1 character after trimming. |

### 2.3 Database State Transitions
The service layer updates the document with the following logic:
- **`status`**: Forced to `answered`.
- **`answer`**: Updated with the provided text.
- **`answeredAt`**: Automatically set to the current `Date`.
- **Validation**: `runValidators: true` is enabled to ensure the final state complies with the Mongoose schema.

---

## 3. Behavioral Notes

- **One-Way State Change**: Answering a question automatically flips its status from `pending` to `answered`.
- **Overwrite Capability**: If a question is already answered, calling this endpoint again will overwrite the existing `answer` and update the `answeredAt` timestamp.
- **Immutability of Question**: This endpoint only updates the `answer` and `status` fields; the original `question` and `imageUrl` remain unchanged.
- **Notification System**: Currently, no automated notification (Push/Email) is triggered upon answering. Users must check their question history.
- **Enum Definitions**: Allowed statuses are `pending` and `answered`.

---

## 4. Request Body

```json
{
  "answer": "Wudu is performed by washing the hands, mouth, nostrils, face, arms, head, and feet in the prescribed order."
}
```

---

## 5. Implementation
- **Route**: [src/app/modules/ask-imam/ask-imam.route.ts](../../../src/app/modules/ask-imam/ask-imam.route.ts) — `router.patch('/:questionId/answer', ...)`
- **Controller**: [src/app/modules/ask-imam/ask-imam.controller.ts](../../../src/app/modules/ask-imam/ask-imam.controller.ts) — `answerQuestion`
- **Service**: [src/app/modules/ask-imam/ask-imam.service.ts](../../../src/app/modules/ask-imam/ask-imam.service.ts) — `answerQuestionInDB`
- **Validation**: [src/app/modules/ask-imam/ask-imam.validation.ts](../../../src/app/modules/ask-imam/ask-imam.validation.ts) — `AskImamValidation.answerQuestionZodSchema`

**Middleware order**: `auth(SUPER_ADMIN)` -> `validateRequest(AskImamValidation.answerQuestionZodSchema)` -> `AskImamController.answerQuestion`.

---

## 6. Security
- **Role Enforcement**: Prevents unauthorized roles (e.g., `BROTHER`, `SISTER`) and other administrative roles from answering questions. Only `SUPER_ADMIN` is permitted.
- **Input Sanitization**: Zod validation ensures the `answer` field is not empty and complies with schema rules.

---

## 7. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Question answered successfully",
  "data": {
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
}
```

### Error: Question not found (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Question not found"
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

## 8. Related Flows
- **View All Questions** -> [02-get-all-questions.md](./02-get-all-questions.md).
