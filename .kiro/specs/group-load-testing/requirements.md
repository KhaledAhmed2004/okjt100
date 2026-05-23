# Requirements Document

## Introduction

এই feature-টি Group module-এর জন্য একটি comprehensive load testing suite তৈরি করে।
বর্তমানে project-এ Vitest + supertest দিয়ে e2e/integration tests আছে।
Load testing-এর লক্ষ্য হলো realistic concurrent user scenarios-এ API-গুলোর performance, throughput, এবং stability পরিমাপ করা — যেমন একসাথে অনেক user group-এ join করা, feed পড়া, post করা, এবং like দেওয়া।

### Industry Context: Load Testing কীভাবে করা হয়

Industry-তে load testing সাধারণত তিনটি স্তরে করা হয়:

1. **In-process load tests** (unit-level): Test runner-এর মধ্যেই concurrent requests পাঠানো হয়। Tool: `autocannon`, `k6` (programmatic), বা custom `Promise.all` loops। এগুলো CI/CD-এ সহজে চলে।

2. **External load testing tools**: একটি running server-এর বিরুদ্ধে বাইরে থেকে load দেওয়া হয়। Tool: `k6`, `Artillery`, `Apache JMeter`, `Gatling`। এগুলো production-like environment-এ ব্যবহার হয়।

3. **Cloud-based load testing**: AWS Load Testing, Azure Load Testing, Grafana Cloud k6। এগুলো large-scale (হাজার হাজার VU) testing-এর জন্য।

এই project-এর জন্য **Vitest-compatible in-process approach** বেছে নেওয়া হয়েছে কারণ:
- Existing test infrastructure (MongoMemoryReplSet, supertest, vitest) পুনরায় ব্যবহার করা যাবে
- CI/CD pipeline-এ `vitest run` দিয়েই চলবে
- আলাদা server start করার দরকার নেই
- `autocannon` বা `k6` script-এর চেয়ে TypeScript-এ লেখা সহজ এবং maintainable

---

## Glossary

- **Load_Test_Runner**: Vitest-এর মধ্যে চলা load testing framework, যা `Promise.all` এবং supertest ব্যবহার করে concurrent HTTP requests পাঠায়।
- **Virtual_User (VU)**: একটি simulated user যে একটি নির্দিষ্ট scenario execute করে।
- **Scenario**: একটি realistic user journey, যেমন "join group → read feed → create post → like post"।
- **Throughput**: প্রতি সেকেন্ডে সফলভাবে সম্পন্ন request-এর সংখ্যা (RPS — Requests Per Second)।
- **P95_Latency**: 95th percentile response time — মানে 95% request এই সময়ের মধ্যে শেষ হয়।
- **P99_Latency**: 99th percentile response time।
- **Error_Rate**: মোট request-এর মধ্যে failed (non-2xx) response-এর শতাংশ।
- **Ramp_Up**: ধীরে ধীরে VU সংখ্যা বাড়ানোর প্রক্রিয়া।
- **Steady_State**: যখন VU সংখ্যা একটি নির্দিষ্ট মাত্রায় স্থির থাকে।
- **Spike_Test**: হঠাৎ করে অনেক বেশি load দেওয়ার test।
- **Soak_Test**: দীর্ঘ সময় ধরে moderate load দিয়ে memory leak বা degradation খোঁজার test।
- **MongoMemoryReplSet**: In-memory MongoDB replica set, যা test environment-এ real transactions support করে।
- **Baseline**: Load test ছাড়া single request-এর response time, যা comparison-এর জন্য ব্যবহার হয়।
- **Group_API**: `/api/v1/groups` prefix-এর সব endpoints।
- **Auth_Token**: JWT bearer token যা authenticated requests-এ ব্যবহার হয়।
- **Fixture**: Test-এর আগে তৈরি করা pre-seeded data (users, groups, posts)।

---

## Requirements

### Requirement 1: Load Test Infrastructure Setup

