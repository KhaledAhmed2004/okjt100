# Design Document: Group Module Load Testing

## Overview

This design describes an **in-process load testing suite** for the Group API, built entirely within the existing Vitest + supertest + MongoMemoryReplSet infrastructure. No external tools (k6, Artillery, autocannon) are required. The test file lives at `src/app/modules/group/__tests__/group.load.spec.ts` and is discovered automatically by the existing Vitest glob (`src/**/*.spec.ts`).

### Goals

- Measure baseline latency per endpoint under single-user conditions
- Verify correctness and performance under concurrent read and write load
- Simulate realistic multi-step user journeys
- Detect authorization bypass under concurrent conditions
- Verify data integrity (no race conditions, no over/under-counting)
- Integrate into CI/CD with `SKIP_LOAD_TESTS` and `LOAD_TEST_THRESHOLDS_ENABLED` env vars

### Key Design Decisions

| Decision | Rationale |
|---|---|
| In-process via `Promise.all` | Reuses existing MongoMemoryReplSet + supertest; no separate server needed |
| Vitest `{ timeout: 120000 }` per test | Each scenario gets its own 120 s budget; global `testTimeout` stays at 30 s |
| Batched concurrency in `runConcurrent` | Prevents OOM from firing 50 requests simultaneously in a single `Promise.all` |
| `SKIP_LOAD_TESTS=true` guard | Allows resource-constrained CI environments to skip load tests |
| `LOAD_TEST_THRESHOLDS_ENABLED=false` | Downgrades threshold failures to warnings in constrained environments |

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Vitest Test Runner (group.load.spec.ts)                        │
│                                                                 │
│  beforeAll ──► MongoMemoryReplSet.create()                      │
│             ──► mongoose.connect(uri)                           │
│             ──► seedFixtures({ users, groups, postsPerGroup })  │
│                                                                 │
│  Test 1: Baseline ──► measureLatency(fn) × N endpoints          │
│  Test 2: Concurrent Reads ──► runConcurrent(requests, 50)       │
│  Test 3: Concurrent Writes ──► runConcurrent(requests, 20)      │
│  Test 4: User Journey ──► runConcurrent(scenarios, 10)          │
│  Test 5: Spike ──► phase1(5) → phase2(50) → phase3(5)          │
│  Test 6: Role-Based ──► admin writes + auth enforcement         │
│  Test 7: Data Integrity ──► write → read round-trips            │
│                                                                 │
│  afterAll ──► mongoose.disconnect() ──► replSet.stop()          │
└─────────────────────────────────────────────────────────────────┘
         │
         │ supertest(app)  [no network — in-process]
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express App (src/app.ts)                                       │
│  └── /api/v1/groups  (GroupRoutes)                              │
│       └── GroupController → GroupService → Mongoose             │
│                                          └── MongoMemoryReplSet │
└─────────────────────────────────────────────────────────────────┘
```

### Module Dependencies

```
group.load.spec.ts
  ├── vitest          (describe, it, expect, vi, beforeAll, afterAll)
  ├── mongoose        (connection management)
  ├── mongodb-memory-server (MongoMemoryReplSet)
  ├── supertest       (request(app))
  ├── @faker-js/faker (faker)
  ├── src/app         (Express app instance)
  ├── src/app/modules/user/user.model (User)
  ├── src/app/modules/group/group.model (Group, GroupMember, GroupPost, PostLike, PostComment)
  ├── src/helpers/jwtHelper (jwtHelper.createToken)
  ├── src/config (config.jwt.jwt_secret)
  └── src/enums/user (USER_ROLES, USER_STATUS)
  [mocked]
  ├── src/app/builder/NotificationBuilder/NotificationBuilder
  ├── src/app/modules/notification/notificationsHelper
  └── src/shared/redisClient
```

---

## Components and Interfaces

### 1. TypeScript Interfaces

```typescript
/** Result of a single measured request */
interface LatencyResult {
  durationMs: number;
  status: number;
}

