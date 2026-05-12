# Project Overview — Preference Card Platform

> **Purpose**: Single-page, industry-standard overview of the entire system. Read this first to get the full picture before diving into screen-level UX docs.
>
> **Sources**: Synthesized from `app-screens/` (mobile, student-facing) and `dashboard-screens/` (web, admin-facing) UX-flow specs + 13 confirmed product decisions (see Appendix A).
>
> **Last reviewed**: 2026-04-28 · **Status**: Final v1

---

## 1. Product Summary

A **medical Preference Card platform** — a digital catalog where surgeons / medical students browse, create, share, and manage **surgeon preference cards** (per-procedure cards listing surgeon preferences: medications, supplies, sutures, instruments, positioning, prepping, workflow, key notes, photos).

Two parallel surfaces consume the same backend:

| Surface | Audience | Goal |
|---|---|---|
| **Mobile App** (Flutter) | Users (`BROTHER` / `SISTER` role) | Discover, favorite, download, and create content; manage personal calendar; subscribe to a paid plan. |
| **Admin Dashboard** (Web) | Platform admins (`SUPER_ADMIN` / `ADMIN` role) | Moderate / verify users, manage content, edit legal pages, monitor growth metrics. |

**Monetization**: Three-tier subscription (Free / Premium / Enterprise) sold through Apple App Store + Google Play with server-side IAP receipt verification. See §9.

---

## 2. Tech Stack

- **Backend**: TypeScript + Express + MongoDB (Mongoose)
- **Realtime**: Socket.IO (live notifications)
- **Push**: Firebase Cloud Messaging (FCM)
- **Payments**: In-App Purchase (IAP) — Apple App Store + Google Play (server-side receipt verification)
- **Observability**: OpenTelemetry, Mongoose metrics, auto-labelled controllers/services
- **Mobile App**: Flutter / Dart (`google_sign_in`, `sign_in_with_apple`)
- **Auth**: JWT access tokens + refresh-token rotation (httpOnly cookie + body)

---

## 3. User Roles & Personas

| Role | Surface | Capabilities |
|---|---|---|
| `BROTHER` / `SISTER` | Mobile | Register/login (email or Google/Apple), manage profile/subscription, join groups, ask imams. |
| `SUPER_ADMIN` / `ADMIN` | Dashboard | Full admin surface: growth metrics, user CRUD + block, **user verification**, legal CMS. |
| Public (unauth) | Either | Auth endpoints only (register, login, forgot/reset password, social login, refresh, resend OTP). |

---

## 4. High-Level Architecture

```
┌────────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Flutter App   │      │  Admin Web App  │      │  Apple IAP / │
│   (USER)       │      │  (SUPER_ADMIN)  │      │  Google Play │
└───────┬────────┘      └────────┬────────┘      └──────┬───────┘
        │   REST + Socket.IO     │   REST + Socket.IO   │ Receipt verify
        └─────────┬──────────────┴──────────┬───────────┘
                  ▼                         ▼
          ┌────────────────────────────────────┐
          │   Express API  (api/v1/*)          │
          │   ├─ Auth (JWT + rotation)         │
          │   ├─ Modules (feature-folder)      │
          │   ├─ QueryBuilder / AggBuilder     │
          │   ├─ Subscription gate middleware  │
          │   └─ Auto-labelled observability   │
          └──────────┬──────────────┬──────────┘
                     │              │
              ┌──────▼─────┐   ┌────▼─────┐
              │  MongoDB   │   │   FCM    │
              │ (Mongoose) │   │  (Push)  │
              └────────────┘   └──────────┘
```

**Module structure** (per feature folder under `src/app/modules/`):
`interface.ts` · `model.ts` · `controller.ts` · `service.ts` · `route.ts` · `validation.ts`

**Request flow**:
`Route → rateLimit → auth → planGate → fileHandler → validateRequest(Zod) → Controller (catchAsync) → Service (ApiError) → Model → sendResponse()`

---

## 5. Module Map

### Mobile App (`app-screens/`)