**User Story:** As a developer, I want a reusable load testing infrastructure within the Vitest ecosystem, so that I can run load tests without setting up separate tools or servers.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL use `MongoMemoryReplSet` for database isolation, consistent with the existing e2e test pattern in `group.e2e.spec.ts`.
2. THE Load_Test_Runner SHALL use `supertest` to send HTTP requests directly to the Express `app` instance without requiring a running server.
3. THE Load_Test_Runner SHALL provide a `runConcurrent(requests: (() => Promise<Response>)[], concurrency: number)` utility that executes requests in batches of the given concurrency level.
4. THE Load_Test_Runner SHALL provide a `measureLatency(fn: () => Promise<Response>)` utility that returns `{ durationMs: number, status: number }` for each request.
5. THE Load_Test_Runner SHALL provide a `computeStats(durations: number[])` utility that returns `{ min, max, mean, p50, p95, p99 }` in milliseconds.
6. THE Load_Test_Runner SHALL provide a `seedFixtures(count: { users: number, groups: number, postsPerGroup: number })` function that creates test users with valid JWT tokens, groups, memberships, and posts using `@faker-js/faker`.
7. WHEN `seedFixtures` is called, THE Load_Test_Runner SHALL create users with `isVerified: true` and `status: USER_STATUS.ACTIVE` to match the auth middleware requirements.
8. THE Load_Test_Runner SHALL mock Redis (`../../../../shared/redisClient`) and `NotificationBuilder` using `vi.mock`, consistent with the existing e2e test mocks.
9. THE Load_Test_Runner SHALL be placed at `src/app/modules/group/__tests__/group.load.spec.ts`.
10. WHEN the load test file is run with `vitest run`, THE Load_Test_Runner SHALL complete within the configured `testTimeout` of 120000ms (2 minutes) per test.

---

### Requirement 2: Baseline Performance Measurement

**User Story:** As a developer, I want to measure the baseline response time of each Group API endpoint under single-user conditions, so that I have a reference point for comparing load test results.

#### Acceptance Criteria

1. WHEN a single authenticated request is sent to `GET /api/v1/groups`, THE Group_API SHALL respond within 200ms.
2. WHEN a single authenticated request is sent to `GET /api/v1/groups/:groupId`, THE Group_API SHALL respond within 150ms.
3. WHEN a single authenticated request is sent to `GET /api/v1/groups/:groupId/posts`, THE Group_API SHALL respond within 200ms.
4. WHEN a single authenticated request is sent to `POST /api/v1/groups/:groupId/join`, THE Group_API SHALL respond within 300ms (involves MongoDB transaction).
5. WHEN a single authenticated request is sent to `POST /api/v1/groups/:groupId/posts`, THE Group_API SHALL respond within 300ms.
6. WHEN a single authenticated request is sent to `POST /api/v1/groups/posts/:postId/like`, THE Group_API SHALL respond within 200ms.
7. WHEN a single authenticated request is sent to `POST /api/v1/groups/posts/:postId/comments`, THE Group_API SHALL respond within 200ms.
8. THE Load_Test_Runner SHALL record and log baseline measurements in a structured format: `{ endpoint, method, durationMs, statusCode }`.

---

### Requirement 3: Concurrent Read Load Test (List & Feed Endpoints)

**User Story:** As a developer, I want to verify that the Group API handles concurrent read requests efficiently, so that I know the system can serve many users browsing groups and feeds simultaneously.

#### Acceptance Criteria

1. WHEN 50 Virtual_Users concurrently send `GET /api/v1/groups` requests during a concurrent load test, THE Group_API SHALL return HTTP 200 for at least 99% of those concurrent requests (Error_Rate ≤ 1%).
2. WHEN 50 Virtual_Users concurrently send `GET /api/v1/groups` requests during a concurrent load test, THE Group_API SHALL achieve a P95_Latency of ≤ 1000ms for those concurrent requests.
3. WHEN 50 Virtual_Users concurrently send `GET /api/v1/groups/:groupId/posts` requests during a concurrent load test, THE Group_API SHALL return HTTP 200 for at least 99% of those concurrent requests.
4. WHEN 50 Virtual_Users concurrently send `GET /api/v1/groups/:groupId/posts` requests during a concurrent load test, THE Group_API SHALL achieve a P95_Latency of ≤ 1000ms for those concurrent requests.
5. WHEN 20 Virtual_Users concurrently send `GET /api/v1/groups/:groupId` requests during a concurrent load test, THE Group_API SHALL return HTTP 200 for at least 99% of those concurrent requests.
6. THE Load_Test_Runner SHALL use pre-seeded Fixture data (not create data during the read test) to avoid write contention during read load tests.
7. THE Load_Test_Runner SHALL log the computed stats `{ min, max, mean, p50, p95, p99, errorRate }` for each read scenario using `console.table`.

---

### Requirement 4: Concurrent Write Load Test (Join, Post, Like, Comment)

**User Story:** As a developer, I want to verify that the Group API handles concurrent write operations correctly under load, so that I know data integrity is maintained when many users write simultaneously.

#### Acceptance Criteria

