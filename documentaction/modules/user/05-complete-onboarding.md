# 05. Complete Onboarding

```http
PATCH /users/complete-onboarding
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER)
```

## 1. Overview
Marks the authenticated user's onboarding flow as completed by setting `isOnboardingCompleted: true`. Idempotent — calling it again on an already-onboarded user simply re-sets the flag and returns the same shape.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication Rules
Enforced by the `auth` middleware before the controller is reached.

- **Missing `Authorization` header** -> `401 Unauthorized` (`"message": "Unauthorized access"`).
- **Header does not start with `Bearer `** -> `401 Unauthorized` (`"message": "Authorization header must start with \"Bearer \""`).
- **Empty token after `Bearer `** -> `401 Unauthorized` (`"message": "Unauthorized access"`).
- **Invalid signature / `JsonWebTokenError`** -> `401 Unauthorized` (`"message": "Invalid token"`).
- **Expired token / `TokenExpiredError`** -> `401 Unauthorized` (`"message": "Token has expired"`).
- **Token not yet active / `NotBeforeError`** -> `401 Unauthorized` (`"message": "Token not active"`).
- **Verified payload missing `role`** -> `401 Unauthorized` (`"message": "Invalid token payload"`).
- **User in token no longer exists in DB** -> `401 Unauthorized` (`"message": "User no longer exists"`).
- **`tokenVersion` in JWT does not match DB** -> `401 Unauthorized` (`"message": "Session invalidated — please log in again"`).

### 2.2 Account Status Rules
Checked after the DB lookup in the auth middleware.

| Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
- **No request body is expected**. No Zod schema is attached to this route.
- Any extra fields sent in the body are silently ignored — only `isOnboardingCompleted` is mutated.

### 2.5 Side Effects & Idempotency
- **DB write**: `User.findByIdAndUpdate(id, { $set: { isOnboardingCompleted: true } }, { new: true })`.
- **Idempotent**: re-calling on a user where `isOnboardingCompleted === true` is a no-op at the data level (the flag is set again to `true`) and still returns `200 OK` with the user document.
- **No `tokenVersion` bump** — calling this does not invalidate existing JWTs.
- **No file or external side effects.**

---

## 3. Request Body
None. Send an empty body or `{}`.

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.patch('/complete-onboarding', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `completeOnboarding`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `completeOnboardingToDB`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER)` -> `UserController.completeOnboarding`. No `fileHandler`, no `validateRequest`.

### Service business logic (`completeOnboardingToDB`)
1. Resolve `id` from the JWT payload.
2. `User.isExistUserById(id)` -> if falsy, throw `ApiError(400, "User doesn't exist!")`.
3. `User.findByIdAndUpdate(id, { $set: { isOnboardingCompleted: true } }, { new: true })`.
4. Return the updated document.

---

## 5. Security
- **No per-route rate limit** is wired in code for this endpoint.
- **Token-version invalidation** applies (see §2.1).
- **No body-shape attack surface** — request body is unused.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Onboarding marked as completed",
  "data": {
    "id": "69fa332f3fc3858c40265420",
    "fullName": "Khaled Ahmed",
    "role": "BROTHER",
    "email": "khaledahmednayeem2004@gmail.com",
    "profileImage": "https://i.ibb.co/z5YHLV9/profile.png",
    "isOnboardingCompleted": true,
    "status": "ACTIVE",
    "isVerified": true,
    "deviceTokens": [
      { "token": "fcm-token-xyz", "lastSeenAt": "2026-05-05T18:32:02.435Z" }
    ],
    "createdAt": "2026-05-05T18:13:03.393Z",
    "updatedAt": "2026-05-10T18:33:49.649Z"
  }
}
```

### Error: User doesn't exist (400)
*Service-level check when the JWT's user id is not found in DB.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User doesn't exist!"
}
```

### Error: Unauthorized (401)
*Any of the auth-failure cases listed in §2.1. Example for missing token:*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized access"
}
```

### Error: Expired token (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Token has expired"
}
```

### Error: Session invalidated (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Session invalidated — please log in again"
}
```

### Error: Account suspended (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is suspended. Please contact support."
}
```

### Error: Account no longer active (403)
*Returned for `DELETED`, `RESTRICTED`, or `INACTIVE` status.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is no longer active"
}
```

### Error: Account verification rejected (403)
*Returned for `REJECTED` status — must re-submit verification documents before regaining access.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account verification was rejected. Please re-submit your documents."
}
```

### Error: Forbidden role (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

---

## 7. Related Flows

- **Prerequisite — verified, logged-in user**: [auth/02-verify-otp.md](../auth/02-verify-otp.md) -> [auth/01-login.md](../auth/01-login.md).
- **Read current onboarding state** — call [03-get-own-profile.md](./03-get-own-profile.md) and inspect `isOnboardingCompleted`. There is no dedicated read endpoint.
- **Update profile fields populated during onboarding** -> [04-update-own-profile.md](./04-update-own-profile.md).
