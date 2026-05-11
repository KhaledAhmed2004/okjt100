# 02. Get User Details (Public Profile)

```http
GET /users/:userId/user
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER)
```

## 1. Overview
Returns a **limited** public profile of another user. Enforces strict role-based privacy: brothers can only view brothers, sisters can only view sisters; only `SUPER_ADMIN` bypasses the role match. Suspended/deleted users are invisible — including to the requester themselves through this endpoint.

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

### 2.2 Account Status Rules (Requester)
Checked after the DB lookup in the auth middleware.

| Requester Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access (Requester vs. Target)
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`.
- **Other requester roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).
- **Cross-gender match** (the service enforces this beyond the route's `auth` allow-list):
    - `SUPER_ADMIN` may view any target regardless of role.
    - For non-admin requesters, `requester.role` must equal `target.role`. Mismatch -> `403 Forbidden` (`"message": "You don't have permission to view this profile"`).

### 2.4 Target Visibility Rules
Enforced by the service after the DB lookup.

- **Target must exist** in DB.
- **Target `status` must be `ACTIVE`** — any other status (PENDING, SUSPENDED, DELETED, RESTRICTED, REJECTED, INACTIVE) is treated as not found.
- **Target must not have `deletedAt`** set (soft-delete check).
- Any failure of the above -> `404 Not Found` (`"message": "User not found"`).

### 2.5 Input Validation (Zod — `getUserDetailsZodSchema`)
- `params.userId` is a **string** matching the regex `/^[0-9a-fA-F]{24}$/` (24-char hex MongoDB ObjectId).
- Invalid format -> `400 Bad Request` from `validateRequest` with `"message": "Invalid User ID format"`.
- Missing `userId` -> `400 Bad Request` with `"message": "User ID is required"`.

---

## 3. Response Fields

### Returned (Limited Public Profile)
The service selects exactly these fields from the User document:
`_id`, `fullName`, `role`, `profileImage`, `location`, `isVerified`, `revertDuration`, `aboutMe`, `interests`, `specialty`, `hospital`, `createdAt`.

The service then **flattens** `location` into top-level `country` and `city` and removes the nested `location` object before returning. Internal status flags (`status`, `deletedAt`) are stripped.

### Excluded (Private)
- `email`, `phone`, `dateOfBirth`, `password`
- `authentication` (OTP / reset state)
- `deviceTokens`, `tokenVersion`
- `googleId`, `appleId`
- `verificationImage`, `verificationVideo`
- `status`, `deletedAt`, `updatedAt`

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.get('/:userId/user', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserDetailsById`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserDetailsByIdFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](file:///src/app/modules/user/user.validation.ts) — `UserValidation.getUserDetailsZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER)` -> `rateLimitMiddleware({ windowMs: 60s, max: 60, routeName: 'public-user-details' })` -> `validateRequest(getUserDetailsZodSchema)` -> `UserController.getUserDetailsById`.

### Service business logic (`getUserDetailsByIdFromDB`)
1. `User.findById(userId).select('_id fullName role profileImage location isVerified revertDuration aboutMe interests specialty hospital createdAt status deletedAt')` — projection includes `status` and `deletedAt` only for the visibility check.
2. If `!user || user.status !== ACTIVE || user.deletedAt` -> throw `ApiError(404, 'User not found')`.
3. If `requester.role !== SUPER_ADMIN` and `requester.role !== user.role` -> throw `ApiError(403, "You don't have permission to view this profile")`.
4. Flatten `location.country` / `location.city` to top-level fields, drop `location`.
5. Strip `status` and `deletedAt` from the response.

---

## 5. Security
- **Rate limit**: 60 requests / minute / IP, identified by `routeName: 'public-user-details'`. On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).
- **Token-version invalidation** applies (see §2.1).
- **No `verificationImage` / `verificationVideo`** is ever exposed through this endpoint.
- **HTTP cache**: responses are user-scoped and may change the moment the target updates their profile or status. The server emits `Cache-Control: private, no-store, max-age=0` and `Pragma: no-cache` so shared proxies cannot cache the body. Clients treat each call as fresh.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User details retrieved successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "fullName": "Jane Doe",
    "role": "SISTER",
    "profileImage": "uploads/users/profiles/2026-pic.jpg",
    "country": "USA",
    "city": "New York",
    "isVerified": true,
    "revertDuration": "3 years",
    "aboutMe": "Short intro",
    "interests": ["Quran Study", "Fitness"],
    "specialty": "Cardiology",
    "hospital": "City Hospital",
    "createdAt": "2026-05-09T10:00:00.000Z"
  }
}
```

### Error: Invalid User ID format (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "params.userId", "message": "Invalid User ID format" }
  ]
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
*Requester is suspended.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is suspended. Please contact support."
}
```

### Error: Account no longer active (403)
*Requester is `DELETED`, `RESTRICTED`, or `INACTIVE`.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is no longer active"
}
```

### Error: Account verification rejected (403)
*Requester is `REJECTED` — must re-submit verification documents before regaining access.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account verification was rejected. Please re-submit your documents."
}
```

### Error: Forbidden role at route level (403)
*Requester role is not in the route's allow-list.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

### Error: Cross-gender view (403)
*Service-level — non-admin requester role does not match target role.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to view this profile"
}
```

### Error: Not Found (404)
*Target does not exist, is not `ACTIVE`, or has `deletedAt`.*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User not found"
}
```

### Error: Rate limit exceeded (429)
```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## 7. Related Flows

- **Prerequisite — obtain `accessToken`**: [auth/01-login.md](../auth/01-login.md) or [auth/08-social-login.md](../auth/08-social-login.md).
- **Token expired during use** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
- **View your own profile (full fields)** -> [03-get-own-profile.md](./03-get-own-profile.md).
