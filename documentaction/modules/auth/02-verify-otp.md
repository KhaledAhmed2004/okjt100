# 02. Verify OTP

```http
POST /auth/verify-otp
Content-Type: application/json
Auth: None (Public — OTP validated inline)
```

## 1. Overview
Single endpoint that handles **two distinct flows** based on the user's `verified` state at the moment of OTP submission:

- **Registration flow** (`verified: false`): flips the user to `verified: true`, clears the OTP, and **auto-logs the user in** by issuing an access + refresh token pair. Saves the registration friction of "go to login screen and re-enter your password".
- **Forgot-password flow** (`verified: true`): sets the one-time `authentication.isResetPassword = true` flag, clears the OTP, and returns a freshly-generated `resetToken` that the client passes to [04-reset-password.md](./04-reset-password.md) within `RESET_TOKEN_TTL_MS` (5 min).

The branch is decided server-side from the user's existing `verified` state — the client doesn't pass a "purpose" flag.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The `(email, otp)` pair is the credential. A matching pair is required and the OTP must not have expired.

### 2.2 Account Status Rules
- The lookup explicitly excludes `DELETED` users (`status: { $ne: USER_STATUS.DELETED }` at [auth.service.ts:195](../../../src/app/modules/auth/auth.service.ts#L195)). A soft-deleted user trying to verify an old OTP gets the generic `400 "Invalid or expired verification code"` — same response as wrong/expired OTP (anti-enumeration).
- Other statuses (`PENDING`, `ACTIVE`, `SUSPENDED`, etc.) are not blocked at this endpoint — verification is permitted because it's an identity-proof step, not an authenticated action.

### 2.3 Role-Based Access
Not applicable — public endpoint.

### 2.4 Input Validation (Zod — `createVerifyEmailZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email format. |
| `otp` | `string` | Yes | Non-empty string. Code does not enforce a digit-only pattern at validation time; the OTP lookup compares the raw string against what was stored. |

Schema violations -> `400 Bad Request` from `validateRequest`. Missing OTP at service-layer defence -> `400 "OTP is required"`.

### 2.5 Atomic OTP Lookup
The find query is intentionally atomic so race-conditions (double-submit, parallel attempts) cannot consume the OTP twice:

```ts
User.findOne({
  email,
  'authentication.oneTimeCode': otp,
  'authentication.expireAt': { $gt: new Date() },
  status: { $ne: USER_STATUS.DELETED },
})
```

No match (wrong OTP, expired OTP, no user, deleted user) -> `400 "Invalid or expired verification code"`.

### 2.6 Dual-Flow Side Effects

#### 2.6a — Registration flow (`verified === false`)
On match:
1. `verified = true`, `authentication.oneTimeCode = null`, `authentication.expireAt = null`.
2. Issue `accessToken` + `refreshToken` (both carry `tokenVersion`).
3. Return `{ accessToken, refreshToken, isOnboardingCompleted }`.
4. Message: `"Email verify successfully"` (note: spelled "verify" not "verified" in code — see [auth.service.ts:249](../../../src/app/modules/auth/auth.service.ts#L249)).

#### 2.6b — Forgot-password flow (`verified === true`)
On match:
1. `authentication.isResetPassword = true`, `authentication.oneTimeCode = null`, `authentication.expireAt = null`.
2. Generate `resetToken = crypto.randomBytes(32).toString('hex')`.
3. `ResetToken.create({ user, token, expireAt: now + RESET_TOKEN_TTL_MS })` — TTL is **5 minutes** ([auth.constants.ts:2](../../../src/config/auth.constants.ts#L2)).
4. Return `{ resetToken }`.
5. Message: `"Verification Successful: Please securely store and utilize this code for reset password"`.

### 2.7 OTP TTL
- OTP is set with `expireAt = Date.now() + OTP_TTL_MS` (3 minutes from [auth.constants.ts:1](../../../src/config/auth.constants.ts#L1)) at registration time and by `POST /auth/forgot-password`.
- Resend cooldown of 60s is enforced by [07-resend-otp.md](./07-resend-otp.md).
- The email itself is delivered through the durable [PendingEmail queue](../../system-concepts.md#email-delivery--retry-queue) — SMTP failures retry with backoff, so a transient outage delays the OTP a few seconds rather than dropping it silently.

### 2.8 Rate Limit
- **5 requests / minute / IP**, identified by `routeName: 'auth:password-reset'` ([auth.route.ts:25-29](../../../src/app/modules/auth/auth.route.ts#L25-L29)). Shared with the forgot/reset endpoints.
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/verify-otp', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `verifyEmail`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `verifyEmailToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createVerifyEmailZodSchema`

**Middleware order**: `passwordResetRateLimit` -> `validateRequest(createVerifyEmailZodSchema)` -> `AuthController.verifyEmail`.

The controller sets the `refreshToken` cookie on the success path that returns tokens (registration auto-login). The forgot-password success path returns `resetToken` in the body only — no cookie.

---

## 5. Security
- **Rate limit**: 5/min/IP (see §2.8).
- **Anti-enumeration**: wrong OTP, expired OTP, unknown email, and soft-deleted user all collapse to the same `400 "Invalid or expired verification code"`. An attacker can't probe email existence via this endpoint.
- **Atomic lookup** (see §2.5) — no race window for double-submit consuming the OTP twice.
- **OTP cleared on success** — even if the same OTP is somehow resubmitted, the second call returns the generic 400 (lookup misses because `oneTimeCode = null` after the first commit).
- **`resetToken` lifecycle**: stored in a separate `ResetToken` collection with 5-min TTL. Single-use — the reset-password endpoint deletes it on consumption.

---

## 6. Responses

### Success (200) — Registration flow (auto-login)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verify successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isOnboardingCompleted": false
  }
}
```

### Success (200) — Forgot-password flow (resetToken issued)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification Successful: Please securely store and utilize this code for reset password",
  "data": {
    "resetToken": "a3f8c2e1b4d7..."
  }
}
```

### Error: Validation failed (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.otp", "message": "OTP is required" }
  ]
}
```

### Error: OTP required (400)
*Defensive service-layer guard — usually caught by Zod first.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "OTP is required"
}
```

### Error: Invalid or expired verification code (400)
*Wrong OTP, expired OTP, unknown email, or soft-deleted user — all collapse to this message.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid or expired verification code"
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

- **Send the OTP (registration path triggers it automatically; resend path)** -> [07-resend-otp.md](./07-resend-otp.md).
- **Start the forgot-password flow (sends the OTP)** -> [03-forgot-password.md](./03-forgot-password.md).
- **Use the issued `resetToken` to change the password** -> [04-reset-password.md](./04-reset-password.md).
- **First sign-in after registration auto-login expires** -> [01-login.md](./01-login.md).
- **Refresh the auto-issued access token** -> [05-refresh-token.md](./05-refresh-token.md).
- **Complete onboarding after registration auto-login** -> [user/05-complete-onboarding.md](../user/05-complete-onboarding.md).
