# Implementation Plan: Group Module Load Testing

## Overview

Implement a single TypeScript file at `src/app/modules/group/__tests__/group.load.spec.ts` that provides an in-process load testing suite for the Group API. The file uses the existing Vitest + supertest + MongoMemoryReplSet infrastructure and adds `fast-check` for property-based tests on utility functions. All load scenarios run inside Vitest with `{ timeout: 120000 }` per test and are guarded by `SKIP_LOAD_TESTS` / `LOAD_TEST_THRESHOLDS_ENABLED` env vars.

## Tasks

- [ ] 1. Install fast-check and scaffold the test file skeleton
  - Run `npm install --save-dev fast-check` to add the PBT library
  - Create `src/app/modules/group/__tests__/group.load.spec.ts` with:
    - All `vi.mock` calls (NotificationBuilder, notificationsHelper, redisClient) mirroring `group.e2e.spec.ts`
    - All threshold constants at the top of the file: `READ_P95_THRESHOLD_MS`, `WRITE_P95_THRESHOLD_MS`, `SCENARIO_P95_THRESHOLD_MS`, `MAX_ERROR_RATE`, and all `BASELINE_*` constants
    - `SKIP` constant derived from `process.env.SKIP_LOAD_TESTS === 'true'`
    - All TypeScript interfaces: `LatencyResult`, `Stats`, `ScenarioResult`, `StepResult`, `FixtureData`, `SeedCount`
    - Empty stubs for all utility functions and the top-level `describe` block
  - _Requirements: 1.1, 1.2, 1.8, 1.9, 7.1, 8.1, 8.4, 8.5_

- [ ] 2. Implement core utility functions
  - [ ] 2.1 Implement `measureLatency` and `runConcurrent`
    - `measureLatency` wraps a supertest call with `performance.now()` timing; catches errors and returns `{ durationMs, status: 0 }` on failure
    - `runConcurrent` slices the request array into batches of `concurrency` and runs each batch with `Promise.all`, collecting all `LatencyResult` objects
    - _Requirements: 1.3, 1.4_

  - [ ]* 2.2 Write property test for `runConcurrent` (Property 1)
    - **Property 1: `runConcurrent` returns exactly N results for any N and concurrency C**
    - Use `fc.asyncProperty(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 10 }), ...)` with `numRuns: 100`
    - Factories resolve immediately with `{ durationMs: 1, status: 200 }`
    - **Validates: Requirements 1.3**

  - [ ]* 2.3 Write property test for `measureLatency` (Property 2)
    - **Property 2: `measureLatency` captures non-negative duration and correct status**
    - Use `fc.integer({ min: 100, max: 599 })` to generate arbitrary status codes
    - Assert `durationMs >= 0` and `status === generated status`; assert no throw on non-2xx
    - **Validates: Requirements 1.4**

  - [ ] 2.4 Implement `computeStats` and `toScenarioResult`
    - `computeStats` sorts durations, computes min/max/mean and percentiles (p50, p95, p99) via linear interpolation; throws on empty array
    - `toScenarioResult` calls `computeStats` on durations, counts failed results (status < 200 or ≥ 300), and returns `ScenarioResult` with `errorRate`, `totalRequests`, `failedRequests`
    - _Requirements: 1.5_

  - [ ]* 2.5 Write property test for `computeStats` ordering invariant (Property 3)
    - **Property 3: `computeStats` satisfies `min ≤ p50 ≤ p95 ≤ p99 ≤ max` and `mean ∈ [min, max]`**
    - Use `fc.array(fc.float({ min: 0, max: 10000 }), { minLength: 1, maxLength: 200 })` with `numRuns: 100`
    - **Validates: Requirements 1.5**

