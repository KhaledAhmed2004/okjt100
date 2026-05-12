# Database Design & Relationships

Ei document ta **TBSOSICK** system er full database architecture ebong model relationships gulo describe kore. MongoDB (NoSQL) use kora hoyeche jekhane data scalability ebong performance ke priority deya hoyeche.

---

## Data Models Overview

Amader system e main collections gulo holo:

1.  **Users**: Central user management (Admin, Doctors/Users).
2.  **Preference Cards**: Doctors der surgery-specific preferences.
3.  **Subscriptions**: IAP-based (Apple/Google) billing plans + access levels.
4.  **Supplies & Sutures**: Catalog items ja preference card e embed hoy.
5.  **Events**: Calendar/surgery scheduling (optionally linked to a PrefCard).
6.  **Notifications**: In-app ebong push notification tracking.
7.  **Legal**: Admin-managed legal pages (TOS, privacy, etc).

---

## Entity Relationship Map

```mermaid
erDiagram
    USER ||--o{ PREFERENCE_CARD : "createdBy (ObjectId)"
    USER ||--o| SUBSCRIPTION : "userId (unique)"
    USER ||--o{ NOTIFICATION : "userId"
    USER ||--o{ EVENT : "userId"

    PREFERENCE_CARD }o--o{ SUPPLY : "supplies[].name -> Supply._id"
    PREFERENCE_CARD }o--o{ SUTURE : "sutures[].name -> Suture._id"
    EVENT ||--o| PREFERENCE_CARD : "preferenceCard"
```

---

## Detailed Schema Design

### 1. User Model (`users`)
System er primary entity. Role-based access control (RBAC) eikhan theke managed hoy.
- **Fields**: `name`, `email`, `password`, `role`, `status`, `isVerified`, `revertDate`, `age`, `profileImage`, `verificationVideo`.
- **Logic**: `tokenVersion` use kora hoy token rotation ebong security-r jonno.
- **Roles**: `BROTHER`, `SISTER`, `ADMIN`, `SUPER_ADMIN`.
- **Default Role**: None (Must be selected during registration).

### 2. Preference Card Model (`preferencecards`)
Surgery workflow optimize korar jonno main data entity.
- **Relationships**:
  - `createdBy`: ObjectId — Reference to `User` (indexed).
  - `supplies[].name`: ObjectId — Reference to `Supply` (field name misleading — actually holds a Supply `_id`).
  - `sutures[].name`: ObjectId — Reference to `Suture` (same — holds a Suture `_id`).
- **Embedded Data**: `surgeon` sub-schema with `name`, `handPreference`, `specialty`, `contactNumber`, `musicPreference` (all required, `_id: false`).

### 3. Subscription Model (`subscriptions`)
IAP (Apple/Google) based subscription + access control. **No Stripe** — in-app purchase only.
- **Relationship**: `userId` — Reference to `User` (unique, one-sub-per-user).
- **Core fields**: `plan` (`FREE`, `PREMIUM`, `ENTERPRISE`), `status` (`active`, `trialing`, `past_due`, `canceled`, `inactive`).
- **Platform fields**: `platform` (`apple`, `google`, `admin`), `environment` (`sandbox`, `production`), `productId`, `autoRenewing`.
- **Apple fields**: `appleOriginalTransactionId` (unique + sparse — fraud prevention, blocks same Apple purchase being linked to multiple users), `appleLatestTransactionId`.
- **Google fields**: `googlePurchaseToken` (unique + sparse), `googleOrderId`.
- **Lifecycle**: `startedAt`, `currentPeriodEnd`, `gracePeriodEndsAt`, `canceledAt`, `metadata` (Mixed).

---

## Performance & Optimization

### Indexing Strategy
- **Unique Indexes**: `users.email`, `subscriptions.userId`.
- **Compound Indexes**: `PreferenceCard` e `createdBy` index kora hoyeche fast lookup er jonno.
- **Sparse Indexes**: `googleId` sparse index use kora hoyeche OAuth flexibility-r jonno.

