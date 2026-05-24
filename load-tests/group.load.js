/**
 * group.load.js — Main k6 entry point for Group API load testing
 *
 * Usage:
 *   npm run load:test    → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:report  → k6 run (HTML report only)
 *   npm run load:ci      → k6 run --out json=... (CI/CD, exits 99 on threshold breach)
 *
 * Prerequisites:
 *   1. npm run load:seed  (creates fixtures.json)
 *   2. npm run dev        (starts the Express server)
 */

import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import { THRESHOLDS } from './config/thresholds.js';

// Import exec functions — k6 requires them to be exported from the main file
import { runBaseline } from './scenarios/baseline.js';
import { runReadLoad } from './scenarios/read-load.js';
import { runWriteLoad } from './scenarios/write-load.js';
import { runUserJourney } from './scenarios/user-journey.js';
import { runSpike } from './scenarios/spike.js';
import { runRoleAuth } from './scenarios/role-auth.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runReadLoad, runWriteLoad, runUserJourney, runSpike, runRoleAuth };

// ── Shared fixture data ───────────────────────────────────────────────────────
export const fixtures = new SharedArray('fixtures', function () {
  return [JSON.parse(open('./fixtures.json'))];
})[0];

// ── Custom metrics ────────────────────────────────────────────────────────────
export const readCheckFailures = new Counter('read_check_failures');
export const authBypassCount = new Counter('auth_bypass_count');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    baseline: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      exec: 'runBaseline',
      startTime: '0s',
    },
    read_load: {
      executor: 'constant-vus',
      vus: 10,       // reduced from 50 for local MongoDB
      duration: '30s',
      exec: 'runReadLoad',
      startTime: '5s',
    },
    write_load: {
      executor: 'constant-vus',
      vus: 5,        // reduced from 20 for local MongoDB
      duration: '30s',
      exec: 'runWriteLoad',
      startTime: '5s',
    },
    user_journey: {
      executor: 'constant-vus',
      vus: 5,        // reduced from 10 for local MongoDB
      duration: '30s',
      exec: 'runUserJourney',
      startTime: '5s',
    },
    role_auth: {
      executor: 'constant-vus',
      vus: 5,        // reduced from 20 for local MongoDB
      duration: '10s',
      exec: 'runRoleAuth',
      startTime: '5s',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 3 },   // reduced from 5
        { duration: '10s', target: 15 }, // reduced from 50
        { duration: '5s', target: 3 },   // reduced from 5
      ],
      exec: 'runSpike',
      startTime: '40s',
    },
  },
  thresholds: { ...THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── HTML report + stdout summary ──────────────────────────────────────────────
export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
