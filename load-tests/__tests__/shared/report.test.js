import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createHandleSummary } from '../../shared/helpers/report.js';

/**
 * Feature: load-test-folder-restructure, Property 1: Report Path Construction
 *
 * For any valid kebab-case module name string, the createHandleSummary function
 * SHALL return a handleSummary function that produces an object with a key matching
 * `load-tests/reports/{moduleName}/report.html` and a `stdout` key. When the module
 * name is empty or undefined, the path SHALL fall back to `load-tests/reports/report.html`.
 *
 * **Validates: Requirements 3.3, 3.5, 6.1, 6.3**
 */
describe('Feature: load-test-folder-restructure, Property 1: Report Path Construction', () => {
  it('any kebab-case module name produces correct report path key', () => {
    const kebabCase = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);
    fc.assert(
      fc.property(kebabCase, (moduleName) => {
        const handleSummary = createHandleSummary(moduleName);
        const mockData = { metrics: { http_reqs: { count: 100 } } };
        const result = handleSummary(mockData);
        const expectedPath = `load-tests/reports/${moduleName}/report.html`;
        expect(result).toHaveProperty(expectedPath);
        expect(result).toHaveProperty('stdout');
      }),
      { numRuns: 100 }
    );
  });

  it('empty string falls back to root report path', () => {
    const handleSummary = createHandleSummary('');
    const mockData = { metrics: { http_reqs: { count: 50 } } };
    const result = handleSummary(mockData);
    expect(result).toHaveProperty('load-tests/reports/report.html');
    expect(result).toHaveProperty('stdout');
  });

  it('undefined falls back to root report path', () => {
    const handleSummary = createHandleSummary(undefined);
    const mockData = { metrics: { http_reqs: { count: 50 } } };
    const result = handleSummary(mockData);
    expect(result).toHaveProperty('load-tests/reports/report.html');
    expect(result).toHaveProperty('stdout');
  });
});
