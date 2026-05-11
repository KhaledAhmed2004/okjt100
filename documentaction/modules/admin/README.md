# Admin Module APIs

> **Section**: Backend API specifications for the admin module (analytics & dashboard).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Auth**: All endpoints require `Bearer {{accessToken}}` with `SUPER_ADMIN` role
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - Dashboard Overview Screen — Growth metrics + monthly trend charts

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation | Used By |
|---|---|---|---|---|---|
| 01 | GET | `/admin/growth-metrics` | SUPER_ADMIN | [01-growth-metrics.md](./01-growth-metrics.md) | Dashboard Overview Screen — summary stats (users, active users, verified users) with month-over-month change |
| 02 | GET | `/admin/preference-cards/trends/monthly` | SUPER_ADMIN | [02-monthly-preference-cards-trend.md](./02-monthly-preference-cards-trend.md) | Dashboard Overview Screen — plain monthly trend chart for preference cards (no YoY) |
| 03 | GET | `/admin/subscriptions/trends/monthly` | SUPER_ADMIN | [03-monthly-active-subscriptions-trend.md](./03-monthly-active-subscriptions-trend.md) | Dashboard Overview Screen — monthly trend chart for active subscriptions with YoY + peak/slowest precomputed |
| 04 | GET | `/admin/users/stats` | SUPER_ADMIN | [04-user-stats-dashboard.md](./04-user-stats-dashboard.md) | Dashboard User Mgmt — summary stats (total, active, inactive, blocked) with MoM change |
| 05 | GET | `/admin/users` | SUPER_ADMIN | [05-list-users.md](./05-list-users.md) | Dashboard User Mgmt — table view with search, filtering, and pagination |
| 06 | GET | `/admin/users/:userId` | SUPER_ADMIN | [06-get-user-by-id.md](./06-get-user-by-id.md) | Dashboard User Mgmt — detailed profile view for a specific user |
| 07 | PATCH | `/admin/users/:userId` | SUPER_ADMIN | [07-update-user.md](./07-update-user.md) | Dashboard User Mgmt — editing user info or toggling status (ACTIVE/RESTRICTED) |
| 08 | DELETE | `/admin/users/:userId` | SUPER_ADMIN | [08-delete-user.md](./08-delete-user.md) | Dashboard User Mgmt — permanent removal of a user account |

### Related admin-only modules

Other endpoints mounted under `/admin/*` live in their own module folders:

| Path Prefix | Module | Purpose |
|---|---|---|
| `/admin/pending-emails/*` | [../pending-email/](../pending-email/) | Inspect / requeue / stats for the durable email retry queue. SUPER_ADMIN only. See [../pending-email/README.md](../pending-email/README.md) and the queue policy at [../../system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue). |

---

## Edge Cases

| Scenario | Behavior |
| :--- | :--- |
| **No Data (New System)** | 01 & 04: `value` 0, `changePct` 0, `direction` `"neutral"`. 02: `data` is an empty array `[]`. 03: `summary.peak` and `summary.slowest` will be `null`, and every month in `series` will have `count: 0`. |
| **YoY Comparison — No Last-Year Data** | In 03, if `lastYearCount` is 0 and the current month `count > 0`, `yoyGrowthPct` is set to `100` (server-side aggregation logic). If both are 0, it is `0`. |
| **Database Latency** | Parallel aggregation calls are used — there is a risk of partial dashboard loading. **Skeleton screens are recommended.** |
| **Unauthorized Access** | Without the `SUPER_ADMIN` role → `403 Forbidden`. |
| **Missing Optional Fields** | In 05 and 06, if fields like `hospital` or `phone` are empty in DB, they are **omitted** from the JSON response. |

---

## API Status

| # | Endpoint | Method | Auth | Status | Notes |
|---|---|:---:|:---:|:---:|---|
| 01 | `/admin/growth-metrics` | GET | SUPER_ADMIN | Done | Summary stats — `changePct` always positive magnitude, use `direction` for sign |
| 02 | `/admin/preference-cards/trends/monthly` | GET | SUPER_ADMIN | Done | Plain monthly trend — flat array of `{ month, label, count }`, no YoY |
| 03 | `/admin/subscriptions/trends/monthly` | GET | SUPER_ADMIN | Done | Monthly trend with YoY + `peak`/`slowest` precomputed |
| 04 | `/admin/users/stats` | GET | SUPER_ADMIN | Done | User growth metrics for management dashboard |
| 05 | `/admin/users` | GET | SUPER_ADMIN | Done | Comprehensive user listing with joined subscription & card stats |
| 06 | `/admin/users/:userId` | GET | SUPER_ADMIN | Done | Basic profile data retrieval |
| 07 | `/admin/users/:userId` | PATCH | SUPER_ADMIN | Done | Unified update for profile info and status transitions |
| 08 | `/admin/users/:userId` | DELETE | SUPER_ADMIN | Done | Permanent hard delete |