| # | Screen | Core Domain | Key Endpoints |
|---|---|---|---|
| 01 | **Auth** | Account, Sessions | `POST /users`, `POST /auth/login`, `/auth/social-login`, `/auth/verify-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh-token`, `/auth/logout`, `/auth/resend-verify-email` |
| 02 | **Home** | Discovery + Stats | `GET /preference-cards/stats`, `/users/me/favorites`, `/preference-cards?visibility=public&searchTerm=…`, favorite/unfavorite |
| 03 | **Card Details** | Card CRUD | `GET/PATCH/DELETE /preference-cards/:cardId`, `POST /preference-cards`, `POST /preference-cards/:cardId/download` (counter-only), `GET /supplies`, `GET /sutures` |
| 04 | **Library** | Global search (paid only) | `GET /preference-cards?visibility=public`, `GET /preference-cards/specialties`, favorite/unfavorite/download |
| 05 | **Calendar** | Personal Events (paid only) | `GET/POST /events`, `GET/PATCH/DELETE /events/:eventId` |
| 06 | **Profile** | Account + Sub + Legal | `GET/PATCH /users/me`, `GET /subscriptions/me`, `POST /subscriptions/verify-receipt`, `GET /legal`, `GET /legal/:slug` |
| 07 | **Notifications** | Cross-cutting | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id` |

### Admin Dashboard (`dashboard-screens/`)

| # | Screen | Core Domain | Key Endpoints |
|---|---|---|---|
| 01 | **Auth** | Admin Sessions | Same auth endpoints, scoped by role |
| 02 | **Overview** | Analytics | `GET /admin/growth-metrics`, `/admin/preference-cards/monthly`, `/admin/subscriptions/active/monthly` |
| 03 | **User Management** | Doctor CRUD | `GET /users/metrics`, `GET /users`, `POST /users`, `PATCH /users/:userId`, `DELETE /users/:userId` |
| 04 | **Preference Card Management** | Verification | `GET /preference-cards?moderation=pending` (Enterprise creators only), `PATCH /preference-cards/:cardId` with `{ verificationStatus: "VERIFIED" \| "REJECTED" }`, `DELETE /preference-cards/:cardId` |
| 05 | **Legal Management** | CMS | `GET/POST /legal`, `GET/PATCH/DELETE /legal/:slug` |
| 06 | **Supplies Management** | Master Catalog | `GET/POST /supplies`, `POST /supplies/bulk`, `PATCH/DELETE /supplies/:supplyId` |
| 07 | **Sutures Management** | Master Catalog | `GET/POST /sutures`, `POST /sutures/bulk`, `PATCH/DELETE /sutures/:sutureId` |

> **Refactor note (D8):** Old mirrored routes `PATCH .../approve` and `PATCH .../reject` are replaced by a single `PATCH /preference-cards/:cardId` with `{ verificationStatus }` in the body, per project convention.

---

## 6. End-to-End User Journey

### Student / Surgeon (Mobile)

```
Register → Verify OTP → Auto-Login → Home  (no onboarding screen, direct to Home)
   │
   ├─ Browse / Search (Home + Library)
   │      └► Library tab is locked behind paywall for Free users
   │      └► Library = global search over PUBLIC verified cards (paid users only)
   │      └► Card Details ──► Download (counter++) / Favorite / Share
   │
   ├─ Home tabs: All Cards (public discovery) ⇆ My Cards (own cards via ?visibility=private)
   │
   ├─ Create Card (+ FAB)
   │      └► Pre-check: hit card-count limit? → FAB disabled + tooltip
   │      └► Form (Supplies / Sutures dropdowns, photos, etc.)
   │      └► Saved as UNVERIFIED
   │             └► Enterprise creators only: admin can VERIFY
   │             └► Free / Premium creators: stays UNVERIFIED forever
   │
   ├─ Calendar (locked for Free) ──► Create / Edit / Delete Events
   │      └► Reminders auto-scheduled at T-24h and T-1h (Push + Socket + DB)
   │
   ├─ Profile ──► Edit info · Plan (Free / Premium / Enterprise via IAP) · Legal · Logout
   │
   └─ Notifications (Bell, red dot if any unread) ──► List · Mark read · Delete
```

### Admin (Dashboard)

```
Login (SUPER_ADMIN) → Overview (Growth metrics + Trend charts)
   │
   ├─ User Management ──► Search / Filter / Create / Edit / Block (status toggle) / Delete
   │
   ├─ Preference Card Management ──► Moderation queue (Enterprise creators only)
   │      └► PATCH /:cardId  { verificationStatus: "VERIFIED" | "REJECTED" }
   │      └► Delete any card
   │
   ├─ Legal Management ──► Create / Edit / Delete pages by slug
   │
   ├─ Supplies Catalog ──► Single & Bulk create · Edit · Delete
   │
   └─ Sutures Catalog ──► Single & Bulk create · Edit · Delete