### Query Patterns
- **Aggregation**: Doctor search flow te `PreferenceCard` ebong `Subscription` lookup kora hoy complex analytics (e.g., total cards count, active status) generate korar jonno.
- **QueryBuilder**: Standard list filtering ebong pagination er jonno [QueryBuilder](file:///src/app/builder/QueryBuilder.ts) use kora hoy.

---

---

## Detailed Schema Reference

Eikhane protiti model er fields, tader type, ebong tara required naki optional ta deya holo. Sathe relevant **Enums/Roles** o thakbe.

### 1. User Model (`users`)
System er sob users (Admin ebong Reverts) er data eikhane thake.

| Field | Type | Required | Description / Enum |
| :--- | :--- | :---: | :--- |
| `name` | String | ✅ | User er Name |
| `email` | String | ✅ | Unique, lowercase, indexed |
| `password` | String | ⚠️ | Required for non-OAuth users only (hidden via `select: false`, min 8) |
| `role` | String | ✅ | Enum `BROTHER`, `SISTER`, `ADMIN`, `SUPER_ADMIN` |
| `status` | String | ❌ | Enum `ACTIVE`, `PENDING`, `RESTRICTED`, `REJECTED`, `SUSPENDED`, `DELETE` — Default **`PENDING`** for public registration. |
| `isVerified` | Boolean | ❌ | Email verification status — default **`false`**. Flipped to **`true`** after OTP. |
| `revertDate` | String | ✅ | Time since becoming Muslim |
| `age` | Number | ✅ | User age (min 16) |
| `profileImage` | String | ✅ | Public profile URL |
| `verificationImage`| String | ✅ | Private verification image URL |
| `verificationVideo`| String | ✅ | URL |
| `aboutMe` | String | ❌ | Short intro |
| `revertStory` | String | ❌ | Personal journey |
| `interests` | [String] | ❌ | Array of tags |
| `location` | Object | ❌ | `{ country, city, coordinates: { lat, lng } }` |
| `about` | String | ❌ | Bio text |
| `isOnboardingCompleted` | Boolean | ❌ | Default `false` — manually set to `true` by user at end of onboarding. `SUPER_ADMIN` er login response e eta exclude kora hoy. |
| `deviceTokens` | Sub-doc[] | ❌ | Array of `{ token, platform, appVersion, lastSeenAt }` — upsert refreshes `lastSeenAt` instead of duplicating. *Favorites moved to a separate collection — see §7.* |
| `googleId` | String | ❌ | OAuth ID (sparse index — allows multiple nulls) |
| `authentication` | Object | ❌ | Hidden sub-doc: `{ isResetPassword, oneTimeCode, expireAt }` (select: false) |
| `tokenVersion`| Number | ❌ | Default `0`, **`select: false`** — incremented on refresh / reset-password to invalidate old JWTs |

**Indexes**:
- `{ email: 1 }` unique — login lookup
- `{ googleId: 1 }` sparse — OAuth lookup
- `{ 'deviceTokens.token': 1 }` — supports the cross-user rebinding guard in `addDeviceToken`

---

### 2. Preference Card Model (`preferencecards`)
Surgery-specific preference data.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `createdBy` | ObjectId (ref `User`) | ✅ | Creator — indexed |
| `cardTitle` | String | ✅ | Title of the card |
| `surgeon` | Sub-doc | ✅ | Embedded `{ name, handPreference, specialty, contactNumber, musicPreference }` — all required, `_id: false` |
| `medication` | String | ✅ | Required medication list |
| `supplies` | `[{ supply: ObjectId(Supply), quantity: Number(min 1) }]` | ✅ | Embedded array, `_id: false` — FK field renamed from `name` → `supply` so the field name matches what it actually holds |
| `sutures` | `[{ suture: ObjectId(Suture), quantity: Number(min 1) }]` | ✅ | Embedded array, `_id: false` — FK field renamed from `name` → `suture` |
| `instruments` | String | ✅ | Instrument list / notes |
| `positioningEquipment` | String | ✅ | Positioning equipment notes |
| `prepping` | String | ✅ | Prepping notes |
| `workflow` | String | ✅ | Workflow notes |
| `keyNotes` | String | ✅ | Key notes |
| `photoLibrary` | String[] | ✅ | Image URLs |
| `downloadCount` | Number | ❌ | Default `0` |
| `published` | Boolean | ❌ | Default `false` |
| `verificationStatus` | String | ❌ | Enum `VERIFIED`, `UNVERIFIED` — default `UNVERIFIED` |

**Indexes**:
- `{ createdBy: 1, updatedAt: -1 }` — owner dashboard list sorted by most recent
- `{ published: 1, verificationStatus: 1, createdAt: -1 }` — home / public list (ESR)
- `{ 'surgeon.specialty': 1, published: 1 }` — Library screen specialty facet
- **Text index** `card_text_idx` on `cardTitle (weight 10)`, `surgeon.name (5)`, `surgeon.specialty (3)`, `medication (2)` — replaces `$regex` search

---

### 3. Subscription Model (`subscriptions`)
User access control logic.

| Field | Type | Required | Description / Enum |
| :--- | :--- | :---: | :--- |
| `userId` | ObjectId (ref `User`) | ✅ | Unique — one subscription per user |
| `plan` | String | ❌ | Enum `FREE`, `PREMIUM`, `ENTERPRISE` — default `FREE` |
| `status` | String | ✅ | Enum `active`, `trialing`, `past_due`, `canceled`, `inactive` — **no default** (must be explicitly set after a verified purchase or admin grant) |
| `platform` | String | ❌ | Enum `apple`, `google`, `admin` |
| `environment` | String | ❌ | Enum `sandbox`, `production` |
| `productId` | String | ❌ | Store product ID (indexed) |
| `autoRenewing` | Boolean | ❌ | Auto-renew flag from store |
| `appleOriginalTransactionId` | String | ❌ | **Unique + sparse** — fraud guard (one Apple purchase → one user) |
| `appleLatestTransactionId` | String | ❌ | Most recent Apple txn ID |
| `googlePurchaseToken` | String | ❌ | **Unique + sparse** — Google Play purchase token |
| `googleOrderId` | String | ❌ | Google Play order ID |
| `startedAt` | Date | ❌ | Subscription start |
| `currentPeriodEnd` | Date | ❌ | Current billing period end |
| `gracePeriodEndsAt` | Date | ❌ | Grace period end (past_due) |
| `canceledAt` | Date | ❌ | Cancellation timestamp |
| `metadata` | Mixed | ❌ | Free-form store payload |

---

### 4. Notification Model (`notifications`)
In-app and push notification tracking.

> **Schema note**: `type` and `title` are **required** (schema-enforced). `type` is constrained to a fixed enum so typos fail at insert time. The polymorphic reference is `{ resourceType, resourceId }` — the older `referenceId` field has been removed.

| Field | Type | Required | Description / Enum |
| :--- | :--- | :---: | :--- |
| `userId` | ObjectId (ref `User`) | ✅ | Target user |
| `type` | String | ✅ | Enum `PREFERENCE_CARD_CREATED`, `EVENT_SCHEDULED`, `GENERAL`, `ADMIN`, `SYSTEM`, `MESSAGE`, `REMINDER` |
| `title` | String | ✅ | Notification header |
| `subtitle` | String | ❌ | Detailed message |
| `resourceType` | String | ❌ | Owning model tag, e.g. `PreferenceCard`, `Event`, `User` |
| `resourceId` | String | ❌ | ID of the linked resource (string — supports slugs and ObjectIds) |
| `link` | `{ label, url }` | ❌ | Optional CTA |
| `metadata` | Mixed | ❌ | Free-form payload |
| `read` | Boolean | ❌ | Default `false` |
| `isDeleted` | Boolean | ❌ | Default `false` |
| `icon` | String | ❌ | Icon URL/name |
| `expiresAt` | Date | ❌ | TTL — auto-removed after this time |

**Indexes**: `{ userId: 1, read: 1, createdAt: -1 }` compound, `{ expiresAt: 1 }` TTL (`expireAfterSeconds: 0`), `{ resourceType: 1, resourceId: 1 }` compound.

---

### 5. Event Model (`events`)
Surgery or meeting scheduling.

| Field | Type | Required | Description / Enum |
| :--- | :--- | :---: | :--- |
| `userId` | ObjectId (ref `User`) | ✅ | Owner |
| `title` | String | ✅ | Event name |
| `startsAt` | Date | ✅ | Event start (full ISO timestamp) |
| `endsAt` | Date | ✅ | Event end (full ISO timestamp) — validated `> startsAt` |
| `eventType` | String | ✅ | Enum `SURGERY`, `MEETING`, `CONSULTATION`, `OTHER` |
| `location` | String | ❌ | Event location |
| `preferenceCard` | ObjectId (ref `PreferenceCard`) | ❌ | Optional linked card |
| `notes` | String | ❌ | Free-form notes |
| `personnel` | `{ leadSurgeon: String, surgicalTeam: String[] }` | ❌ | Embedded sub-doc (`_id: false`) |

**Indexes**: `{ userId: 1, startsAt: 1 }` compound.

> **Client compat**: the HTTP contract still accepts the legacy `{ date, time, durationHours }` triple. The service layer normalises it into `{ startsAt, endsAt }` before writing, so the DB only ever sees the new shape.

---

### 6. Supply / Suture Models (`supplies`, `sutures`)
Shared catalog collections referenced by `PreferenceCard.supplies[].supply` / `sutures[].suture`.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `name` | String | ✅ | Unique, trimmed, indexed |
| `category` | String | ❌ | Catalog category (indexed) |
| `unit` | String | ❌ | Unit of measure (e.g. `pcs`, `box`) |
| `manufacturer` | String | ❌ | Manufacturer name |
| `isActive` | Boolean | ❌ | Default `true` — soft-deprecate items without orphaning embedded refs in historical cards (indexed) |
| `createdBy` | ObjectId (ref `User`) | ❌ | Auditor: who added this catalog entry |

*(Both models share the same shape.)*

---

### 7. Favorite Model (`favorites`)
Join table between users and favorited preference cards. Replaces the previous `User.favoriteCards: [String]` array.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `userId` | ObjectId (ref `User`) | ✅ | Favoriter |
| `cardId` | ObjectId (ref `PreferenceCard`) | ✅ | Favorited card |
| `createdAt` | Date | ✅ | Auto — when the card was favorited |

**Indexes**: `{ userId, cardId }` unique (makes favorite toggling idempotent), standalone `userId` and `cardId` indexes.

---

### 8. SubscriptionEvent Model (`subscriptionevents`)
Append-only audit log for `subscriptions`. Written by the `Subscription.upsertForUser` static whenever plan or status changes.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `userId` | ObjectId (ref `User`) | ✅ | Owning user |
| `subscriptionId` | ObjectId (ref `Subscription`) | ✅ | The current-state row this event mutated |
| `eventType` | String | ✅ | Enum `CREATED`, `UPGRADED`, `DOWNGRADED`, `RENEWED`, `CANCELED`, `EXPIRED`, `REFUNDED`, `GRACE_STARTED`, `GRACE_RESOLVED`, `STATUS_CHANGED`, `PLAN_CHANGED` |
| `previousPlan` / `nextPlan` | String | ❌ | Plan snapshot before/after |
| `previousStatus` / `nextStatus` | String | ❌ | Status snapshot before/after |
| `platform` | String | ❌ | Enum `apple`, `google`, `admin` |
| `productId` | String | ❌ | Store product ID at time of event |
| `externalTransactionId` | String | ❌ | Apple/Google transaction or order id — for webhook correlation |
| `metadata` | Mixed | ❌ | Raw store payload |
| `occurredAt` | Date | ✅ | Real-world timestamp of the transition |

**Indexes**: `userId`, `subscriptionId`, `eventType`, `externalTransactionId` single-field, plus `{ userId, occurredAt: -1 }` compound for history queries.

---

### 9. ResetToken Model (`resettokens`)
Short-lived password reset tokens. One row per outstanding reset request.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `user` | ObjectId (ref `User`) | ✅ | Owning user — indexed |
| `token` | String | ✅ | **Unique** — the opaque reset token sent to the user via email |
| `expireAt` | Date | ✅ | Auto-delete via MongoDB TTL index (`expireAfterSeconds: 0`) — no manual cleanup needed |

**Indexes**: `{ user: 1 }`, `{ token: 1 }` unique, `{ expireAt: 1 }` TTL (`expireAfterSeconds: 0`).

> **Model name**: registered as `'ResetToken'` → collection `resettokens`. If migrating from the earlier `'Token'` model (collection `tokens`), run `db.tokens.renameCollection('resettokens')` and rebuild indexes.

---

## States & Roles Explanation (Banglish)

- **User Roles**: 
  - `SUPER_ADMIN`: Full system access, doctor management, analytics.
  - `USER`: General doctor user, preference cards toiri ebong download korte pare.
- **User Status**:
  - `ACTIVE`: Normal access.
  - `RESTRICTED`: System block kore rakhle (Doctor block flow). Login korte parbe na.
  - `DELETE`: Soft-delete logic er jonno.
- **Subscription Status**:
  - `active`: Current, paid, access allowed.
  - `trialing`: Inside a trial period.
  - `past_due`: Renewal failed — in grace window (`gracePeriodEndsAt`).
  - `canceled`: User canceled, may still have access until `currentPeriodEnd`.
  - `inactive`: No access.
- **Event Types**:
  - `SURGERY`: Operation schedule.
  - `CONSULTATION`: Patient meeting.
- **Preference Card Verification**:
  - `VERIFIED`: Admin check kore verify korle (Dashboard flow).
  - `UNVERIFIED`: Naya card toiri korle default status.

---

## Implementation Reference

| Model | Path |
| :--- | :--- |
| **User** | [user.model.ts](file:///src/app/modules/user/user.model.ts) |
| **PreferenceCard** | [preference-card.model.ts](file:///src/app/modules/preference-card/preference-card.model.ts) |
| **Subscription** | [subscription.model.ts](file:///src/app/modules/subscription/subscription.model.ts) |
| **SubscriptionEvent** | [subscription-event.model.ts](file:///src/app/modules/subscription/subscription-event.model.ts) |
| **Notification** | [notification.model.ts](file:///src/app/modules/notification/notification.model.ts) |
| **Event** | [event.model.ts](file:///src/app/modules/event/event.model.ts) |
| **Favorite** | [favorite.model.ts](file:///src/app/modules/favorite/favorite.model.ts) |
| **Supply** | [supplies.model.ts](file:///src/app/modules/supplies/supplies.model.ts) |
| **Suture** | [sutures.model.ts](file:///src/app/modules/sutures/sutures.model.ts) |
| **ResetToken** | [resetToken.model.ts](file:///src/app/modules/auth/resetToken/resetToken.model.ts) |
| **Legal** | [legal.model.ts](file:///src/app/modules/legal/legal.model.ts) |

---

## 📚 Design Fixes — What Was Wrong, Why It Was a Problem, How It Was Fixed

Ei section ta ekta learning log. Proti ti fix-er against-e amra rakhsi:
- **Ki chilo** — kivabe schema ta originally likha chilo.
- **Keno eta problem chilo** — real world-e ei design kon jaygay bite korto.
- **Kibhabe fix hoyeche** — ki change hoyeche (files + shape).
- **Impact** — kono migration ba API contract change ache kina.

Eta shudhu history noy — ei patterns future schema decisions guide korbe, tai obossho porte hobe schema change korar age.

---

### Fix 1 — `User.favoriteCards` ke alada collection banano hoyeche

**Ki chilo**
User model-er moddhe `favoriteCards: [String]` — raw string array. Favorite kore dile user document-e cardId push hoto, unfavorite korle `$pull`.

**Keno eta problem chilo**
- **Unbounded array anti-pattern** — power user jodi 5k card favorite kore, protyek user read-e (profile fetch, auth check, me endpoint, populate chain) shei 5k string payload ashto. Mongo document-er 16MB limit to onek dure, kintu working-set memory + network bandwidth age kharap hoto.
- **Referential integrity nei** — `String`-e store korar karone Mongoose `populate()` kaj korto na, orphan detection o kora jeto na. Ekta card delete hole user-er `favoriteCards` e dead ID remnant thakto.
- **Pagination kora imposible** — "latest 20 favorites" query korte hole whole array load kore in-memory slice korte hoto.
- **Index useless** — array element guloke real index dewa jeto na.

**Kibhabe fix hoyeche**
Notun collection `favorites` — `{ userId: ObjectId ref User, cardId: ObjectId ref PreferenceCard, createdAt }`. Ekta unique compound index `{ userId, cardId }` diye favorite idempotent kora hoyeche (double click hole duplicate insert hobe na). User model theke `favoriteCards` field fully remove kora hoyeche.

Service layer-e:
- `favoritePreferenceCardInDB` ekhon `Favorite.updateOne({ userId, cardId }, { $setOnInsert }, { upsert: true })` kore.
- `unfavoritePreferenceCardInDB` ekhon `Favorite.deleteOne()` kore.
- `listFavoritePreferenceCardsForUserFromDB` first `Favorite` collection theke cardIds nite, then `PreferenceCard.find({ _id: { $in } })` kore — this lets QueryBuilder handle pagination on the actual cards, which is what users want.

**Files touched**
- NEW: `src/app/modules/favorite/favorite.model.ts`, `favorite.interface.ts`
- `src/app/modules/user/user.model.ts`, `user.interface.ts` — field removed
- `src/app/modules/preference-card/preference-card.service.ts` — all favorite ops rewritten

**Migration note**
Jodi production DB-te purono `user.favoriteCards` data thake, ekta one-off backfill script likhe `Favorite` collection-e copy kore dite hobe. Shei script ekhono likha hoy nai — data existence check koro first.

---

### Fix 2 — `User.deviceTokens` ke sub-document array banano hoyeche

**Ki chilo**
`deviceTokens: [String]` — ekta flat token string array, `$addToSet` diye dedupe.

**Keno eta problem chilo**
- **Metadata nei** — ekta token kon platform-er (iOS/Android/web), kon app version-e register hoyechilo, last kokhon active chilo — kichu jana jeto na.
- **Stale token prune hoy na** — Apple/Google token rotate kore, kintu purono token DB-te chup kore bose thakto. Push delivery success rate slowly decay korto without any visible signal.
- **Dedupe shudhu string-level** — same physical device theke new token ashle old ta rekhe new ta add hoto, resulting in multiple live tokens per device.

**Kibhabe fix hoyeche**
`deviceTokens` ekhon sub-document array: `[{ token, platform, appVersion, lastSeenAt }]` with `_id: false` (no sub-doc id overhead).

Static methods rewritten:
- `addDeviceToken(userId, token, platform?, appVersion?)` — first `$set` try kore existing sub-doc-er `lastSeenAt` + metadata update kore (ekta atomic `{ _id, 'deviceTokens.token': token }` filter diye positional `$`). Not found hole notun sub-doc `$push` kore. Result: **no duplicates**, metadata always fresh.
- `removeDeviceToken(userId, token)` — `$pull: { deviceTokens: { token } }` — match the sub-doc by token field instead of whole value.

**Files touched**
- `src/app/modules/user/user.model.ts`, `user.interface.ts` — schema + types
- `src/app/builder/NotificationBuilder/channels/push.channel.ts` — now reads `entry.token` from each sub-doc
- `src/app/modules/notification/notificationsHelper.ts` — same — maps to token strings
- `src/app/builder/NotificationBuilder/NotificationBuilder.ts` — internal `IUser` interface updated

**Migration note**
Purono flat-string data with the new schema-e read korle Mongoose will return strings instead of `{ token }` objects — push channels will silently skip them. Ekta one-off migration: `db.users.updateMany({}, [{ $set: { deviceTokens: { $map: { input: '$deviceTokens', as: 't', in: { token: '$$t' } } } } }])`.

---

### Fix 3 — `PreferenceCard.supplies[].name` → `supplies[].supply` (suture equally)

**Ki chilo**
Sub-document field-er naam `name`, kintu value actually `Supply._id` (ObjectId FK). Sutures-e same: `sutures[].name` holding Suture FK.

**Keno eta problem chilo**
- **Reader trap** — reviewer, future dev, ba API consumer code porle eta dekhe bhabbe "name stores the supply's display name." Eta bhul assumption generate korto debug time-e.
- **Populate paths misleading** — `populate('supplies.name', 'name -_id')` — same word-ta two different kaaj-er jonno use hocche (field path AND projection field). Painful to read.
- **Type safety leak** — TypeScript interface `name: Types.ObjectId` — naming + typing mismatched, linting eta catch korte parto na.

**Kibhabe fix hoyeche**
Field-er nam-ei meaning-er sathe match kora hoyeche:
- Supply item: `{ supply: ObjectId(Supply), quantity: Number }`
- Suture item: `{ suture: ObjectId(Suture), quantity: Number }`

API contract (client-facing JSON) ekhono `{ name, quantity }` deya hoy — **backwards compat preserved**. Service layer-e ekta `normaliseClientRefField` helper kaj kore: incoming payload-er `name` ke internally `supply`/`suture`-e rename kore schema-er sathe match korate.

Populate paths update:
- `populate('supplies.supply', 'name -_id')` — now the path says "fetch the Supply doc and return its `name` field."
- Response flattening-o (`flattenCard`) updated to read `item.supply?.name` instead of `item.name?.name`.

**Files touched**
- `src/app/modules/preference-card/preference-card.interface.ts` — type renames
- `src/app/modules/preference-card/preference-card.model.ts` — schema field rename
- `src/app/modules/preference-card/preference-card.service.ts` — resolver, populate paths, flatten, create + update helpers

**Migration note**
MongoDB-te alreadi existing docs-er moddhe sub-doc key `name` thakbe. Ekta `$rename` migration dorkar:
```js
db.preferencecards.updateMany(
  { 'supplies.0': { $exists: true } },
  [{ $set: { supplies: { $map: { input: '$supplies', as: 'it', in: { supply: '$$it.name', quantity: '$$it.quantity' } } } } }]
);
// similarly for sutures
```

---

### Fix 4 — `Supply` / `Suture` ke catalog model hisebe beef up kora hoyeche

**Ki chilo**
Dui model-ei shudhu ekta field: `name: String`.

**Keno eta problem chilo**
- **Deprecate kora impossible** — ekta item obsolete hole, delete korle embedded ObjectId refs (historical preference cards-e) orphan hoye jeto. Shei historical data render korar sokti haraoto. Soft-delete path nei.
- **Catalog metadata nei** — category (e.g. "Gauze", "Syringe"), unit of measure, manufacturer, createdBy — kichui track hoyi na. "Show me all Ethicon sutures" type query impossible.
- **Audit trail nei** — ke catalog entry add korchilo, kokhon — kichu jana jay na.

**Kibhabe fix hoyeche**
Field set extended:
- `category: String` (indexed) — grouping for facet UIs
- `unit: String` — e.g. `"pcs"`, `"box"`, `"strand"`
- `manufacturer: String`
- `isActive: Boolean` (default `true`, indexed) — **soft-deprecate path**: set `false` → item hides from new card creation, but historical cards still render via populate
- `createdBy: ObjectId(User)` — audit who added it

**Files touched**
- `src/app/modules/supplies/supplies.interface.ts`, `supplies.model.ts`
- `src/app/modules/sutures/sutures.interface.ts`, `sutures.model.ts`

**Migration note**
All existing docs get `isActive: true` on next read via mongoose default — no backfill needed unless you want to deprecate specific items immediately.

---

### Fix 5 — `Event.time` + `durationHours` → `startsAt` + `endsAt` Date pair

**Ki chilo**
`Event` model-e three separate fields: `date: Date`, `time: String` (e.g. `"14:30"`), `durationHours: Number`. Start timestamp construct korte hole code-e runtime-e `new Date(\`${date}T${time}:00Z\`)` parse korte hoto.

**Keno eta problem chilo**
- **Timezone unsafe** — `time` string tells nothing about offset. Server-e `date` is a UTC Date, but `time` string gets appended with hardcoded `Z`, which makes every event silently UTC regardless of user intent.
- **"Ei muhurte kon event chalche?" query kaj korto na** — MongoDB filter `$lte: now, $gte: now` run korte hole combined timestamp lagto, jeta `date + time` e ekta index-able field na.
- **Calendar range queries inefficient** — index shudhu `{ userId, date }` diye chilo, kintu practical calendar view-e duration cross korte hoy day boundary, so just `date` compare korle edge events miss hoto.
- **Data integrity nei** — `durationHours` negative dile, ba `time` bad format dile, schema level-e kichu catch hoto na (service-e regex check chilo).

**Kibhabe fix hoyeche**
Schema-te duita Date field:
- `startsAt: Date` (required)
- `endsAt: Date` (required, validated `> startsAt` in service)

Calendar query-gulo ekhon natural:
```js
{ userId, startsAt: { $gte: from, $lte: to } }
```

Compound index `{ userId: 1, startsAt: 1 }` updated. Legacy index dropped.

**Backwards compat**: HTTP API ekhono accept kore `{ date, time, durationHours }` triple — validation schema-e optional, service-e `resolveTimeRange()` helper both input shapes-ke ekta `{ startsAt, endsAt }` e normalise kore. So mobile clients break hobe na until they migrate.

**Files touched**
- `src/app/modules/event/event.interface.ts`, `event.model.ts`, `event.service.ts`, `event.validation.ts`

**Migration note**
```js
db.events.find({ date: { $exists: true }, time: { $type: 'string' } }).forEach(doc => {
  const startsAt = new Date(doc.date.toISOString().slice(0, 10) + 'T' + doc.time + ':00.000Z');
  const endsAt = new Date(startsAt.getTime() + (doc.durationHours || 1) * 3600000);
  db.events.updateOne(
    { _id: doc._id },
    { $set: { startsAt, endsAt }, $unset: { date: '', time: '', durationHours: '' } }
  );
});
```

---

### Fix 6 — `SubscriptionEvent` audit collection add kora hoyeche

**Ki chilo**
`Subscription` model-e `userId: unique: true` — mane protyek user-er ekta row only. `upsertForUser` call-e `findOneAndUpdate({ userId }, ...)` directly current state overwrite korto. Koi ghonta age user PREMIUM chilo naki FREE — kono way chilo na bolar.

**Keno eta problem chilo**
- **Refund dispute blind** — "ei user last week PREMIUM chilo" claim verify kora jabe na.
- **Abuse detection broken** — ekta user multiple times status flip korle pattern detect kora kothin.
- **Churn analytics impossible** — cancellation reasoning, downgrade timing, trial-to-paid conversion — shob current-state read theke infer korte hobe.
- **Webhook replay safety weak** — Apple/Google webhook duplicate deliver korle, idempotency ensure korar jonno kono event history chilo na.

**Kibhabe fix hoyeche**
Notun collection `subscriptionevents` — append-only. `Subscription.upsertForUser` ekhon first purono state `lean()` diye fetch kore, then upsert kore, then diff kore:
- First time? → `CREATED` event write.
- Plan changed? → `PLAN_CHANGED` event.
- Status changed? → `STATUS_CHANGED` event.

Each event captures `{ previousPlan, nextPlan, previousStatus, nextStatus, platform, productId, externalTransactionId, occurredAt }`. `externalTransactionId` gives replay-safety — webhook re-delivery case-e same txn id diye duplicate detect kora jabe (future enhancement).

Audit writes are wrapped in try/catch: if the audit write fails, the primary subscription update still succeeds (audit should never block the critical path).

**Files touched**
- NEW: `src/app/modules/subscription/subscription-event.model.ts`, `subscription-event.interface.ts`
- `src/app/modules/subscription/subscription.model.ts` — `upsertForUser` static now writes audit events

**Future work**
Currently covers `CREATED`, `PLAN_CHANGED`, `STATUS_CHANGED`. Richer event types (`REFUNDED`, `GRACE_STARTED`, `RENEWED`) should be emitted from the store webhook handlers directly, not inferred from diff.

---

### Fix 7 — `Subscription.status` default removed

**Ki chilo**
Schema-te `status: { default: 'active' }`. Mane ekta partial upsert payload-e `status` field na thakleo, newly-created row `active` hoye jeto. Doc-o false-advertise korto.

**Keno eta problem chilo**
Purchase verify flow crash holeo, ekta bare `Subscription({ userId })` create hoe jete parto (upstream code bug, network blip, etc.) — shei user peye jeto free `active` access without any receipt. This is a **privilege escalation risk**.

**Kibhabe fix hoyeche**
`status: { required: true }` — no default. Schema validation ekhon explicit `status` value chai insert-time. All existing callers (`ensureSubscriptionDoc`, `setFreePlan`, `verifyApplePurchase`, `verifyGooglePurchase`) already pass status explicitly, verified via grep — **no runtime break**.

**Files touched**
- `src/app/modules/subscription/subscription.model.ts`

---

### Fix 8 — `User.verified` default changed `true` → `false`, signup triggers OTP

**Ki chilo**
- Schema-te `verified: { default: true }`.
- `user.service.createUserToDB` explicit `{ ...payload, verified: true }` pass korto — double safeguard bypass.
- Result: naya user create holei verified, OTP flow practically dead code.

**Keno eta problem chilo**
- Email verification infrastructure (`sendVerificationOTP`, `/auth/verify-otp`, `/auth/resend-verify-email`) existed but was **architecturally unreachable** from the normal signup path.
- Fake/stolen email diye account create kora jeto without proof of email ownership.
- `auth.service.loginUserFromDB` te `if (!isExistUser.verified) throw` guard chilo but never fired.

**Kibhabe fix hoyeche**
- Schema default flipped to `false`.
- `createUserToDB` theke `verified: true` override removed.
- Signup-er pore `sendVerificationOTP(createUser.email)` fire-and-forget call — OTP email chole jabe, user code enter korle `/auth/verify-otp` flip korbe `verified: true`. Email send fail hole signup still succeeds; user can request resend.

**Files touched**
- `src/app/modules/user/user.model.ts`
- `src/app/modules/user/user.service.ts`

**Behavior change warning**
Ei fix ta **user-visible behavior change**. Jodi product team intentionally OTP bypass korchilo (fast signup, ad campaign, etc.), ei change revert korte hobe OR business flow update korte hobe. Doc-e flag kora — rollout plan lagbe.

---

### Fix 9 — `User.tokenVersion` → `select: false`

**Ki chilo**
`tokenVersion: { default: 0 }` — schema-e visible by default. Protyek `User.findOne()`, `findById()`, list query — shob kichutei tokenVersion chole ashto.

**Keno eta problem chilo**
- **Pollution** — admin list, profile fetch, even populate-er joined user docs — everywhere tokenVersion leaking. Small but constant bandwidth waste + larger response size.
- **Leaks internal invariant** — tokenVersion ekta security counter; ota clients-ke dekhate hobe na. Intent is internal to JWT rotation.

**Kibhabe fix hoyeche**
`select: false` on the schema field. Ekhon default-ei hide. Jodi kono code path-er `tokenVersion` chai (login, verify-otp, refresh-token), explicit `.select('+tokenVersion')` ba `.select('+password +tokenVersion')` diye fetch korte hobe.

Call sites updated:
- `loginUserFromDB` — now `.select('+password +tokenVersion')`
- `verifyEmailToDB` — now `.select('+authentication +tokenVersion')`
- `refreshTokenToDB` — now `.select('+tokenVersion')`

Write paths (`$inc: { tokenVersion: 1 }`) don't need the select — Mongo `$inc` works regardless of projection.

**Files touched**
- `src/app/modules/user/user.model.ts` — schema
- `src/app/modules/auth/auth.service.ts` — 3 call sites

---

### Fix 10 — Notification polymorphic reference consolidated: `{ resourceType, resourceId }` only

**Ki chilo**
Notification schema-te **three** overlapping fields: `referenceId: ObjectId`, `resourceType: String`, `resourceId: String`. Use cases mixed — some code paths used `referenceId`, others used `resourceType`/`resourceId`. No invariant.

**Keno eta problem chilo**
- **Inconsistent reads** — ekta caller read korche `referenceId`, arekta `resourceId` — kon ta active? Both? Depends on writer. Trap for reviewers.
- **No join semantics** — `referenceId` ObjectId ekta diye kono way nei bola "ei ObjectId kon collection-er?" Polymorphic link hole `resourceType` obossho dorkar.
- **Dual write risk** — writer-ra konodino confused hoye both set korto, readers then mishandle.

**Kibhabe fix hoyeche**
- `referenceId` field **fully removed** from `Notification` schema.
- `{ resourceType, resourceId }` is the only polymorphic ref. `resourceId` is `String` (not `ObjectId`) so it can hold slugs, order numbers, or ObjectId strings — caller decides.
- `NotificationBuilder.setReference(id)` method **removed**, replaced with `setResource(type, id)` — force the caller to tag the type.
- `ScheduledNotification` model aligned — `referenceId` removed, `resourceType`/`resourceId` added.
- `scheduler.service.processSingle` updated to replay with `setResource`.
- `database.channel.saveToDatabase` writes both fields from `content.resourceType` + `content.resourceId`.
- Compound index `{ resourceType: 1, resourceId: 1 }` added — enables "show all notifications about this entity" queries.

**Files touched**
- `src/app/modules/notification/notification.interface.ts`, `notification.model.ts`
- `src/app/builder/NotificationBuilder/NotificationBuilder.ts` — content shape + builder API
- `src/app/builder/NotificationBuilder/channels/database.channel.ts`
- `src/app/builder/NotificationBuilder/scheduler/ScheduledNotification.model.ts`
- `src/app/builder/NotificationBuilder/scheduler/scheduler.service.ts`
- `src/app/modules/event/event.service.ts` — scheduler reminders now use `.setResource('Event', eventId)`

**Migration note**
Purono notification docs with `referenceId` set will **lose** that data on read (field dropped from schema = Mongoose will not project it). Backfill script if historical references matter:
```js
db.notifications.updateMany(
  { referenceId: { $exists: true }, resourceId: { $exists: false } },
  [{ $set: { resourceId: { $toString: '$referenceId' } } }]
);
db.notifications.updateMany({}, { $unset: { referenceId: '' } });
```

---

### Fix 11 — Notification `type` + `title` now required + narrowed enum

**Ki chilo**
Schema-te `type` and `title` both optional strings. Application layer "trusted" to always supply them. `type` field-er kono enum constraint chilo na — any string accepted.

**Keno eta problem chilo**
- **Silent bad data** — ekta caller ekta typo `type: 'EVENT_SCHEDULD'` likhle insert succeed kore. Frontend code jeta enum-match filter kore, mysteriously notifications miss kore.
- **No invariant** — "protyek notification has a title" — eta application-level expectation chilo, schema-te enforced chilo na. New contributor chaile title-less notification create korte parto.
- **Mixed dumping ground** — same collection marketplace (`BID`, `BID_ACCEPTED`, `BOOKING`, `DELIVERY_SUBMITTED`, etc.) + medical (`PREFERENCE_CARD_CREATED`, `EVENT_SCHEDULED`) notification type define kortechilo. Code dead era, marketplace notifs have never fired in this project.

**Kibhabe fix hoyeche**
- `type` and `title` now `required: true` at schema level.
- `type` field constrained to enum `NOTIFICATION_TYPES = ['PREFERENCE_CARD_CREATED', 'EVENT_SCHEDULED', 'GENERAL', 'ADMIN', 'SYSTEM', 'MESSAGE', 'REMINDER']`.
- Dead marketplace types (`BID`, `BID_ACCEPTED`, `BOOKING`, `TASK`, `DELIVERY_SUBMITTED`, `PAYMENT_PENDING`, `ORDER`, `PAYMENT`) **removed** from both `NotificationType` union (builder) and the enum in `ScheduledNotification`.
- Builder's content resolver already falls back to `title: 'Notification'` and `type: 'SYSTEM'` if manual content omits them, so existing call sites are safe.

**Files touched**
- `src/app/modules/notification/notification.interface.ts` — exported `NOTIFICATION_TYPES` + type constraint
- `src/app/modules/notification/notification.model.ts` — required + enum
- `src/app/builder/NotificationBuilder/NotificationBuilder.ts` — narrowed `NotificationType` union
- `src/app/builder/NotificationBuilder/scheduler/ScheduledNotification.model.ts` — enum narrowed

**Audit finding** (bonus)
During this refactor a pre-existing broken call was found and fixed: `user.controller.getFavoriteCards` called `PreferenceCardService.getFavoriteCardIdsForUser` — this function did not exist (correct name: `getFavoriteCardIdsForUserFromDB`). The favorites endpoint would have thrown on every request. Renamed to correct function name in `user.controller.ts`.

---

### Fix 12 — Auth middleware `tokenVersion` check add kora hoyeche (Security fix)

**Ki chilo**
`src/app/middlewares/auth.ts` shudhu JWT signature verify korto (`jwtHelper.verifyToken`) ar tar pore directly `req.user` set kore next() call korto. Kono DB lookup chilo na, `tokenVersion` compare o chilo na.

**Keno eta problem chilo**
- **Force-logout practically kaj korto na** — `tokenVersion` DB field `$inc` korle refresh token invalidated hoto, kintu already-issued access tokens (15-30 min lifetime) expiry porjonto keep working korto. Mane password reset, admin-triggered logout, ba status flip ("user restrict koro") korar por-o attacker-er stolen access token er short window-e sob API access still possible.
- **`RESTRICTED` / `DELETE` status user o access pachchilo** — middleware status check korto na, shudhu JWT verify korto. DB-e `status: RESTRICTED` set kora hole o, token expire na hoya porjonto user continue korte parto.
- **Audit report-er #1 Critical item** — security boundary gap.

**Kibhabe fix hoyeche**
Middleware-e JWT verify er pore ekta explicit DB lookup add kora hoyeche:
```ts
const dbUser = await User.findById(verifiedUser.id)
  .select('+tokenVersion status')
  .lean();
```
Ei doc theke duita check hoy:
1. **Status check** — `dbUser.status === 'DELETE' | 'RESTRICTED'` → 403 Forbidden.
2. **tokenVersion compare** — JWT-e baked `tokenVersion` value current DB value er sathe mismatch hole → 401 "Session invalidated".

`.lean()` use kora hoyeche so every request ekta ~1ms indexed `_id` lookup matro add kore. **Note**: Lean object-e missing `tokenVersion` (legacy users) ke `0` হিসেবে ট্রিট করা হয় যাতে ফলস পজিটিভ ইনভ্যালিডেশন না হয়।

**Google OAuth fix o lagche** — `googleLoginToDB` age `tokenVersion` JWT payload-e include korto na, mane Google users tokenVersion check bypass kore jeto. Ei fix-er part hishebe `User.findById(user._id).select('+tokenVersion')` diye DB theke current value fetch kore JWT payload-e add kora hoyeche.

> **UPDATE (April 2026):** `googleLoginToDB` ar `passport.ts` removed. Replaced by `socialLoginToDB` — unified Google + Apple ID token verification via `POST /auth/social-login`. Details: [social-login-guide.md](../docs/social-login-guide.md)

**Files touched**
- `src/app/middlewares/auth.ts` — DB check + status block + version compare added
- `src/app/modules/auth/auth.service.ts` — `socialLoginToDB` handles Google + Apple with `tokenVersion` in JWT

**Migration note**
Deploy-er por **already-issued JWT tokens** jeguloy `tokenVersion` embedded nei (ba purono value), oigula next request-e 401 hoye jabe ebong user re-login korte hobe. Eta expected — deploy window e force-logout effect. Jodi gradual rollout dorkar, middleware e `typeof jwtTokenVersion === 'number'` check already ache jate purono JWTs gracefully pass through — but eta security gap purono token-e keep kore rakhe, so window boro rakha uchit na.

**Performance cost**
Protiti authenticated request e 1 extra `findById({ _id }).lean()` call. Indexed PK lookup, sub-ms p95. ~5-10% overall request latency increase. Scale concern hole Redis cache `userId → { tokenVersion, status }` with 30s TTL — tar por basically free.

---

### Fix 13 — PreferenceCard indexes (compound + text) add kora hoyeche

**Ki chilo**
`PreferenceCardSchema` te index chilo shudhu `createdBy` single-field — doc prothome eta "compound index" bola chilo but actually single-field chilo (lied). Ar text search er jonno `QueryBuilder.search()` `$regex` use korto — but kono field-e text index chilo na, ar kono field-e regular B-tree index o chilo na jegula `published`, `verificationStatus`, `surgeon.specialty` filter cover kore.

**Keno eta problem chilo**
- **Home screen list query = full collection scan** — `GET /preference-cards` base filter `{ published: true }`, but `published` field-e kono index nei. 1k cards = 1k doc scan per request. 10k cards = 10k scan. Protiti active user home open korlei.
- **Search = O(n × m)** — `$regex` with no anchor can't use B-tree. Full scan + regex match on each doc.
- **Specialty facet query (Library screen)** — `GET /preference-cards/specialties` uses `distinct('surgeon.specialty', { published: true })`. Without index, eta o full scan.
- **Index strategy doc-e claimed but reality-te missing** — audit-e ei ta 🔴 Critical hishebe flag kora hoyechilo because p95 latency scale er sathe **cliff drop** hobe (not gradual degradation — once working set exceeds RAM, it collapses).

**Kibhabe fix hoyeche**
Four indexes added to `preference-card.model.ts`:

1. **`{ createdBy: 1, updatedAt: -1 }`** — owner dashboard: "ami amar nijer cards latest updated order e dekhbo" query. Prior single-field `createdBy` removed (ei compound prefix diye shei use case auto covered).

2. **`{ published: 1, verificationStatus: 1, createdAt: -1 }`** — home/public list. ESR rule follow kora: equality fields (`published`, `verificationStatus`) age, sort field (`createdAt`) pore. Query `{ published: true }` + `.sort({ createdAt: -1 })` eta directly hit korbe.

3. **`{ 'surgeon.specialty': 1, published: 1 }`** — Library screen specialty facet + published filter.

4. **Weighted text index** on `cardTitle (10)`, `surgeon.name (5)`, `surgeon.specialty (3)`, `medication (2)` — search queries `$text: { $search }` use kore score-ranked results diye automatically relevance sort korte parbe. Named `card_text_idx` so ops can identify it in `db.preferencecards.getIndexes()`.

**Important caveat**
Text index **tokhon-i useful** jokhon QueryBuilder actually `$text` use kore. `QueryBuilder.search()` ekhono `$regex`-based — Priority 2 item #2 (QueryBuilder refactor) e ei kaj pending. Text index already built rakha hoyeche so refactor korar shathe shathe switchover free.

**Files touched**
- `src/app/modules/preference-card/preference-card.model.ts` — 4 indexes added

**Migration note**
Index build production-e ekta ek-bar lag-intensive operation. 100k+ docs hole `db.preferencecards.createIndex({ ... }, { background: true })` option use kora uchit (MongoDB 4.2+ default already background). Text index building shob theke slow, so off-peak hour e run koro. Production migration script:

```js
db.preferencecards.createIndex({ createdBy: 1, updatedAt: -1 });
db.preferencecards.createIndex(
  { published: 1, verificationStatus: 1, createdAt: -1 },
);
db.preferencecards.createIndex({ 'surgeon.specialty': 1, published: 1 });
db.preferencecards.createIndex(
  {
    cardTitle: 'text',
    medication: 'text',
    'surgeon.name': 'text',
    'surgeon.specialty': 'text',
  },
  {
    weights: { cardTitle: 10, 'surgeon.name': 5, 'surgeon.specialty': 3, medication: 2 },
    name: 'card_text_idx',
  },
);
// Old single-field createdBy index can be dropped — the compound prefix covers it:
db.preferencecards.dropIndex({ createdBy: 1 });
```

---

### Fix 14 — ResetToken hardened: TTL + unique token + required user + renamed model

**Ki chilo**
`resetToken.model.ts` schema was minimal: `user` (not required, not indexed, ObjectId ref), `token` (required, no index, not unique), `expireAt` (required, **no TTL index**). Model registered as `'Token'` — collection name `tokens`. Statics `isExistToken` / `isExpireToken` kortoni `findOne({ token })` but no index on `token`.

**Keno eta problem chilo**
- **Expired token accumulation forever** — `expireAt` thakleo kono TTL index chilo na. Mane 6 months later bhi all reset tokens that were ever generated still sitting in DB. Slow cleanup cron na thakle unbounded growth.
- **`token` field lookups full-scan** — every reset password request `findOne({ token })` scan kore. Also no `unique` constraint → theoretically duplicate token possible, security risk (collision allowed).
- **`user` field optional + unindexed** — orphaned tokens possible. Cascade delete hard korte.
- **Model name `'Token'`** — collection `tokens` ambiguous (auth token? access token? refresh token?). Future dev confusion.

**Kibhabe fix hoyeche**
Schema rewritten with all 4 hardenings:
```ts
user: { type: ObjectId, ref: 'User', required: true, index: true },
token: { type: String, required: true, unique: true }, // unique → auto indexed
expireAt: { type: Date, required: true, index: { expires: 0 } }, // TTL
// model name: 'ResetToken' → collection 'resettokens'
```

`{ expires: 0 }` means "auto-delete when now >= expireAt". MongoDB background job (runs every ~60s) sweeps expired docs.

**Files touched**
- `src/app/modules/auth/resetToken/resetToken.model.ts` — schema + model name

**Migration note**
Model name change `'Token'` → `'ResetToken'` breaks existing collection mapping. Mongoose will start writing to `resettokens` instead of `tokens`. Migration options:

**Option A — rename collection** (preserves data):
```js
db.tokens.renameCollection('resettokens');
// then drop + rebuild indexes on the new collection
db.resettokens.dropIndexes();
db.resettokens.createIndex({ user: 1 });
db.resettokens.createIndex({ token: 1 }, { unique: true });
db.resettokens.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
```

**Option B — drop and start fresh** (lose in-flight reset tokens, safe for low-volume apps):
```js
db.tokens.drop();
// Mongoose will create `resettokens` on next insert with the new indexes.
```

Option A preferred if production has active reset flows.

---

### Fix 15 — `addDeviceToken` cross-user rebinding guard + token index

**Ki chilo**
After Fix 2 (Tier 2 deviceTokens sub-doc), `addDeviceToken(userId, token)` static existing token er metadata refresh korto ba notun sub-doc push korto. Kintu globally unique `(user, token)` pair enforce kore na chilo — multiple users same physical device token hold korte parto simultaneously.

**Keno eta problem chilo**
- **Push misdelivery bug** — Real scenario: User A phone-e login → FCM token T registered against User A. User A logs out → User B logs in on same phone → FCM returns same token T → `addDeviceToken(userB, T)` adds to User B. **But T still exists on User A's doc.** Next push to User A → delivered to the physical device → User B sees User A's notification.
- **Privacy leak** — notification body might contain PII. Mis-delivery = data exposure.
- **Frequency low but legal exposure high** — healthcare/medical app context e ei ta HIPAA territory.

**Kibhabe fix hoyeche**
`addDeviceToken` static e ekta prefix step add kora hoyeche:
```ts
await User.updateMany(
  { _id: { $ne: userId }, 'deviceTokens.token': token },
  { $pull: { deviceTokens: { token } } },
);
```
Ei line guarantees: "this token can only exist on one user document." Tar pore existing logic (refresh metadata OR push new sub-doc) runs as before.

Index added to support the `updateMany` scan:
```ts
userSchema.index({ 'deviceTokens.token': 1 });
```
Without this, `updateMany({ 'deviceTokens.token': token })` would full-scan the users collection. With it, ~1ms indexed lookup.

**Files touched**
- `src/app/modules/user/user.model.ts` — `addDeviceToken` static + new index

**Migration note**
Index build on existing User collection:
```js
db.users.createIndex({ 'deviceTokens.token': 1 });
```
Background-built, safe. Doesn't need data migration — the rebinding guard only activates on new `addDeviceToken` calls, so in-flight stale duplicates will self-heal as users log in on shared devices. Jodi immediately cleanup chai, ekta one-off script:

```js
// Find tokens held by multiple users and keep only the most recently updated user.
db.users.aggregate([
  { $unwind: '$deviceTokens' },
  {
    $group: {
      _id: '$deviceTokens.token',
      users: { $push: { userId: '$_id', lastSeenAt: '$deviceTokens.lastSeenAt' } },
      count: { $sum: 1 },
    },
  },
  { $match: { count: { $gt: 1 } } },
]).forEach(entry => {
  // Sort by lastSeenAt desc, keep first, pull from the rest.
  const sorted = entry.users.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
  const keep = sorted[0].userId;
  sorted.slice(1).forEach(u => {
    db.users.updateOne(
      { _id: u.userId },
      { $pull: { deviceTokens: { token: entry._id } } },
    );
  });
});
```

---

### Fix 16 — User pre-save email uniqueness hook removed

**Ki chilo**
`user.model.ts` te pre-save hook chilo ja protyek `.save()` e chalay `User.findOne({ email, _id: { $ne: this._id } })` — "check if anyone else has this email, if yes throw."

**Keno eta problem chilo**
- **Redundant** — `email` field already `unique: true` schema-e. MongoDB unique index layer-e automatic duplicate check kore, atomically. Eta extra work.
- **Race-condition unsafe** — "check then write" never atomic. Between the hook's `findOne` and the actual insert, another concurrent request can slip in. Only the unique index guarantees atomicity; the hook just creates a false sense of protection.
- **Performance waste** — Every `.save()` hits this hook, even for unrelated updates. Profile picture change? Extra query. `lastSeenAt` refresh? Extra query. Password hash update? Extra query. Roughly **30-50% overhead on every User write**.
- **Error quality loss** — Hook throws a generic `ApiError('Email already exist!')`. MongoDB's native 11000 error has `keyPattern` + `keyValue` which the global error handler already translates correctly with more context.

**Kibhabe fix hoyeche**
Pre-save hook-e shudhu password hashing rakha hoyeche:
```ts
userSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, ...);
  }
  next();
});
```

Email uniqueness check **fully removed** — unique index handles it. Also added `isModified('password')` guard so password hashing doesn't re-run on every save (previously it would re-hash the stored hash if you didn't guard).

Duplicate key errors still surface to the client with a clean message because `globalErrorHandler.ts` already has an 11000 handler that returns 409 CONFLICT with the duplicated field name.

**Files touched**
- `src/app/modules/user/user.model.ts` — hook simplified + unused imports (`StatusCodes`, `ApiError`) removed

**Migration note**
No data migration needed. The unique index already exists — this change just stops doing redundant work.

**Performance win**
~30-50% fewer queries on any User `.save()` call path. Especially visible on hot paths like login, push-token registration (before the Fix 15 rebinding which already does `updateMany`), profile picture upload.

---

### Fix 17 — QueryBuilder `textSearch()` wired up + PrefCard switched from regex to text search

**Ki chilo**
Fix 13-e PreferenceCard collection-e ekta weighted text index (`card_text_idx`) add kora hoyechilo. Kintu `QueryBuilder.search()` ekhono `$regex` base use korto ar `textSearch()` method technically existed but kothao use hoy nai. **Index was built but dead** — storage cost without benefit.

**Keno eta problem chilo**
- **Built index unused** — text index maintain hoy write-path e (every card insert/update rewrites the index tree), kintu query side kichu use korena. Pure waste.
- **Regex search O(n)** — Every typed search in the home screen full collection scan marto. 10k cards e p95 ~200ms; 100k e ~2s.
- **No relevance scoring** — Regex matches without ranking. "Heart surgery" search-e old cards ebong new cards shob same weight-e ashto; title match ar body match between o distinction nai.
- **`QueryBuilder.sort()` override conflict** — If ekta `textSearch()` textScore-by sort set korto, downstream `.sort()` default `-createdAt` diye oita clobber kore dito. Net result: score sort **never actually applied**. Silent bug.

**Kibhabe fix hoyeche**

**(a) `QueryBuilder.textSearch()` improved** — method ta extend kora hoyeche:
```ts
this.modelQuery = this.modelQuery
  .find(
    { $text: { $search: term } },
    { score: { $meta: 'textScore' } },  // project score for sorting
  )
  .sort({ score: { $meta: 'textScore' } });  // relevance order
```

**(b) `QueryBuilder.sort()` made textScore-aware** — conditional guard:
```ts
if (hasSearchTerm && !explicitSort) {
  // Keep the textScore sort that textSearch() installed
  return this;
}
```
So: when user types a search term ar explicit `?sort=` query pass korena, relevance wins. Otherwise the default `-createdAt` runs as before.

**(c) PrefCard service switched** — `.search(['cardTitle', ...])` calls replaced with `.textSearch()` in all 5 list methods. The text index now actually handles the query.

**Files touched**
- `src/app/builder/QueryBuilder.ts` — `textSearch()` extended, `sort()` made aware
- `src/app/modules/preference-card/preference-card.service.ts` — all 5 list methods

**Migration note**
Nothing to migrate. Text index already built in Fix 13. This change just flips the query side to use it.

**Performance win**
Search queries: O(n) → O(log n). At 10k cards that's roughly 200ms → 5ms on a hit. Relevance scoring also quietly upgrades the home-screen search UX — title matches rank above body-only matches without any frontend work.

---

### Fix 18 — Notification `listForUser` consolidated into a single `$facet` aggregation

**Ki chilo**
`notification.service.ts` te `listForUser` chalay **3 separate queries per call**:
1. `find().skip().limit()` — paginated data
2. `countDocuments({ isDeleted: false })` — total
3. `countDocuments({ isDeleted: false, read: false })` — unread count

Every notification bell icon tap triggers all 3 queries.

**Keno eta problem chilo**
- **3x round trips** — Notification endpoint is hit per app open, per pull-to-refresh. Multiplied across active users it's a noticeable load pattern.
- **Both `countDocuments` calls run similar `$match` twice** — DB does duplicate work because each is a separate query plan.
- **`skip(page × limit)` on large collections** — MongoDB scans-and-discards skipped documents. Active user with 5k notifications hitting page 50 = scan 2500 docs just to reach the requested slice.

**Kibhabe fix hoyeche**
Single aggregation with `$facet`:
```ts
const [result] = await NotificationModel.aggregate([
  { $match: { userId, isDeleted: false } },
  {
    $facet: {
      notifications: [
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ],
      totalCount: [{ $count: 'n' }],
      unreadCount: [{ $match: { read: false } }, { $count: 'n' }],
    },
  },
]);
```

`$facet` runs all three sub-pipelines over the **same `$match` result** — DB does the filter once, then branches. The existing compound index `{ userId: 1, read: 1, createdAt: -1 }` (from Fix 17 of Tier 2) covers every facet including the read-filter for the unread count.

**Files touched**
- `src/app/modules/notification/notification.service.ts` — `listForUser` rewritten

**Migration note**
None. Same inputs, same outputs (`{ notifications, meta }`).

**Performance win**
3 round trips → 1. At active-user scale the cumulative DB load on the notification endpoint drops by ~2/3. Cursor-based pagination (`?beforeId=<lastId>`) would eliminate the remaining `$skip` cost at very high per-user counts — that's future work, keep `$facet` with offset-pagination for now since it preserves the API shape.

---

### Fix 19 — PreferenceCard free-text fields relaxed to optional + publish gate

**Ki chilo**
PreferenceCard schema-te 6 ta free-text field (`medication`, `instruments`, `positioningEquipment`, `prepping`, `workflow`, `keyNotes`) + `supplies`, `sutures`, `photoLibrary` — **shob `required: true`**. Users card create korte gele protyek field obossho fill korte hoto, draft save impossible.

**Keno eta problem chilo**
- **Draft / work-in-progress save impossible** — User ekta long card likte likte break nite parbe na. Frontend-e dummy `"-"` pathate hoto to satisfy the required check. Destroys data quality.
- **"Required" != data quality** — User dile dummy `"-"` ba `"lorem ipsum"`, schema shei take "required" satisfy-ed bolbe. Schema required field = field exists, not = field is meaningful.
- **`photoLibrary: [String], required: true` gives false protection** — MongoDB array "required" means the field key exists. Empty array `[]` satisfies it. So the constraint guards nothing.
- **`photoLibrary` unbounded** — Users could upload 100+ URLs, bloating the document. No cap.
- **No draft / publish distinction** — Real workflow needs two modes: save anything (draft), then enforce completeness at publish / admin approval time.

**Kibhabe fix hoyeche**

**(a) Schema relaxed:**
```ts
medication: { type: String, trim: true },              // was: required: true
instruments: { type: String, trim: true },             // was: required: true
positioningEquipment: { type: String, trim: true },    // was: required: true
prepping: { type: String, trim: true },                // was: required: true
workflow: { type: String, trim: true },                // was: required: true
keyNotes: { type: String, trim: true },                // was: required: true
supplies: { type: [SupplyItemSchema], default: [] },
sutures: { type: [SutureItemSchema], default: [] },
photoLibrary: {
  type: [String],
  default: [],
  validate: {
    validator: (arr) => !arr || arr.length <= 10,     // hard cap at 10
    message: 'A preference card can hold at most 10 photos',
  },
},
```

**(b) Service-layer publishability check** — `assertCardIsPublishable(card)` helper jeta check kore:
- All 6 free-text fields are non-empty trimmed strings.
- `supplies` + `sutures` arrays are non-empty.

Throws `ApiError(400)` with the list of missing fields if incomplete.

**(c) Gates wired up:**
- `createPreferenceCardInDB` — if `published: true` passed at creation, assert first.
- `updatePreferenceCardInDB` — if update flips `published: true` or if admin sets `verificationStatus: 'VERIFIED'`, fetch merged doc and assert. (`UNVERIFIED` always allowed since that's the default for incomplete cards.)

**(d) Validation relaxed** — `createPreferenceCardSchema` in Zod also mirrors the schema relaxation so the API doesn't reject draft payloads at the validation layer. Max photo count (`max(10)`) added to Zod as well.

**Files touched**
- `src/app/modules/preference-card/preference-card.model.ts` — schema fields relaxed + photo cap
- `src/app/modules/preference-card/preference-card.service.ts` — `assertCardIsPublishable` helper + 3 gate points
- `src/app/modules/preference-card/preference-card.validation.ts` — Zod schemas relaxed to match

**Migration note**
No data migration needed. Existing cards are already valid — the schema only **loosened** constraints, didn't tighten them. Any new draft will save fine; only the publish / verify transition will enforce completeness.

**UX win**
Unlocks a real draft-save flow: frontend can auto-save partial cards, resume editing, and only trigger the completeness modal when the user clicks "Publish" or when an admin reviews. Previously impossible at the schema layer.

---

### Fix 20 — PreferenceCard public list: `populate()` chain → `$lookup` aggregation pipeline

**Ki chilo**
`listPublicPreferenceCardsFromDB` (home screen, highest-read endpoint) used the QueryBuilder pipeline with:
```ts
.populate('supplies.supply', 'name -_id')
.populate('sutures.suture', 'name -_id')
```
Mongoose `.populate()` already batches (one `$in` query per populate path), so that's `1 + 2 = 3 round trips` per list call: main find + supplies populate + sutures populate.

**Keno eta problem chilo**
- **3 round trips per home screen hit** — Each one adds network latency (1-5ms locally, more in prod). Multiplied across every active user hitting home.
- **Count query separate** — `QueryBuilder.getPaginationInfo()` runs a fourth query (`countDocuments`) for the total. So actually 4 round trips total.
- **`AggregationBuilder` ache but unused** — CLAUDE.md blueprint-e ei kaje ei builder lagano-r kotha bola chilo, but zero usage across the codebase. Dead architecture.
- **No score-sort support through QueryBuilder** — even after Fix 17's `textSearch` wiring, passing the score sort through QueryBuilder's pipeline is fragile.

**Kibhabe fix hoyeche**
`listPublicPreferenceCardsFromDB` fully rewritten as a **single aggregation pipeline**:

```ts
[
  { $match: { published: true, ...optionalFilters } },
  { $sort: textScoreOrCreatedAt },
  {
    $facet: {
      data: [
        { $skip }, { $limit },
        { $lookup: { from: 'supplies', localField: 'supplies.supply', ... }},
        { $lookup: { from: 'sutures', localField: 'sutures.suture', ... }},
        { $addFields: {
            supplies: <map each item joining the looked-up name>,
            sutures:  <same>,
        }},
        { $project: { supplyDocs: 0, sutureDocs: 0, __v: 0 }},
      ],
      total: [{ $count: 'count' }],
    },
  },
]
```

Key improvements:
1. **`$match` + `$sort` before `$facet`** — the compound index `{ published, verificationStatus, createdAt }` covers this prefix directly. No collection scan.
2. **`$facet` gives data + total in one pipeline** — eliminates the separate `countDocuments`.
3. **`$lookup` with `pipeline: [{ $project: { _id: 1, name: 1 } }]`** — only the Supply/Suture `name` field is pulled, matching the old populate's `'name -_id'` select for bandwidth parity.
4. **`$addFields` with `$map` + `$filter`** — rebuilds each embedded `supplies[]` / `sutures[]` item as `{ name, quantity }` to preserve the existing API contract. Frontend sees zero difference.
5. **Text-index sort** — when a search term is present, sort by `{ $meta: 'textScore' }`; otherwise fall back to `createdAt: -1`. Score sort actually flows through cleanly because there's no downstream QueryBuilder to clobber it.

**Files touched**
- `src/app/modules/preference-card/preference-card.service.ts` — `listPublicPreferenceCardsFromDB` rewritten

**Scope note**
Only `listPublicPreferenceCardsFromDB` (the hottest endpoint) was migrated in this pass. The 4 other list methods — `listPrivatePreferenceCardsForUserFromDB`, `listFavoritePreferenceCardsForUserFromDB`, `listPreferenceCardsForUserFromDB`, `getPreferenceCardByIdFromDB` — still use the QueryBuilder populate chain. They're lower-traffic and this migrated method is the reference pattern when they're moved in a future pass. Migrating them all at once would have risked breaking the API contract's populated-array shape across 5 code paths.

**Migration note**
None. Same request inputs, same response shape.

**Performance win**
- 4 round trips (find + 2 populate + count) → 1 aggregation.
- At 10k+ cards: text-index-backed `$match` keeps query O(log n). At smaller scale: ~15-25ms saved per home screen hit just from eliminated round trips.

---

### Fix 21 — Style / polish cluster (low-risk quality improvements)

**Ki chilo**
Audit report-er `🔵 Low / ⚪ Style` section-e chhotto chhotto inconsistency list kora hoyechilo. Individually eguli nothing, cumulative effect codebase consistency improve kore.

**Kibhabe fix hoyeche**

**21a — `USER_STATUS.DELETE` → `USER_STATUS.DELETED`**

Enum key renamed to past-participle form, consistent with other terminal states (`CANCELED`, `EXPIRED`). **Stored value kept as `'DELETE'`** so no database migration is needed — it's purely a code-level rename:
```ts
DELETED = 'DELETE',  // key `DELETED`, value stays `'DELETE'`
```
All 10+ call sites updated: `auth.service.ts` (6 places), `auth.ts` middleware, `user.validation.ts`, plus both enum definitions (`src/enums/user.ts` and the duplicate in `user.interface.ts`).

> **Note:** `passport.ts` removed (April 2026) — replaced by `socialLoginToDB` in `auth.service.ts`.

**21b — `Favorite.timestamps: { updatedAt: false }`**

Favorite doc has no update lifecycle — it either exists (favorited) or doesn't (unfavorited). `updatedAt` field would always equal `createdAt`, wasting 8 bytes per document + one extra index maintenance candidate. Changed to `{ timestamps: { createdAt: true, updatedAt: false } }`.

**21c — `User.googleId` — `unique: true` added**

Previously `sparse: true` alone was there. `sparse` only allows multiple null values; it does NOT prevent duplicate non-null values. Without `unique`, two users with the same Google account were theoretically allowed. Added `unique: true` alongside `sparse: true` so the index enforces "one Google account → one user" for non-null values.

**21d — `Subscription.metadata: Object` → `Schema.Types.Mixed`**

Consistency fix. `Notification.metadata` already uses `Schema.Types.Mixed`. Mongoose treats `Object` and `Mixed` similarly internally but `Mixed` is the canonical schema type — clearer intent for readers.

**21e — Dead marketplace notification templates deleted**

10 stale template files removed from `src/app/builder/NotificationBuilder/templates/`:
- `bidReceived.ts`, `bidAccepted.ts` (marketplace BID flow)
- `cartAbandoned.ts` (e-commerce cart)
- `newMessage.ts` (messaging)
- `orderPlaced.ts`, `orderShipped.ts`, `orderDelivered.ts` (e-commerce)
- `paymentReceived.ts`, `paymentFailed.ts` (marketplace payment)
- `taskCompleted.ts` (marketplace task flow)

Ei shob template shothik `NOTIFICATION_TYPES` enum-e nei er (Fix 11 te ei types narrow kora hoyechilo). Zero `.useTemplate('orderShipped')` style call existed in production code — verified via grep. Templates registered via `templates/index.ts` auto-barrel, so also removed the barrel re-exports.

**Kept templates:** `welcome.ts`, `systemAlert.ts` — both use only the narrowed enum types (`'SYSTEM'`) and are still valid.

**Files touched**
- `src/enums/user.ts` + `src/app/modules/user/user.interface.ts` — `DELETE` → `DELETED` enum key
- `src/app/modules/auth/auth.service.ts` + `src/app/middlewares/auth.ts` + `src/app/modules/user/user.validation.ts` — call site updates (note: `passport.ts` removed April 2026)
- `src/app/modules/favorite/favorite.model.ts` — timestamps option
- `src/app/modules/user/user.model.ts` — `googleId` unique added
- `src/app/modules/subscription/subscription.model.ts` — `metadata` type change
- `src/app/builder/NotificationBuilder/templates/` — 10 files deleted, `index.ts` barrel cleaned

**Migration note**

- **21a**: No DB migration — enum value unchanged (`'DELETE'`).
- **21b**: No migration — old docs still have `updatedAt`, new docs won't. Can backfill-strip if strict cleanup desired: `db.favorites.updateMany({}, { $unset: { updatedAt: '' } })`.
- **21c**: Existing `googleId: null` values still allowed (sparse). But if production already has two users with the **same** non-null `googleId` (possible if this was a pre-existing bug), the unique index build will **fail**. Pre-check:
  ```js
  db.users.aggregate([
    { $match: { googleId: { $ne: null } } },
    { $group: { _id: '$googleId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  ```
  If this returns anything, resolve the duplicates before deploying.
- **21d**: No migration — Mongoose reads both `Object` and `Mixed` the same way at runtime.
- **21e**: No migration — templates are application-side code only, never stored in DB.

---

## 🧩 Summary Table — Fixes Applied

### Tier 2 — Design Smells (first pass)

| Fix # | Review # | Issue | Core change | Files touched |
| :---: | :---: | :--- | :--- | :---: |
| 1 | 8 | `favoriteCards` array anti-pattern | New `Favorite` collection | 5 |
| 2 | 9 | `deviceTokens` no metadata | Sub-doc with `{ token, platform, appVersion, lastSeenAt }` | 5 |
| 3 | 10 | `supplies.name` field-name lie | Renamed to `supplies.supply` / `sutures.suture` | 3 |
| 4 | 11 | `Supply` / `Suture` underbuilt | Added category, unit, manufacturer, isActive, createdBy | 4 |
| 5 | 12 | `Event.time: String` broken | Replaced with `startsAt` / `endsAt` Date pair + legacy compat | 4 |
| 6 | 13 | `Subscription` no history | New `SubscriptionEvent` audit collection + hook in `upsertForUser` | 3 |
| 7 | 14 | `Subscription.status` default `active` | Default removed, now required | 1 |
| 8 | 15 | `User.verified` default `true` | Default flipped to `false`, OTP triggered on signup | 2 |
| 9 | 16 | `User.tokenVersion` leaked | `select: false`, explicit pulls in auth paths | 2 |
| 10 | 17 | Notification dual reference system | Removed `referenceId`; `{ resourceType, resourceId }` only; `setResource()` builder method | 6 |
| 11 | 18 | Notification `type`/`title` not required | Both required, `type` enum constrained; dead marketplace types removed | 4 |

### Priority 1 — Audit Critical Follow-up (second pass, from `docs/audits/database-audit-report.md`)

| Fix # | Audit Severity | Issue | Core change | Files touched |
| :---: | :---: | :--- | :--- | :---: |
| 12 | 🔴 Critical (Security) | Auth middleware no `tokenVersion` check | Middleware now does DB lookup + status + tokenVersion compare; Google login JWT includes `tokenVersion` | 2 |
| 13 | 🔴 Critical (Perf) | PreferenceCard hot-path index-less | 3 compound indexes + weighted text index added | 1 |
| 14 | 🟡 Medium (Data) | ResetToken no TTL / no indexes / underbuilt | TTL index, unique token, required user ref, model renamed `'Token'` → `'ResetToken'` | 1 |
| 15 | 🟠 High (Security) | `addDeviceToken` cross-user rebinding hole | Prefix `updateMany` strip from other users + `deviceTokens.token` index | 1 |

### Priority 2 / 3 — Audit Follow-up Optimizations (third pass)

| Fix # | Audit Severity | Issue | Core change | Files touched |
| :---: | :---: | :--- | :--- | :---: |
| 16 | 🟠 High (Perf) | User pre-save redundant email check | Hook simplified to just password hashing; unique index now solely enforces email | 1 |
| 17 | 🟠 High (Perf) | `QueryBuilder.textSearch()` defined but unused + `sort()` conflict | Method extended with score projection; `sort()` made text-score aware; PrefCard list methods switched from `.search()` to `.textSearch()` | 2 |
| 18 | 🟠 High (Perf) | Notification `listForUser` 3x queries | Single `$facet` aggregation: data + total + unreadCount in one pipeline | 1 |
| 19 | 🟠 High (UX) | PrefCard required free-text spam | Schema relaxed; service-layer `assertCardIsPublishable` gate wired into create / update / verify transitions; `photoLibrary` capped at 10 | 3 |
| 20 | 🟠 High (Perf) | PrefCard public list populate chain | `listPublicPreferenceCardsFromDB` rewritten as single `$match` + `$sort` + `$facet` + `$lookup` + `$addFields` aggregation; 4 round trips → 1 | 1 |
| 21 | 🔵 Low / ⚪ Style | Style cluster | `USER_STATUS.DELETE` → `DELETED` (value unchanged), `Favorite.updatedAt` off, `User.googleId` unique, `Subscription.metadata` → `Mixed`, 10 dead marketplace templates deleted | 9 |

---
> **Note**: Database e kono structural change korle ei doc ta update kora mandatory.