- [ ] 3. Implement `createAuthUser` and `seedFixtures`
  - [ ] 3.1 Implement `createAuthUser`
    - Mirror the helper from `group.e2e.spec.ts`: create a User document with `isVerified: true`, `status: USER_STATUS.ACTIVE`, unique email via `Date.now() + Math.random()`, and return `{ user, token }` with a 1h JWT
    - _Requirements: 1.6, 1.7_

  - [ ] 3.2 Implement `seedFixtures`
    - Step 1: Create `count.users` BROTHER users via `createAuthUser`
    - Step 2: Create `count.adminUsers ?? 2` SUPER_ADMIN users via `createAuthUser`
    - Step 3: Insert `count.groups` Group documents directly via `Group.insertMany` (faker name, description, `userType: BROTHER`, faker category, `memberCount: 0`)
    - Step 4: For each group, create `GroupMember` documents for all BROTHER users and increment `memberCount` to match (use direct `GroupMember.insertMany` + `Group.findByIdAndUpdate` to set `memberCount`)
    - Step 5: For each group, create `count.postsPerGroup` posts via `GroupPost.create`, cycling through users
    - Return `FixtureData`
    - _Requirements: 1.6, 1.7_

  - [ ]* 3.3 Write property test for `seedFixtures` document counts (Property 4)
    - **Property 4: `seedFixtures` creates exactly U users, G groups, and G×P posts with correct user fields**
    - Use `fc.record({ users: fc.integer({ min: 1, max: 5 }), groups: fc.integer({ min: 1, max: 3 }), postsPerGroup: fc.integer({ min: 1, max: 3 }) })` with `numRuns: 20`
    - Assert document counts in DB and that all users have `isVerified: true` and `status: ACTIVE`
    - **Validates: Requirements 1.6, 1.7**

- [ ] 4. Implement `assertThresholds` and lifecycle hooks
  - [ ] 4.1 Implement `assertThresholds`
    - Check `process.env.LOAD_TEST_THRESHOLDS_ENABLED !== 'false'`; if enabled, use `expect(result.p95).toBeLessThanOrEqual(thresholds.p95Ms)` and `expect(result.errorRate).toBeLessThanOrEqual(thresholds.maxErrorRate)` with descriptive messages
    - If disabled, emit `console.warn` with violation details and return without throwing
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ] 4.2 Wire up `beforeAll`, `afterAll`, and `beforeEach` lifecycle hooks
    - `beforeAll`: disconnect any existing mongoose connection, create `MongoMemoryReplSet` (count: 1), connect mongoose, call `seedFixtures({ users: 50, adminUsers: 5, groups: 3, postsPerGroup: 10 })` and store result in a module-level `fixtures` variable
    - `afterAll`: close mongoose connection, stop replSet
    - `beforeEach`: clear all collections via `mongoose.connection.collections`, call `vi.clearAllMocks()`, reset `global.io` mock
    - _Requirements: 1.1, 1.2, 1.8, 8.2_

- [ ] 5. Implement Utility Unit Tests and Baseline Performance describe blocks
  - [ ] 5.1 Implement `describe('Utility Unit Tests')` block
    - Wire the four property-based tests from tasks 2.2, 2.3, 2.5, and 3.3 into this describe block
    - Add a unit test for `assertThresholds` with values above/below thresholds and with `LOAD_TEST_THRESHOLDS_ENABLED=false`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 5.2 Implement `describe('Baseline Performance')` block
    - Single `it` block (timeout: 30000) that calls `measureLatency` once per endpoint for all 7 endpoints: `GET /groups`, `GET /groups/:id`, `GET /groups/:id/posts`, `POST /groups/:id/join`, `POST /groups/:id/posts`, `POST /posts/:id/like`, `POST /posts/:id/comments`
    - Assert each duration is within its `BASELINE_*` constant
    - Log results as `console.table([{ endpoint, method, durationMs, statusCode }])`
    - Use `it.skipIf(SKIP)` guard
    - _Requirements: 2.1–2.8_

