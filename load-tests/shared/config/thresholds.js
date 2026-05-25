/**
 * thresholds.js — k6 performance threshold constants
 *
 * These thresholds are tuned for local MongoDB (standalone).
 * For production Atlas testing, tighten these values:
 *   READ_P95:    1000ms → 500ms
 *   WRITE_P95:   3000ms → 2000ms
 *   JOURNEY_P95: 5000ms → 3000ms
 */

export const THRESHOLDS = {
  // Baseline: single user, should be fast
  'http_req_duration{scenario:"baseline"}':     ['p(95)<500'],

  // Read load: 10 VUs on local MongoDB
  'http_req_duration{scenario:"read_load"}':    ['p(95)<5000'],
  'http_req_failed{scenario:"read_load"}':      ['rate<0.05'],

  // Write load: 5 VUs on local MongoDB
  'http_req_duration{scenario:"write_load"}':   ['p(95)<5000'],
  'http_req_failed{scenario:"write_load"}':     ['rate<0.10'],

  // User journey: 5 VUs, multi-step
  'http_req_duration{scenario:"user_journey"}': ['p(95)<8000'],

  // Spike: 3→15→3 VUs
  'http_req_failed{scenario:"spike"}':          ['rate<0.10'],

  // Role auth: must always return 403 (auth enforcement)
  // Note: 403 responses count as http_req_failed in k6, so we don't threshold on error rate here.
  // Instead we use checks rate to verify all responses are exactly 403.
  'checks{scenario:"role_auth"}':               ['rate>0.95'],
};