1. WHEN 20 different Virtual_Users concurrently send `POST /api/v1/groups/:groupId/join` requests (each user joining for the first time), THE Group_API SHALL return HTTP 200 for all 20 requests with no duplicate membership errors.
2. WHEN 20 different Virtual_Users concurrently send `POST /api/v1/groups/:groupId/join` requests, THE Group_API SHALL achieve a P95_Latency of ≤ 2000ms (MongoDB transactions are involved).
3. AFTER 20 concurrent join requests complete, THE Group_API SHALL reflect `memberCount` equal to 20 when `GET /api/v1/groups/:groupId` is called.
4. WHEN 20 Virtual_Users concurrently send `POST /api/v1/groups/:groupId/posts` requests, THE Group_API SHALL return HTTP 201 for at least 95% of requests.
5. WHEN 20 Virtual_Users concurrently send `POST /api/v1/groups/posts/:postId/like` requests (each user liking the same post for the first time), THE Group_API SHALL return HTTP 200 for all 20 requests.
6. AFTER 20 concurrent like requests on the same post complete, THE Group_API SHALL reflect `likesCount` equal to 20 when the post is fetched from the feed.
7. WHEN 20 Virtual_Users concurrently send `POST /api/v1/groups/posts/:postId/comments` requests, THE Group_API SHALL return HTTP 201 for at least 95% of requests.
8. AFTER 20 concurrent comment requests complete, THE Group_API SHALL reflect `commentsCount` equal to 20 when the post is fetched from the feed.
9. THE Load_Test_Runner SHALL verify data integrity (memberCount, likesCount, commentsCount) after each concurrent write scenario by querying the API.

---

### Requirement 5: Realistic User Journey Scenario Test