- [ ] 6. Implement Concurrent Read Load describe block
  - [ ] 6.1 Implement 50 VU `GET /api/v1/groups` load test
    - Build 50 request factories from `fixtures.users.slice(0, 50)`, each calling `measureLatency` on `GET /groups`
    - Call `runConcurrent(requests, 50)`, compute `toScenarioResult`, log with `console.table`
    - Call `assertThresholds` with `{ p95Ms: READ_P95_THRESHOLD_MS, maxErrorRate: 0.01 }`
    - Use `it.skipIf(SKIP)('...', { timeout: 120000 }, ...)`
    - _Requirements: 3.1, 3.2, 3.6, 3.7_

  - [ ] 6.2 Implement 50 VU `GET /api/v1/groups/:groupId/posts` load test
    - Same pattern as 6.1 but targeting the feed endpoint for `fixtures.groups[0]._id`
    - Call `assertThresholds` with `{ p95Ms: READ_P95_THRESHOLD_MS, maxErrorRate: 0.01 }`
    - _Requirements: 3.3, 3.4, 3.6, 3.7_

  - [ ] 6.3 Implement 20 VU `GET /api/v1/groups/:groupId` load test
    - Same pattern using 20 users and `fixtures.groups[0]._id`
    - Call `assertThresholds` with `{ p95Ms: READ_P95_THRESHOLD_MS, maxErrorRate: 0.01 }`
    - _Requirements: 3.5, 3.6, 3.7_

- [ ] 7. Checkpoint — Ensure all tests pass up to this point
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Concurrent Write Load describe block
  - [ ] 8.1 Implement 20 VU concurrent join → memberCount round-trip test
    - Create 20 fresh users (not in fixtures) via `createAuthUser` so none have joined the target group
    - Build 20 join request factories for `fixtures.groups[1]._id`, run with `runConcurrent(..., 20)`
    - Assert all 20 responses are HTTP 200 (no duplicate membership errors)
    - Fetch `GET /groups/:groupId` and assert `memberCount` equals the initial seed count + 20
    - Call `assertThresholds` with `{ p95Ms: WRITE_P95_THRESHOLD_MS, maxErrorRate: 0 }`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 8.2 Implement 20 VU concurrent post creation test
    - Use 20 fixture users who are already members of `fixtures.groups[0]`
    - Build 20 post request factories, run with `runConcurrent(..., 20)`
    - Assert at least 95% return HTTP 201
    - Call `assertThresholds` with `{ p95Ms: WRITE_P95_THRESHOLD_MS, maxErrorRate: 0.05 }`
    - _Requirements: 4.4_

  - [ ] 8.3 Implement 20 VU concurrent like → likesCount round-trip test
    - Create 20 fresh users (not in fixtures) who join the group first, then concurrently like `fixtures.posts[0]._id`
    - Assert all 20 like responses are HTTP 200
    - Fetch the feed and assert `likesCount === 20` on the target post
    - _Requirements: 4.5, 4.6_

  - [ ] 8.4 Implement 20 VU concurrent comment → commentsCount round-trip test
    - Use 20 fixture users, build 20 comment request factories for `fixtures.posts[0]._id`
    - Run with `runConcurrent(..., 20)`, count HTTP 201 responses
    - Fetch the feed and assert `commentsCount` equals the number of successful 201 responses
    - _Requirements: 4.7, 4.8, 4.9_

