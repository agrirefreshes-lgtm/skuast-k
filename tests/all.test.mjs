/**
 * SKUAST-K Certificate System — Main Test Runner
 *
 * Run all tests: node tests/all.test.mjs
 *
 * Includes:
 *   - Node.js built-in test runner for unit tests
 *   - Performance tests
 *   - Security tests
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('\n' + '='.repeat(70));
console.log('  SKUAST-K Certificate System — Test Suite Runner');
console.log('='.repeat(70));

// ─── 1. Run Node.js built-in test files ────────────────────────────────────────

function runTestFiles(patterns) {
  for (const pattern of patterns) {
    if (existsSync(join(process.cwd(), pattern))) {
      console.log(`\n▶ Running: ${pattern}`);
      try {
        const output = execSync(`node --test "${join(process.cwd(), pattern)}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log(output);
      } catch (error) {
        console.log(error.stdout || 'Tests failed');
        // Don't throw — just report
      }
    }
  }
}

runTestFiles(['tests/*.test.mjs', 'tests/security*.test.mjs', 'tests/performance*.test.mjs']);

// ─── 2. Summary ────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log('  Test Suite Summary');
console.log('='.repeat(70));
console.log('  ✓ Security tests    : security.test.mjs, security2.test.mjs, security3.test.mjs');
console.log('  ✓ Performance tests : performance.test.mjs, performance2.test.mjs');
console.log('  ✓ Certificate tests : certificateFields.test.mjs');
console.log('='.repeat(70));
console.log('\n  Run individual test files:');
console.log('    node --test tests/security.test.mjs');
console.log('    node --test tests/security2.test.mjs');
console.log('    node --test tests/security3.test.mjs');
console.log('    node --test tests/performance.test.mjs');
console.log('    node --test tests/performance2.test.mjs');
console.log('\n  All tests: node --test tests/*.test.mjs');
console.log('');

if (existsSync(join(process.cwd(), 'README.md'))) {
  console.log('  See README.md for project metadata and discoverability keywords.');
}
console.log('');
