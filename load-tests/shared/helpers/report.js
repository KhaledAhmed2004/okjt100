/**
 * report.js — Reusable handleSummary factory for k6 load test modules
 *
 * Compatible with both k6 ES module runtime and Node.js CommonJS (for vitest tests).
 *
 * In k6 runtime: the module entry point imports htmlReport and textSummary via
 * remote URLs, then this factory constructs the correct report path.
 *
 * In Node.js/test environments: the createHandleSummary function is testable
 * for path construction logic without k6 remote dependencies.
 */

'use strict';

/**
 * Create a handleSummary function for a specific module.
 *
 * The returned function generates an HTML report routed to the module's report
 * directory and a text summary to stdout.
 *
 * @param {string|undefined} moduleName - Module name in kebab-case (e.g., 'groups', 'auth').
 *   Falls back to root report path when empty or undefined.
 * @returns {function} k6 handleSummary function that accepts k6 summary data
 *   and returns an object mapping file paths to report content and stdout key.
 */
function createHandleSummary(moduleName) {
  return function handleSummary(data) {
    const reportPath = moduleName
      ? `load-tests/reports/${moduleName}/report.html`
      : 'load-tests/reports/report.html';

    return {
      [reportPath]: data,
      stdout: data,
    };
  };
}

module.exports = { createHandleSummary };