- [ ] 9. Implement User Journey Scenario describe block
  - [ ] 9.1 Implement `browseAndEngageScenario` helper function
    - Implement the 6-step sequence: browse groups → join group → read feed → create post → like existing post → add comment
    - Each step uses `measureLatency` and appends a `StepResult` to the return array
    - Accept `token: string` and `fixtures: FixtureData` as parameters; use a unique group per call to avoid join conflicts
    - _Requirements: 5.1, 5.5_

  - [ ] 9.2 Implement 10 VU concurrent `browseAndEngageScenario` test
    - Create 10 fresh users (not in fixtures) to avoid join conflicts
    - Run 10 scenario factories concurrently with `Promise.all`
    - Flatten all `StepResult[]` arrays, compute per-step stats, log with `console.table([{ step, p50, p95, p99, errorRate }])`
    - Assert at least 90% of all step responses are 2xx
    - Assert per-step P95 ≤ `SCENARIO_P95_THRESHOLD_MS`
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [ ] 10. Implement Spike Test describe block
  - [ ] 10.1 Implement 5 → 50 → 5 spike test on `GET /api/v1/groups`
    - Phase 1: run 5 sequential requests, record results
    - Phase 2: run 50 concurrent requests via `runConcurrent(..., 50)`, record results
    - Phase 3: run 5 sequential requests, record results
    - Compute `toScenarioResult` separately for each phase
    - Log per-phase error rate and P95 with `console.table`
    - Assert overall error rate ≤ 5% across all phases
    - Assert all 5 post-spike (phase 3) responses are HTTP 200
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 11. Implement Role-Based Load describe block
  - [ ] 11.1 Implement 5 admin concurrent `POST /api/v1/groups` test
    - Use `fixtures.adminUsers.slice(0, 5)` to build 5 create-group request factories
    - Run with `runConcurrent(..., 5)`, assert all 5 return HTTP 201
    - _Requirements: 9.1, 9.2_

  - [ ] 11.2 Implement 10 admin concurrent `PATCH /posts/:postId/pin` test
    - Use `fixtures.adminUsers` and 10 different posts from `fixtures.posts`
    - Run with `runConcurrent(..., 10)`, assert all 10 return HTTP 200
    - _Requirements: 9.1, 9.3_

  - [ ] 11.3 Implement 20 BROTHER concurrent `POST /api/v1/groups` → all 403 test
    - Use 20 fixture BROTHER users to build 20 create-group request factories
    - Run with `runConcurrent(..., 20)`, assert every single response is HTTP 403 (fail if any is 200 or 201)
    - _Requirements: 9.4, 9.5_

- [ ] 12. Implement Data Integrity describe block
  - [ ] 12.1 Implement write-then-read round-trip for posts
    - Run 10 concurrent `POST /groups/:groupId/posts` requests, collect all HTTP 201 response bodies
    - Fetch `GET /groups/:groupId/posts` and assert every created post ID appears in the feed
    - _Requirements: 10.1, 10.5_

  - [ ] 12.2 Implement write-then-read round-trip for comments
    - Run 10 concurrent `POST /posts/:postId/comments` requests, collect all HTTP 201 response bodies
    - Fetch `GET /posts/:postId/comments` and assert every created comment ID appears in the response
    - _Requirements: 10.2, 10.5_

  - [ ] 12.3 Implement like toggle idempotence test
    - Fetch initial `likesCount` L for a post
    - User A likes the post (assert HTTP 200, message contains "liked")
    - User A unlikes the post (assert HTTP 200, message contains "unliked")
    - Fetch post again and assert `likesCount === L`
    - _Requirements: 10.3_

- [ ] 13. Add final `console.table` summary and wire all scenario results
  - After all `it` blocks, add an `afterAll` hook (or use the existing one) that calls `console.table` with the accumulated `scenarioResults` array showing `{ scenario, p50, p95, p99, errorRate, threshold, status: pass/fail }`
  - Accumulate results by pushing to a module-level `scenarioResults` array inside each `it` block before `assertThresholds`
  - _Requirements: 8.6_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `fast-check` must be installed before any PBT tasks can run: `npm install --save-dev fast-check`
- The `beforeEach` hook clears all collections, so each `it` block starts with a clean DB — tests that need pre-seeded data must re-seed or use the `fixtures` variable populated in `beforeAll`
- For write tests (tasks 8.1, 8.3, 9.2), create fresh users outside `fixtures` to avoid join/like conflicts from the seed data
- The `SKIP` guard uses `it.skipIf(SKIP)` — utility unit tests and baseline tests should also be guarded
- Property tests (tasks 2.2, 2.3, 2.5, 3.3) do not hit the database and run fast; they belong in `describe('Utility Unit Tests')`
- Checkpoints at tasks 7 and 14 ensure incremental validation before moving to the next phase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.4", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "8.1", "8.2", "8.3", "8.4", "9.1", "10.1", "11.1", "11.2", "11.3", "12.1", "12.2", "12.3"] },
    { "id": 6, "tasks": ["9.2"] },
    { "id": 7, "tasks": ["13"] }
  ]
}
```