```

---

## 7. Domain Model (Core Entities)

| Entity | Owner | Key Fields | Lifecycle |
|---|---|---|---|
| **User** | self / admin | `name`, `email`, `password` (optional for OAuth), `phone`, `country`, `role`, `status` (`ACTIVE` / `RESTRICTED`), `verified`, `favoriteCards[]`, `tokenVersion`, `deviceToken`, `subscriptionPlan`, `subscriptionExpiresAt` | Created → OTP-verified → Active → (optionally Restricted / Deleted) |
| **PreferenceCard** | creator (USER) | `cardTitle`, `surgeon{ name, specialty, handPreference, contactNumber, musicPreference }`, `medication`, `supplies[]`, `sutures[]`, `instruments`, `positioningEquipment`, `prepping`, `workflow`, `keyNotes`, `photos[]`, `published`, `verificationStatus` (`UNVERIFIED` / `VERIFIED` / `REJECTED`), `visibility` (`public` / `private`), `downloadCount` | Created (always `UNVERIFIED`) → admin verifies (Enterprise creators only) → `VERIFIED` (visible in public library to paid users) |
| **Supply** / **Suture** | admin | `name` (unique) | Master catalog entries; auto-created when referenced by name in card payloads. |
| **Event** | user | `title`, `date`, `time`, `duration` (minutes), `location`, `eventType` (`surgery` \| `meeting` \| `consultation` \| `other`), `linkedPreferenceCard` (optional), `personnel: Array<{ name, role }>` (optional), `notes` (optional) | Created → Reminders fire at T-24h and T-1h |
| **Notification** | system | `userId`, `type` (`REMINDER` / card / event), `title`, `subtitle`, `read`, `icon`, `createdAt` | Persisted in DB + emitted over Socket + (optionally) FCM push |
| **LegalPage** | admin | `slug` (unique), `title`, `content` | CMS-managed |
| **Subscription** | user | `plan` (`FREE` / `PREMIUM` / `ENTERPRISE`), `interval` (`monthly` / `yearly`), IAP receipt + product ID, `expiresAt`, `autoRenew` | Free by default → upgraded via IAP receipt verification → expires / renews on store webhook |

### Card lifecycle

```
[USER creates card]
        │
        ▼
  UNVERIFIED  ─ visibility=private ─► visible only to creator
        │     ─ visibility=public  ─► still creator-only until verified
        │
        │  admin reviews (only if creator.plan === ENTERPRISE)
        │
        ├──► VERIFIED  ─► visible in public library to PREMIUM + ENTERPRISE users
        │                  (Free users have no library access)
        │
        └──► REJECTED  ─► visible only to creator + reason