**User Story:** As a developer, I want to simulate realistic end-to-end user journeys under concurrent load, so that I can identify bottlenecks in the most common usage patterns.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL define a `browseAndEngageScenario` that executes the following steps in sequence for each Virtual_User:
   - `GET /api/v1/groups` (browse groups)
   - `POST /api/v1/groups/:groupId/join` (join a group)
   - `GET /api/v1/groups/:groupId/posts` (read feed)
   - `POST /api/v1/groups/:groupId/posts` (create a post)
   - `POST /api/v1/groups/posts/:postId/like` (like another user's post)
   - `POST /api/v1/groups/posts/:postId/comments` (add a comment)
2. WHEN 10 Virtual_Users concurrently execute the `browseAndEngageScenario`, THE Group_API SHALL complete all steps for at least 90% of users with HTTP 2xx responses.
3. WHEN 10 Virtual_Users concurrently execute the `browseAndEngageScenario`, THE Group_API SHALL achieve an overall P95_Latency of ≤ 3000ms per scenario step.
4. THE Load_Test_Runner SHALL record per-step latency for the scenario and log a summary table showing `{ step, p50, p95, p99, errorRate }`.
5. WHEN the `browseAndEngageScenario` is run, THE Load_Test_Runner SHALL use a unique user per Virtual_User (not shared users) to avoid join/leave conflicts.

---

### Requirement 6: Spike Test

**User Story:** As a developer, I want to verify that the Group API recovers gracefully from sudden traffic spikes, so that I know the system does not crash or return errors during unexpected bursts.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL define a `spikeTest` that sends 5 requests, then immediately 50 concurrent requests, then 5 requests again to `GET /api/v1/groups`.
2. WHEN the `spikeTest` runs, THE Group_API SHALL return HTTP 200 for at least 95% of all requests across all three phases.
3. WHEN the `spikeTest` runs, THE Group_API SHALL return HTTP 200 for the final 5 requests (post-spike recovery check), confirming the server has not crashed.
4. THE Load_Test_Runner SHALL log the error rate and P95_Latency separately for each phase (pre-spike, spike, post-spike).

---

### Requirement 7: Performance Threshold Assertions

**User Story:** As a developer, I want load tests to automatically fail when performance thresholds are exceeded, so that CI/CD pipelines catch regressions before they reach production.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL define the following thresholds as named constants in the test file:
   - `READ_P95_THRESHOLD_MS = 1000`
   - `WRITE_P95_THRESHOLD_MS = 2000`
   - `SCENARIO_P95_THRESHOLD_MS = 3000`
   - `MAX_ERROR_RATE = 0.05` (5%)
2. WHEN a load test scenario's P95_Latency exceeds the defined threshold, THE Load_Test_Runner SHALL cause the Vitest test to fail with a descriptive message including the actual P95 value and the threshold.
3. WHEN a load test scenario's Error_Rate exceeds `MAX_ERROR_RATE` (including cases where the calculated rate exceeds 100% due to unexpected errors), THE Load_Test_Runner SHALL cause the Vitest test to fail with a message listing the count of failed requests and their HTTP status codes.
4. THE Load_Test_Runner SHALL use Vitest `expect` assertions for all threshold checks so that failures appear in the standard Vitest test report.
5. WHERE the environment variable `LOAD_TEST_THRESHOLDS_ENABLED` is set to `"false"`, THE Load_Test_Runner SHALL log threshold violations as warnings instead of failing the test (to allow running in resource-constrained CI environments).

---

### Requirement 8: CI/CD Integration

**User Story:** As a developer, I want load tests to run in the CI/CD pipeline without manual setup, so that performance regressions are caught automatically on every pull request.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL run using the existing `npm run test:run` command (`vitest run`) without any additional configuration.
2. THE Load_Test_Runner SHALL use `MongoMemoryReplSet` so that no external MongoDB instance is required in CI.
3. THE Load_Test_Runner SHALL complete all load test scenarios within 120 seconds total to fit within typical CI job time limits.
4. WHEN the load test file is included in the Vitest `include` glob (`src/**/*.{test,spec}.{ts,js}`), THE Load_Test_Runner SHALL be automatically discovered and run.
5. WHERE the environment variable `SKIP_LOAD_TESTS` is set to the exact string `"true"`, THE Load_Test_Runner SHALL skip all load test scenarios using Vitest's `test.skipIf`; WHEN `SKIP_LOAD_TESTS` is unset, set to `"false"`, or set to any other value, THE Load_Test_Runner SHALL run all load test scenarios normally.
6. THE Load_Test_Runner SHALL produce a human-readable summary table at the end of the test run using `console.table`, showing all scenario results with their thresholds and pass/fail status.
7. IF any load test scenario fails due to a timeout exceeding 120000ms, THEN THE Load_Test_Runner SHALL log which scenario timed out and the number of requests that were in-flight at the time.

---

### Requirement 9: Role-Based Load Scenarios

**User Story:** As a developer, I want load tests to cover role-specific endpoints (admin vs. member), so that I can verify performance for all user types.

#### Acceptance Criteria

1. THE Load_Test_Runner SHALL include a `adminWriteScenario` that tests admin-only endpoints under load:
   - `POST /api/v1/groups` (create group) — 5 concurrent admin requests
   - `PATCH /api/v1/groups/posts/:postId/pin` (pin post) — 10 concurrent admin requests
   - `DELETE /api/v1/groups/:groupId/members/:userId` (kick member) — 5 concurrent admin requests
2. WHEN 5 Virtual_Users with SUPER_ADMIN role concurrently send `POST /api/v1/groups` requests, THE Group_API SHALL return HTTP 201 for all 5 requests.
3. WHEN 10 Virtual_Users with SUPER_ADMIN role concurrently send `PATCH /api/v1/groups/posts/:postId/pin` requests on different posts, THE Group_API SHALL return HTTP 200 for all 10 requests.
4. THE Load_Test_Runner SHALL verify that non-admin users (BROTHER/SISTER role) receive HTTP 403 when attempting admin-only endpoints under load, confirming authorization is not bypassed under concurrent conditions.
5. WHEN 20 Virtual_Users with BROTHER role concurrently attempt `POST /api/v1/groups` (admin-only), THE Group_API SHALL return HTTP 403 for all 20 requests; IF any request returns a status other than 403 (including HTTP 200 or 201), THEN THE Load_Test_Runner SHALL fail the test, confirming authorization is strictly enforced under concurrent conditions.

---

### Requirement 10: Round-Trip Data Integrity Under Load

**User Story:** As a developer, I want to verify that data written under concurrent load can be correctly read back, so that I know there are no race conditions or data corruption issues.

#### Acceptance Criteria

1. FOR ALL posts created during the concurrent write load test, THE Group_API SHALL return each post when `GET /api/v1/groups/:groupId/posts` is called after the load test completes (round-trip property: write then read returns same data).
2. FOR ALL comments created during the concurrent comment load test, THE Group_API SHALL return each comment when `GET /api/v1/groups/posts/:postId/comments` is called after the load test completes.
3. WHEN a Virtual_User toggles like on a post twice (like → unlike), THE Group_API SHALL return `likesCount` equal to the original value (idempotence property: double-toggle restores original state).
4. WHEN 10 Virtual_Users concurrently toggle like on the same post (all liking for the first time), THE Group_API SHALL reflect a final `likesCount` of exactly 10 with no over-counting or under-counting (no race condition).
5. THE Load_Test_Runner SHALL assert data integrity by comparing the count of successfully created resources (from HTTP 201 responses) against the count returned by the corresponding list/feed endpoint after load completes.