/** Computed statistics over an array of durations */
interface Stats {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

/** Full scenario result including error rate */
interface ScenarioResult extends Stats {
  errorRate: number;       // 0.0 – 1.0
  totalRequests: number;
  failedRequests: number;
}

/** Per-step result for user journey scenarios */
interface StepResult {
  step: string;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

/** Seeded fixture data returned by seedFixtures */
interface FixtureData {
  users: Array<{ user: IUser; token: string }>;
  adminUsers: Array<{ user: IUser; token: string }>;
  groups: IGroup[];
  posts: IGroupPost[];
}

/** Count parameter for seedFixtures */
interface SeedCount {
  users: number;          // BROTHER role users
  adminUsers?: number;    // SUPER_ADMIN role users (default: 2)
  groups: number;
  postsPerGroup: number;
}
```

### 2. Utility Function Signatures

```typescript
/**
 * Executes an array of request factories in batches of `concurrency`.
 * Each batch is a Promise.all; batches run sequentially to bound memory.
 * Returns all LatencyResults in order.
 */
async function runConcurrent(
  requests: Array<() => Promise<LatencyResult>>,
  concurrency: number,
): Promise<LatencyResult[]>

/**
 * Wraps a supertest call and measures wall-clock duration.
 * Returns { durationMs, status } — never throws on HTTP errors.
 */
async function measureLatency(
  fn: () => Promise<{ status: number }>,
): Promise<LatencyResult>

/**
 * Computes percentile statistics over an array of durations (ms).
 * Uses linear interpolation for percentiles.
 * Throws if durations is empty.
 */
function computeStats(durations: number[]): Stats

/**
 * Derives ScenarioResult from an array of LatencyResults.
 * A result is "failed" if status < 200 or status >= 300.
 */
function toScenarioResult(results: LatencyResult[]): ScenarioResult

/**
 * Seeds the database with users, groups, memberships, and posts.
 * All users are BROTHER role (or SUPER_ADMIN for adminUsers).
 * All users have isVerified: true and status: USER_STATUS.ACTIVE.
 * Returns the created documents with their JWT tokens.
 */
async function seedFixtures(count: SeedCount): Promise<FixtureData>

/**
 * Creates a single verified user with a JWT token.
 * Mirrors the createAuthUser helper in group.e2e.spec.ts.
 */
async function createAuthUser(
  role: string,
  nameSuffix?: string,
): Promise<{ user: IUser; token: string }>

/**
 * Asserts that a ScenarioResult meets performance thresholds.
 * When LOAD_TEST_THRESHOLDS_ENABLED=false, logs warnings instead of throwing.
 */
function assertThresholds(
  result: ScenarioResult,
  thresholds: { p95Ms: number; maxErrorRate: number },
  label: string,
): void
```

---

## Data Models

### Fixture Seeding Strategy

`seedFixtures` creates data in this order to satisfy foreign-key constraints:

```
1. Create N BROTHER users  (isVerified: true, status: ACTIVE)
2. Create M SUPER_ADMIN users
3. Create G groups  (userType: BROTHER, category from faker)
4. For each group: join all N users as members (GroupMember docs)
   → also increments group.memberCount via joinGroupInDB service
5. For each group: create P posts per group (one per user, cycling)
```

**Why direct model inserts for users/groups, but service calls for joins/posts?**

- Users and groups are pure data — direct `Model.create()` is faster and avoids auth middleware.
- Joins use the service (`joinGroupInDB`) to correctly increment `memberCount` via MongoDB transactions, matching production behavior.
- Posts use direct `GroupPost.create()` for speed; `commentsCount` and `likesCount` start at 0.

### Performance Threshold Constants

```typescript
// Defined at the top of group.load.spec.ts
const READ_P95_THRESHOLD_MS    = 1000;   // GET endpoints under 50 VU load
const WRITE_P95_THRESHOLD_MS   = 2000;   // POST/PATCH endpoints (transactions)
const SCENARIO_P95_THRESHOLD_MS = 3000;  // Full user journey per step
const MAX_ERROR_RATE           = 0.05;   // 5% — applies to all scenarios
const BASELINE_GET_LIST_MS     = 200;    // Single-user GET /groups
const BASELINE_GET_SINGLE_MS   = 150;    // Single-user GET /groups/:id
const BASELINE_GET_FEED_MS     = 200;    // Single-user GET /groups/:id/posts
const BASELINE_JOIN_MS         = 300;    // Single-user POST join (transaction)
const BASELINE_POST_MS         = 300;    // Single-user POST post
const BASELINE_LIKE_MS         = 200;    // Single-user POST like
const BASELINE_COMMENT_MS      = 200;    // Single-user POST comment
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before listing properties, redundancy was eliminated:

- Properties 3 (concurrent reads error rate) and 4 (concurrent reads P95) are complementary, not redundant — error rate and latency are independent dimensions.
- Properties 5 (concurrent join success) and 6 (memberCount after joins) can be combined: the round-trip property (join N users → memberCount == N) subsumes the individual success check.
- Properties 9 (concurrent like success) and 10 (likesCount after likes) are similarly combined into one round-trip property.
- Properties 13 (write-then-read posts) and 14 (write-then-read comments) are the same pattern applied to different resources — kept separate for clarity.
- Property 15 (double-toggle like) and Property 16 (concurrent like count) are distinct: one is idempotence, the other is concurrency correctness.

---

### Property 1: `runConcurrent` returns all results

*For any* array of N async request factories and any concurrency level C (1 ≤ C ≤ N), `runConcurrent` SHALL return exactly N `LatencyResult` objects, one per input factory, regardless of whether individual requests succeed or fail.

**Validates: Requirements 1.3**

---

### Property 2: `measureLatency` captures non-negative duration and correct status

*For any* async function that returns a response object with a `status` field, `measureLatency` SHALL return `{ durationMs >= 0, status == response.status }` and SHALL NOT throw even when the response has a non-2xx status code.

**Validates: Requirements 1.4**

---

### Property 3: `computeStats` ordering invariant

*For any* non-empty array of duration values, `computeStats` SHALL return values satisfying `min ≤ p50 ≤ p95 ≤ p99 ≤ max`, and `mean` SHALL be within `[min, max]`.

**Validates: Requirements 1.5**

---

### Property 4: `seedFixtures` creates exactly the requested document counts

*For any* valid `SeedCount` `{ users: U, groups: G, postsPerGroup: P }`, calling `seedFixtures` SHALL result in exactly U user documents, G group documents, and G × P post documents being present in the database, and all U users SHALL have `isVerified: true` and `status: USER_STATUS.ACTIVE`.

**Validates: Requirements 1.6, 1.7**

---

### Property 5: Concurrent reads maintain low error rate and acceptable P95

*For any* set of 50 concurrent `GET /api/v1/groups` requests using pre-seeded fixture data, the error rate SHALL be ≤ 1% and P95 latency SHALL be ≤ 1000ms. The same property holds for `GET /api/v1/groups/:groupId/posts` (50 VUs) and `GET /api/v1/groups/:groupId` (20 VUs).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

### Property 6: Concurrent joins produce correct memberCount (round-trip)

*For any* group and any set of N distinct users (N = 20) who have not previously joined that group, when all N users concurrently send `POST /api/v1/groups/:groupId/join`, all N requests SHALL return HTTP 200 with no duplicate membership errors, and a subsequent `GET /api/v1/groups/:groupId` SHALL return `memberCount == N`.

**Validates: Requirements 4.1, 4.2, 4.3**

---

### Property 7: Concurrent likes produce correct likesCount (round-trip)

*For any* post and any set of N distinct users (N = 20) who have not previously liked that post, when all N users concurrently send `POST /api/v1/groups/posts/:postId/like`, all N requests SHALL return HTTP 200, and a subsequent feed fetch SHALL return `likesCount == N` with no over-counting or under-counting.

**Validates: Requirements 4.5, 4.6, 10.4**

---

### Property 8: Concurrent comments produce correct commentsCount (round-trip)

*For any* post and any set of N distinct users (N = 20) concurrently sending `POST /api/v1/groups/posts/:postId/comments`, at least 95% SHALL return HTTP 201, and a subsequent feed fetch SHALL return `commentsCount` equal to the number of successful (201) responses.

**Validates: Requirements 4.7, 4.8, 4.9**

---

### Property 9: User journey scenario completes end-to-end for all VUs

*For any* set of 10 distinct users each executing the `browseAndEngageScenario` (browse → join → read feed → create post → like → comment) concurrently, at least 90% of users SHALL complete all 6 steps with HTTP 2xx responses, and the P95 latency per step SHALL be ≤ 3000ms.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

---

### Property 10: Spike test — server survives and recovers

*For any* spike pattern of 5 pre-spike requests → 50 concurrent spike requests → 5 post-spike requests to `GET /api/v1/groups`, the overall error rate SHALL be ≤ 5%, and all 5 post-spike requests SHALL return HTTP 200, confirming the server has not crashed.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

---

### Property 11: Authorization is strictly enforced under concurrent conditions

*For any* N concurrent requests (N = 20) from users with BROTHER role to the admin-only endpoint `POST /api/v1/groups`, ALL N requests SHALL return HTTP 403 — no request SHALL return HTTP 200 or 201, confirming that concurrent load does not bypass authorization checks.

**Validates: Requirements 9.4, 9.5**

---

### Property 12: Write-then-read round-trip for posts

*For any* set of posts created during the concurrent write load test (identified by their HTTP 201 response bodies), a subsequent `GET /api/v1/groups/:groupId/posts` SHALL return all created posts, with no post missing from the feed.

**Validates: Requirements 10.1**

---

### Property 13: Write-then-read round-trip for comments

*For any* set of comments created during the concurrent comment load test (identified by their HTTP 201 response bodies), a subsequent `GET /api/v1/groups/posts/:postId/comments` SHALL return all created comments.

**Validates: Requirements 10.2**

---

### Property 14: Like toggle is idempotent (double-toggle restores original state)

*For any* post with initial `likesCount` L and any user who has not previously liked that post, performing like → unlike in sequence SHALL result in `likesCount == L` (the original value), confirming the toggle operation is its own inverse.

**Validates: Requirements 10.3**

---

## Error Handling

### Request-Level Error Handling

`measureLatency` wraps every supertest call in a try/catch. Network-level errors (connection refused, timeout) are caught and returned as `{ durationMs: elapsed, status: 0 }`. This ensures `runConcurrent` always collects N results even if some requests fail, and `computeStats` always has a complete dataset.

```typescript
async function measureLatency(fn: () => Promise<{ status: number }>): Promise<LatencyResult> {
  const start = performance.now();
  try {
    const res = await fn();
    return { durationMs: performance.now() - start, status: res.status };
  } catch (err) {
    return { durationMs: performance.now() - start, status: 0 };
  }
}
```

### Threshold Assertion Error Handling

`assertThresholds` checks `process.env.LOAD_TEST_THRESHOLDS_ENABLED`:

- If `"false"`: logs a `console.warn` with the violation details and returns without throwing.
- Otherwise (default): calls `expect(result.p95).toBeLessThanOrEqual(threshold)` and `expect(result.errorRate).toBeLessThanOrEqual(MAX_ERROR_RATE)`, which causes Vitest to fail the test with a descriptive message.

### Timeout Handling

Each load test `it()` block uses `{ timeout: 120000 }`. If a test exceeds 120 s, Vitest cancels it and reports a timeout error. To aid debugging, a `Promise.race` pattern with a 110 s sentinel can log in-flight request counts before the hard timeout fires:

```typescript
// Pseudocode — implemented inside long-running tests
const timeoutSentinel = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error(`Timeout: ${inFlightCount} requests still in-flight`)), 110_000)
);
const result = await Promise.race([runConcurrent(requests, concurrency), timeoutSentinel]);
```

### Fixture Seeding Errors

If `seedFixtures` fails (e.g., duplicate email from a previous test run), `beforeAll` will throw and all tests in the suite will be skipped with a clear error message. The `beforeEach` hook clears all collections to prevent cross-test contamination.

### CI/CD Skip Guard

```typescript
const SKIP = process.env.SKIP_LOAD_TESTS === 'true';
const skipIf = SKIP ? it.skip : it;
// Usage:
skipIf('concurrent read load', { timeout: 120000 }, async () => { ... });
```

---

## Testing Strategy

### Test File Structure

```
src/app/modules/group/__tests__/group.load.spec.ts
│
├── [mocks]  vi.mock for NotificationBuilder, notificationsHelper, redisClient
│
├── [constants]  READ_P95_THRESHOLD_MS, WRITE_P95_THRESHOLD_MS, etc.
│
├── [utilities]  runConcurrent, measureLatency, computeStats, toScenarioResult,
│                seedFixtures, createAuthUser, assertThresholds
│
├── [lifecycle]  beforeAll (replSet + mongoose), afterAll, beforeEach (clearDB)
│
└── describe('Group Load Tests')
    ├── describe('Utility Unit Tests')
    │   ├── it: runConcurrent returns N results for any N and concurrency C
    │   ├── it: measureLatency captures duration and status
    │   ├── it: computeStats ordering invariant
    │   └── it: seedFixtures creates correct counts with correct user fields
    │
    ├── describe('Baseline Performance', { timeout: 30000 })
    │   └── it: single-request latency for all 7 endpoints
    │
    ├── describe('Concurrent Read Load', { timeout: 120000 })
    │   ├── it: 50 VU GET /groups — error rate + P95
    │   ├── it: 50 VU GET /groups/:id/posts — error rate + P95
    │   └── it: 20 VU GET /groups/:id — error rate + P95
    │
    ├── describe('Concurrent Write Load', { timeout: 120000 })
    │   ├── it: 20 VU concurrent join → memberCount round-trip
    │   ├── it: 20 VU concurrent post creation
    │   ├── it: 20 VU concurrent like → likesCount round-trip
    │   └── it: 20 VU concurrent comment → commentsCount round-trip
    │
    ├── describe('User Journey Scenario', { timeout: 120000 })
    │   └── it: 10 VU browseAndEngageScenario — per-step stats
    │
    ├── describe('Spike Test', { timeout: 120000 })
    │   └── it: 5 → 50 → 5 spike on GET /groups
    │
    ├── describe('Role-Based Load', { timeout: 120000 })
    │   ├── it: 5 admin concurrent POST /groups → all 201
    │   ├── it: 10 admin concurrent PATCH pin → all 200
    │   └── it: 20 BROTHER concurrent POST /groups → all 403
    │
    └── describe('Data Integrity', { timeout: 120000 })
        ├── it: write-then-read round-trip for posts
        ├── it: write-then-read round-trip for comments
        └── it: like toggle idempotence (like → unlike → original count)
```

### Utility Implementation Pseudocode

#### `runConcurrent`

```typescript
async function runConcurrent(
  requests: Array<() => Promise<LatencyResult>>,
  concurrency: number,
): Promise<LatencyResult[]> {
  const results: LatencyResult[] = [];
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }
  return results;
}
```

#### `computeStats`

```typescript
function computeStats(durations: number[]): Stats {
  if (durations.length === 0) throw new Error('computeStats: empty array');
  const sorted = [...durations].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}
```

#### `seedFixtures`

```typescript
async function seedFixtures(count: SeedCount): Promise<FixtureData> {
  // 1. Create BROTHER users
  const users = await Promise.all(
    Array.from({ length: count.users }, (_, i) =>
      createAuthUser(USER_ROLES.BROTHER, `load-${i}`)
    )
  );

  // 2. Create SUPER_ADMIN users
  const adminCount = count.adminUsers ?? 2;
  const adminUsers = await Promise.all(
    Array.from({ length: adminCount }, (_, i) =>
      createAuthUser(USER_ROLES.SUPER_ADMIN, `admin-${i}`)
    )
  );

  // 3. Create groups via direct model insert (faster than API)
  const groups = await Group.insertMany(
    Array.from({ length: count.groups }, () => ({
      name: faker.company.name(),
      description: faker.lorem.sentence(),
      userType: USER_ROLES.BROTHER,
      category: faker.helpers.arrayElement(['Spiritual', 'Community', 'Education']),
      memberCount: 0,
    }))
  );

  // 4. Create posts via direct model insert
  const posts: IGroupPost[] = [];
  for (const group of groups) {
    for (let i = 0; i < count.postsPerGroup; i++) {
      const user = users[i % users.length];
      posts.push(await GroupPost.create({
        groupId: group._id,
        userId: user.user._id,
        content: faker.lorem.paragraph(),
        attachments: [],
      }));
    }
  }

  return { users, adminUsers, groups, posts };
}
```

#### `browseAndEngageScenario`

```typescript
async function browseAndEngageScenario(
  token: string,
  fixtures: FixtureData,
): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  const group = fixtures.groups[0];

  // Step 1: Browse groups
  const browse = await measureLatency(() =>
    request(app).get('/api/v1/groups').set('Authorization', `Bearer ${token}`)
  );
  steps.push({ step: 'browse', ...singleToStats(browse) });

  // Step 2: Join group
  const join = await measureLatency(() =>
    request(app).post(`/api/v1/groups/${group._id}/join`)
      .set('Authorization', `Bearer ${token}`)
  );
  steps.push({ step: 'join', ...singleToStats(join) });

  // Step 3: Read feed
  const feed = await measureLatency(() =>
    request(app).get(`/api/v1/groups/${group._id}/posts`)
      .set('Authorization', `Bearer ${token}`)
  );
  steps.push({ step: 'read-feed', ...singleToStats(feed) });

  // Step 4: Create post
  const post = await measureLatency(() =>
    request(app).post(`/api/v1/groups/${group._id}/posts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: faker.lorem.sentence() })
  );
  steps.push({ step: 'create-post', ...singleToStats(post) });

  // Step 5: Like an existing post
  const existingPost = fixtures.posts.find(p => p.groupId.toString() === group._id.toString());
  if (existingPost) {
    const like = await measureLatency(() =>
      request(app).post(`/api/v1/groups/posts/${existingPost._id}/like`)
        .set('Authorization', `Bearer ${token}`)
    );
    steps.push({ step: 'like-post', ...singleToStats(like) });
  }

  // Step 6: Comment on existing post
  if (existingPost) {
    const comment = await measureLatency(() =>
      request(app).post(`/api/v1/groups/posts/${existingPost._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ comment: faker.lorem.sentence() })
    );
    steps.push({ step: 'comment', ...singleToStats(comment) });
  }

  return steps;
}
```

### Property-Based Testing

This feature uses **Vitest** as the test runner. The utility functions (`runConcurrent`, `measureLatency`, `computeStats`, `seedFixtures`) are pure or near-pure functions that are well-suited for property-based testing. The load scenarios themselves are property tests in the sense that they verify universal invariants (error rate, latency bounds, data integrity) across many concurrent inputs.

**PBT Library**: [`fast-check`](https://github.com/dubzzz/fast-check) — TypeScript-native, Vitest-compatible.

Install: `npm install --save-dev fast-check`

**Property test configuration**: minimum 100 iterations per property test (via `fc.assert(fc.property(...), { numRuns: 100 })`).

**Tag format**: Each property test includes a comment:
```
// Feature: group-load-testing, Property N: <property_text>
```

#### Property Tests for Utility Functions

```typescript
import * as fc from 'fast-check';

// Feature: group-load-testing, Property 1: runConcurrent returns N results
it('runConcurrent returns exactly N results for any N and concurrency', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 1, max: 10 }),
      async (n, concurrency) => {
        const factories = Array.from({ length: n }, () =>
          () => Promise.resolve({ durationMs: 1, status: 200 })
        );
        const results = await runConcurrent(factories, concurrency);
        return results.length === n;
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: group-load-testing, Property 3: computeStats ordering invariant
it('computeStats satisfies min <= p50 <= p95 <= p99 <= max', () => {
  fc.assert(
    fc.property(
      fc.array(fc.float({ min: 0, max: 10000 }), { minLength: 1, maxLength: 200 }),
      (durations) => {
        const stats = computeStats(durations);
        return (
          stats.min <= stats.p50 &&
          stats.p50 <= stats.p95 &&
          stats.p95 <= stats.p99 &&
          stats.p99 <= stats.max &&
          stats.mean >= stats.min &&
          stats.mean <= stats.max
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Load Scenario Tests (Vitest `it` with `{ timeout: 120000 }`)

The load scenarios (concurrent reads, writes, user journey, spike, role-based, data integrity) are implemented as standard Vitest `it` blocks with `{ timeout: 120000 }`. They are not property tests in the fast-check sense — they run once with a fixed concurrency level — but they verify the correctness properties defined above through direct assertion.

```typescript
// Feature: group-load-testing, Property 5: concurrent reads maintain low error rate
it('50 VU concurrent GET /groups — error rate ≤ 1%, P95 ≤ 1000ms',
  { timeout: 120000 },
  async () => {
    const requests = fixtures.users.slice(0, 50).map(({ token }) =>
      () => measureLatency(() =>
        request(app).get('/api/v1/groups').set('Authorization', `Bearer ${token}`)
      )
    );
    const results = await runConcurrent(requests, 50);
    const scenario = toScenarioResult(results);
    console.table([{ endpoint: 'GET /groups', ...scenario }]);
    assertThresholds(scenario, { p95Ms: READ_P95_THRESHOLD_MS, maxErrorRate: 0.01 }, 'GET /groups 50VU');
  }
);
```

### Unit Tests

Unit tests (without fast-check) cover:

- `measureLatency` with a mock that returns a known status and simulated delay
- `assertThresholds` with values above and below thresholds, and with `LOAD_TEST_THRESHOLDS_ENABLED=false`
- `seedFixtures` verifying document counts and user field values
- Baseline latency assertions (single-request, no concurrency)

### CI/CD Integration

**vitest.config.ts** — no changes needed. The load test file is discovered by the existing glob.

**Per-test timeout override**: The global `testTimeout: 30000` in `vitest.config.ts` is overridden per test using `it('...', { timeout: 120000 }, async () => { ... })`. This is the correct Vitest API for per-test timeouts.

**Environment variables**:

| Variable | Default | Effect |
|---|---|---|
| `SKIP_LOAD_TESTS` | unset | When `"true"`, all load scenarios are skipped via `it.skip` |
| `LOAD_TEST_THRESHOLDS_ENABLED` | unset | When `"false"`, threshold violations become warnings |

**GitHub Actions example** (add to `.github/workflows/deploy-aws.yml` or a separate CI job):

```yaml
- name: Run load tests
  env:
    SKIP_LOAD_TESTS: "false"
    LOAD_TEST_THRESHOLDS_ENABLED: "true"
  run: npx vitest run --reporter=verbose src/app/modules/group/__tests__/group.load.spec.ts
```

To skip in resource-constrained environments:

```yaml
- name: Run load tests (skip in PR)
  env:
    SKIP_LOAD_TESTS: ${{ github.event_name == 'pull_request' && 'true' || 'false' }}
  run: npx vitest run src/app/modules/group/__tests__/group.load.spec.ts
```

### Summary Table Output

At the end of the test run, `console.table` produces a human-readable summary:

```
┌─────────────────────────────┬──────┬──────┬──────┬──────┬──────┬───────────┬────────┐
│ scenario                    │ min  │ mean │ p50  │ p95  │ p99  │ errorRate │ status │
├─────────────────────────────┼──────┼──────┼──────┼──────┼──────┼───────────┼────────┤
│ GET /groups 50VU            │  12  │  87  │  82  │ 210  │ 340  │   0.00%   │  PASS  │
│ GET /groups/:id/posts 50VU  │  15  │  95  │  90  │ 250  │ 380  │   0.00%   │  PASS  │
│ Concurrent Join 20VU        │  45  │ 180  │ 170  │ 420  │ 610  │   0.00%   │  PASS  │
│ browseAndEngage 10VU (p95)  │  —   │  —   │  —   │ 890  │  —   │   0.00%   │  PASS  │
│ Spike Test (all phases)     │  10  │  95  │  88  │ 310  │ 490  │   1.67%   │  PASS  │
└─────────────────────────────┴──────┴──────┴──────┴──────┴──────┴───────────┴────────┘
```