```

### Visibility matrix (who can see a card)

| Card state | Creator | Free viewer | Premium viewer | Enterprise viewer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Private (any verification) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Public + UNVERIFIED | ✅ | ❌ | ❌ | ❌ | ✅ (queue, if Enterprise creator) |
| Public + VERIFIED | ✅ | ❌ (no library access) | ✅ | ✅ | ✅ |
| Public + REJECTED | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## 8. Cross-Cutting Concerns

### Authentication
- JWT access token + refresh token (rotation enabled).
- Refresh token reuse → forced logout (`tokenVersion` increment).
- Social login (Google + Apple) returns same token pair.
- Forgot-password uses **silent success** to prevent email enumeration.
- 401 on any protected call → client auto-retries via `POST /auth/refresh-token`.

### Authorization (three layers)
1. **Role gate** — `auth(...roles)` on every protected route. `SUPER_ADMIN` required for `/admin/*`, user mgmt, card verification, legal CMS, supplies/sutures writes.
2. **Plan gate** — subscription tier check for paid features (library access, calendar, card-count limits, verification eligibility). See §9.
3. **Resource ownership** — only the creator (or `SUPER_ADMIN`) can edit/delete their own card; private cards are only visible to the creator.

### Plan-gate enforcement
- **Library access** (`GET /preference-cards?visibility=public`) → 402/403 with `code: PLAN_REQUIRED` for Free users.
- **Calendar** (any `/events` endpoint) → 402/403 with `code: PLAN_REQUIRED` for Free users.
- **Card-count ceiling** on `POST /preference-cards` → 403 with `code: CARD_LIMIT_REACHED` when over plan quota. Frontend pre-checks `GET /preference-cards/stats` and disables the Create-FAB defensively (D11).
- **Verification eligibility** — `PATCH /preference-cards/:cardId { verificationStatus: "VERIFIED" }` only allowed when `creator.subscriptionPlan === "ENTERPRISE"`.

### Notifications (3 channels — fan-out per type)

| Trigger | Push (FCM) | Socket | DB |
|---|:---:|:---:|:---:|
| Event reminder (T-24h, T-1h) | ✅ | ✅ | ✅ |
| New preference card created | — | ✅ | ✅ |
| Event scheduled confirmation | — | ✅ | ✅ |

**List screen UX**: Bell icon → list view → swipe-to-delete + "Mark all as read". Unread badge is **backend-provided** in `meta.unreadCount` from the list response (Industry best practice).

### Observability
- Auto-labelling on `*Controller` / `*Service` classes (must load before routes).
- Mongoose metrics initialized **before** any model compiles.
- `getRequestContext()` for per-request correlation.

### Standard Response Envelope
```json
{ "success": true, "statusCode": 200, "message": "...", "data": { ... }, "meta": { ... } }
```
Errors share the same shape with `success: false` and `data: null`.

### Common Edge Cases
- **Email enumeration** → silent-success on forgot-password.
- **Token rotation violation** → force logout.
- **OAuth without password** → password not required on profile update for social-login users.
- **Private card access by non-owner** → 403.
- **Plan-gated endpoint hit by Free user** → 402 / 403 with `code: PLAN_REQUIRED`. Frontend opens paywall modal.
- **Card-count ceiling reached** → 403 with `code: CARD_LIMIT_REACHED`. Frontend opens upgrade CTA.
- **Verification attempted on non-Enterprise creator** → 403 with `code: PLAN_NOT_ELIGIBLE`.
- **Validation** → Zod returns detailed 400 with field paths.
- **Rate limit** → 429 (e.g., public search: 60 req/min).
- **Empty states** → `200 OK` with `data: []`, never 404 for "no items".

---

## 9. Subscription Plans (IAP)

Three tiers, billed via Apple App Store / Google Play. Server-side receipt verification + plan gating.

| Plan | Monthly | Yearly | Cards | Library | Calendar | Verification |
|---|---:|---:|---:|---|---|:---:|
| **Free** | $0 | $0 | 2 | ❌ no access | ❌ none | ❌ |
| **Premium** | $5.99 | $59.99 | 20 | ✅ upload + download | Basic | ❌ (no badge on own cards) |
| **Enterprise** | $9.99 | $99.99 | Unlimited | ✅ upload + download | Advanced | ✅ admin can verify own cards |

> **Team Collaboration** is a future-roadmap feature shown on the Enterprise pricing screen as **"Coming Soon"** — not in scope for v1, no APIs or models yet.

**Plan-gating rules**:
- **Free** — can only create up to 2 cards. **Library and Calendar tabs are visible but locked**: tapping opens an upgrade paywall modal (D10). Cannot see verified cards from anyone.
- **Premium** — unlocks Library + Basic Calendar; can see all VERIFIED cards in the public library; can create up to 20 personal cards. Their own cards are **never** eligible for the Verified badge.
- **Enterprise** — unlocks Library + Advanced Calendar; unlimited card creation; **only tier whose cards admin can mark as VERIFIED** and surface in the public library.

**Subscription endpoints** (to be added to `06-profile.md` screen doc):
- `GET /subscriptions/me` — returns `plan`, `interval`, `expiresAt`, `autoRenew`. For free users returns `plan: "FREE"` (never 404).
- `POST /subscriptions/verify-receipt` — body: `{ platform: "ios" | "android", productId, receipt }`. Server verifies with Apple / Google, upserts subscription, returns updated plan.
- IAP webhook handler — store-side renewal / cancel events update `expiresAt` + plan.

---

## 10. API Surface Summary

| Module | Mount | Public? | Notes |
|---|---|:---:|---|
| `/users` | self-register, profile, favorites, admin user mgmt | mixed | `POST /users` is public (registration); admin-create uses same endpoint with `SUPER_ADMIN` auth. |
| `/auth/*` | login, OTP, refresh, logout, social-login | mostly public | |
| `/preference-cards` | list, create, CRUD, favorite, download (counter), verify (admin), specialties, stats | auth | Visibility filter via `?visibility=public\|private`. Public list returns only `verificationStatus: VERIFIED`, gated to paid plans. |
| `/events` | personal calendar | auth (USER, paid plan only) | Free users get 402/403 with `code: PLAN_REQUIRED`. |
| `/notifications` | list, read, delete | auth | List response carries `meta.unreadCount`; client renders red dot from `meta.unreadCount > 0`. No separate `/unread-count` endpoint. |
| `/legal/*` | list/get public; CMS admin-only | mixed | Reads public; writes `SUPER_ADMIN`. |
| `/supplies`, `/sutures` | catalog | auth + admin for writes | Reads available to USERs (card-creation dropdown). |
| `/subscriptions/me`, `/subscriptions/verify-receipt` | plan + IAP verification | auth (USER) | `GET /subscriptions/me` returns `plan: "FREE"` for free users — never 404. |
| `/admin/*` | growth metrics + trend charts | `SUPER_ADMIN` | |

---

## Appendix A — Decisions Log (v1)

All decisions confirmed across the alignment rounds. Source of truth for any later UX-flow / API edits.

| # | Topic | Decision |
|---|---|---|
| **D1** | Card moderation | Cards always start `UNVERIFIED`. Admin manually verifies. Verification is the **gate** (not just a badge): only `VERIFIED` + `visibility=public` cards appear in the public library. |
| **D2** | Public vs Private | `visibility` field is the single source of truth (`public` vs `private`), set at creation. "My Cards" filter is a separate `creator=me` query. |
| **D3** | IAP integration | Client posts store receipt to `POST /subscriptions/verify-receipt`; server verifies with Apple/Google and updates plan. |
| **D4** | Notification list UX | Server returns `meta.unreadCount` on the `GET /notifications` list response. Client renders the bell-icon red dot from `meta.unreadCount > 0`. (Reverses the earlier "client computes from list" position; no separate `/unread-count` endpoint exists.) |
| **D5** | Card download | Counter-only. Client renders the PDF locally; `POST /preference-cards/:cardId/download` only increments the counter. |
| **D6** | Calendar event schema | `personnel` is now `Array<{ name: string, role: string }>` (supersedes the original `string[]`). Event also has an `eventType` enum (`surgery` \| `meeting` \| `consultation` \| `other`), an optional `linkedPreferenceCard` reference, and a `duration` (minutes). |
| **D7** | Onboarding | None. After auto-login, user lands directly on Home. References to "Welcome/Onboarding" should be removed from `01-auth.md`. |
| **D8** | Admin moderation routes | Refactor `PATCH /:cardId/approve` + `/reject` → single `PATCH /:cardId` with `{ verificationStatus }` body, per project convention. |
| **D9** | Yearly pricing | Premium **$59.99/year**, Enterprise **$99.99/year** (≈ 2 months free vs monthly). |
| **D10** | Free-tier locked tabs | Library and Calendar tabs are **visible but locked** for Free users. Tap → paywall / upgrade modal. |
| **D11** | Card-count ceiling | Backend returns `403` with `code: CARD_LIMIT_REACHED`; frontend pre-checks `GET /preference-cards/stats` and disables the Create-FAB. Defence-in-depth. |
| **D12** | Team Collaboration | **Future roadmap** only. Not in v1. Pricing screen shows "Coming Soon" on the Enterprise tier. No team APIs / models yet. |
| **D13** | Verification eligibility | Only Enterprise creators' cards are eligible for verification. Admin moderation queue auto-filters to `creator.subscriptionPlan === "ENTERPRISE"`. Verified cards are visible to **Premium + Enterprise** viewers; Free viewers have no library access at all. |

---

## Appendix B — Out-of-Scope (v1)

Captured here so they aren't accidentally added to screen docs:

- **Welcome / Onboarding screen** — no onboarding; user lands directly on Home after auto-login (D7).
- **Team workspaces / invites / shared cards** — Enterprise pricing teaser only; deferred (D12).
- **Server-rendered card PDFs** — client renders locally; revisit if a canonical PDF is needed (D5).
- **Dedicated notification unread-count endpoint** — unread count is delivered inline via `meta.unreadCount` on `GET /notifications`; no separate `/unread-count` route (D4).
- **Notification grouping** — deferred to v2. No `isGrouped` / `groupCount` fields in the v1 response shape.
- **Approve / Reject mirrored routes** — folded into `PATCH /:cardId` body field (D8).

---

*End of overview.*
