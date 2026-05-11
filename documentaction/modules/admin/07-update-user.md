# 07. Update User & Status (Admin)

```http
PATCH /admin/users/:userId
Authorization: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Update any user field, including their account status (ACTIVE, RESTRICTED, etc.).

## Request Body
```json
{
  "name": "Updated Name",
  "status": "RESTRICTED",
  "role": "BROTHER"
}
```

## Implementation
- **Route**: [admin.route.ts](file:///src/app/modules/admin/admin.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `adminUpdateUser`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `updateUserByAdminInDB`

### Business Logic (`updateUserByAdminInDB`)
1. **Validation**: Uses `adminUpdateUserZodSchema` to validate the input body.
2. **Merging Logic**: This is a **Unified Update** endpoint. It can handle partial updates of profile data (name, phone) and state transitions (status, role) in a single request.
3. **Database Update**: Performs a `findByIdAndUpdate` to persist changes.

## Field Reference (Admin Specific)
| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `INACTIVE`, `RESTRICTED`, `DELETED` |
| `role` | `string` | `SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER` |
| `specialty` | `string` | Professional specialty |
| `rejectionReason` | `string` | Optional. Surfaced in the rejection email when `status -> REJECTED`. |

## Side Effects on `status` Transitions

Both the dedicated `PATCH /admin/users/:userId/status` (`updateUserStatusInDB`) and this combined `PATCH /admin/users/:userId` (`updateUserByAdminInDB`) apply the same status-flip side effects. The behavior is symmetric so an admin can use either endpoint to suspend/reject/restrict a user without leaking sessions through one path.

| Transition (`previousStatus -> newStatus`) | Side effects |
| :--- | :--- |
| any `-> REJECTED` | (a) Generate a **64-char hex re-verification token**, (b) persist it on `user.reverification` with a 24-hour TTL, (c) **enqueue** the `accountRejected` email via the [PendingEmail queue](../../system-concepts.md#email-delivery--retry-queue) (`kind: 'account_rejected_reverify'`) — durable, retried on SMTP failure, surfaces as a DEAD row for ops if max attempts are exhausted. (d) Bump `tokenVersion`. User re-submits docs via the public [user/13-reverify-account.md](../user/13-reverify-account.md). |
| any `-> SUSPENDED` | Bump `tokenVersion`. Every live JWT for this user is invalidated on the next request (auth middleware also blocks `SUSPENDED` with the specific message). |
| any `-> RESTRICTED` | Bump `tokenVersion`. Same lockout semantics as SUSPENDED. |
| any `-> INACTIVE` | Bump `tokenVersion`. Same lockout semantics. |
| any `-> DELETED` | Bump `tokenVersion`. Auth middleware blocks subsequent requests. Note: this admin-side flip does NOT start the 30-day soft-delete recovery window — that flow is user-initiated through [user/06-delete-account.md](../user/06-delete-account.md). An admin-flipped DELETED status is treated as terminal. |
| `REJECTED -> ACTIVE` (admin approves the re-submission) | Status updated. The pre-existing `reverification` token entry is NOT cleared automatically — it expires naturally or gets overwritten on the next REJECTED flip. |
| `<lockout> -> ACTIVE` | Status updated. `tokenVersion` is **NOT** bumped on the way back to ACTIVE — the user is expected to log in fresh anyway because their old tokens are already dead from the original lockout-flip bump. |
| Same-status no-op (e.g. `REJECTED -> REJECTED`) | No-op: no token re-issuance, no email, no tokenVersion bump. |

The status enum string for `DELETED` is stored as `'DELETE'` internally (see [src/enums/user.ts:14](../../../src/enums/user.ts#L14)) — clients should always use the enum name `DELETED` in API bodies.

For the project-wide policy on what triggers a `tokenVersion` bump, see [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy).

## Email Uniqueness

Admin can change a target user's `email`. Before the write, the service checks that no other active account already owns the new value (`User.findOne({ email, _id: { $ne: id }, status: { $ne: DELETED } })`). Collision -> `409 Conflict` (`"message": "This email is already in use"`). Soft-deleted users do not block — they'll be purged in <= 30 days. Without this check the model's unique index would trip an `E11000` at `.save()` and surface as a confusing `500`.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User updated",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "Updated Name",
    "status": "RESTRICTED",
    "updatedAt": "2026-05-05T10:00:00.000Z"
  }
}
```
