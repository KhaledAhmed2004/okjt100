# User Module APIs

> **Section**: Backend API specifications for the user module — endpoints under `/api/v1/users/*` plus the `POST /users/reverify` public endpoint. Admin-only user-management endpoints (list, stats, status updates, hard-delete) live under `/api/v1/admin/users/*` and are documented in [../admin/](../admin/).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../system-concepts.md#standard-response-envelope)
> **Cross-cutting concepts**: [system-concepts.md](../../system-concepts.md) covers idempotency, password policy, device-token storage, sessions metadata, JWT key rotation, token-version invalidation, file storage & orphan cleanup.
> **UX Flows referencing this module**:
> - [App - Auth Screen] — Registration (`POST /users`)
> - [App - Profile Screen] — Profile read/update, account deletion, email change, sessions, GDPR export
> - [App - Onboarding Flow] — Complete onboarding (`PATCH /users/complete-onboarding`)
> - [App - Re-verify Flow] — Public `POST /users/reverify` after admin rejection
> - [Dashboard - User Management Screen] — see [../admin/](../admin/) for the admin-side endpoints

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation |
|---|---|---|---|---|
| 01 | POST | `/users` | Public / SUPER_ADMIN | [01-create-user.md](./01-create-user.md) |
| 02 | GET | `/users/:userId/user` | Bearer | [02-get-user-details-public.md](./02-get-user-details-public.md) |
| 03 | GET | `/users/profile` | Bearer | [03-get-own-profile.md](./03-get-own-profile.md) |
| 04 | PATCH | `/users/profile` | Bearer | [04-update-own-profile.md](./04-update-own-profile.md) |
| 05 | PATCH | `/users/complete-onboarding` | Bearer | [05-complete-onboarding.md](./05-complete-onboarding.md) |
| 06 | DELETE | `/users/me` | Bearer | [06-delete-account.md](./06-delete-account.md) |
| 07 | POST | `/users/me/email-change/request` | Bearer | [07-email-change-request.md](./07-email-change-request.md) |
| 08 | POST | `/users/me/email-change/confirm` | Bearer | [08-email-change-confirm.md](./08-email-change-confirm.md) |
| 09 | POST | `/users/me/data-export` | Bearer | [09-data-export.md](./09-data-export.md) |
| 10 | GET | `/users/me/sessions` | Bearer | [10-list-sessions.md](./10-list-sessions.md) |
| 11 | DELETE | `/users/me/sessions/:tokenId` | Bearer | [11-revoke-session.md](./11-revoke-session.md) |
| 12 | POST | `/users/me/sessions/revoke-all` | Bearer | [12-revoke-all-sessions.md](./12-revoke-all-sessions.md) |
| 13 | POST | `/users/reverify` | Public (token) | [13-reverify-account.md](./13-reverify-account.md) |

> The admin-side user-management endpoints (list users, user stats, admin update, admin delete, admin status flip) live at `/api/v1/admin/users/*` and are documented in [../admin/](../admin/). See [../admin/05-list-users.md](../admin/05-list-users.md) through [../admin/08-delete-user.md](../admin/08-delete-user.md).

---

## Related Modules

- [../auth/](../auth/) — login, OTP, password reset/change, refresh, restore-account (the `tokenVersion` consumers across this module's session-invalidation policy)
- [../admin/](../admin/) — admin-side user list, search, stats, update, hard delete; admin status-flip side effects (re-verify token + email + tokenVersion bump) interact with [06-delete-account.md](./06-delete-account.md) and [13-reverify-account.md](./13-reverify-account.md)
- [../notification/](../notification/) — push delivery target. Device tokens registered via login/restore are stored in this module's `User.deviceTokens[]`; notification module reads them. Storage rules: [system-concepts.md — Device-Token Storage](../../system-concepts.md#device-token-storage).

---

## API Status

| # | Endpoint | Status | Roles | Notes |
|---|---|:---:|:---:|---|
| 01 | `POST /users` | Done | Public / SUPER_ADMIN | Multipart + 100 MB cap; transactional create; CAPTCHA hook-point; idempotent |
| 02 | `GET /users/:userId/user` | Done | User / Admin | Rate-limited 60/min; same-role enforcement; `no-store` cache |
| 03 | `GET /users/profile` | Done | User / Admin | Full self profile; `no-store` cache |
| 04 | `PATCH /users/profile` | Done | User / Admin | Profile + avatar upload (10 MB); auto-unlink + orphan-cron safety net |
| 05 | `PATCH /users/complete-onboarding` | Done | User / Admin | Idempotent at data level |
| 06 | `DELETE /users/me` | Done | User / Admin | Self soft-delete; 30-day recovery via auth/10-restore; idempotent |
| 07 | `POST /users/me/email-change/request` | Done | User / Admin | OTP to new + heads-up to old; idempotent |
| 08 | `POST /users/me/email-change/confirm` | Done | User / Admin | Commit + tokenVersion bump; race-safe via E11000 catch; idempotent |
| 09 | `POST /users/me/data-export` | Done | User / Admin | Sync JSON with 5 MB size guard; idempotent |
| 10 | `GET /users/me/sessions` | Done | User / Admin | Returns metadata only; `tokenPrefix` for display |
| 11 | `DELETE /users/me/sessions/:tokenId` | Done | User / Admin | Per-device revoke; no tokenVersion bump |
| 12 | `POST /users/me/sessions/revoke-all` | Done | User / Admin | Logout-all-devices (bumps tokenVersion); idempotent |
| 13 | `POST /users/reverify` | Done | Public (token) | Re-submit after admin rejection; 24h token; 5/hour rate limit; idempotent |
