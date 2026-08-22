/**
 * Smoke test for jobs/*.js cron handlers.
 *
 * Goal: catch import-time regressions (typos, missing requires, broken module
 * exports) before they reach production, where they'd silently fail in a cron
 * schedule. This test does NOT exercise the email/Stripe/DB side effects — it
 * only validates structural contracts:
 *
 *   1. Each job module loads without throwing.
 *   2. Each job exports a `run` function.
 *   3. When DATABASE_URL is unset, the pool stub from db/index.js makes
 *      run() reject quickly with a recognizable error. This proves the job
 *      reaches the DB boundary without crashing earlier on a syntax / require
 *      failure.
 *
 * Run with: `node tests/jobs.test.js`
 */
'use strict';

const assert = require('assert');
const path = require('path');

// Force degraded-mode DB so no live connection is attempted. The pool stub
// in db/index.js throws { code: 'DATABASE_UNAVAILABLE' } on any .query() call.
delete process.env.DATABASE_URL;

const JOBS = [
  'abandoned-checkout',
  'detox-email',
  'dunning-email',
  'nurture-email',
  'verdict-monitor',
  'winback-email',
  'daily-site-health-check',
];

// Jobs that perform a network probe instead of a DB read on their first action.
// Their `run()` should still resolve (or reject for a non-DB reason) — we just
// assert no throw at import time and that `run` is a function.
const NETWORK_FIRST_JOBS = new Set(['verdict-monitor', 'daily-site-health-check']);

let failures = 0;
let passes = 0;

function record(name, ok, err) {
  if (ok) {
    passes++;
    console.log(`  PASS: ${name}`);
  } else {
    failures++;
    console.error(`  FAIL: ${name} — ${err?.message || err}`);
  }
}

async function testImports() {
  console.log('TEST: jobs/*.js modules import and expose run()');
  for (const job of JOBS) {
    try {
      const mod = require(path.join('..', 'jobs', job));
      assert.strictEqual(typeof mod.run, 'function', `${job}: module.exports.run must be a function`);
      record(job, true);
    } catch (err) {
      record(job, false, err);
    }
  }
}

async function testDbBoundary() {
  console.log('\nTEST: db-backed jobs reach the DB boundary in degraded mode');
  for (const job of JOBS) {
    if (NETWORK_FIRST_JOBS.has(job)) continue;
    const mod = require(path.join('..', 'jobs', job));
    try {
      await mod.run();
      // Some jobs catch their own errors and resolve (e.g. nurture-email logs
      // failures per row). Reaching here is acceptable — the import succeeded.
      record(`${job}.run() resolved without throwing`, true);
    } catch (err) {
      const isExpected =
        err.code === 'DATABASE_UNAVAILABLE' ||
        /DATABASE_URL/i.test(err.message || '');
      record(
        `${job}.run() rejected with ${isExpected ? 'expected' : 'unexpected'} error`,
        isExpected,
        isExpected ? null : err,
      );
    }
  }
}

async function testNetworkJobsRunnable() {
  console.log('\nTEST: network-first jobs are runnable (no import-time crash)');
  for (const job of JOBS) {
    if (!NETWORK_FIRST_JOBS.has(job)) continue;
    const mod = require(path.join('..', 'jobs', job));
    // Don't actually call run() — verdict-monitor would fire a real fetch.
    // Just confirm the module loaded and exposed run().
    record(`${job} module shape`, typeof mod.run === 'function');
  }
}

async function main() {
  console.log('Running jobs smoke tests\n');

  await testImports();
  await testDbBoundary();
  await testNetworkJobsRunnable();

  console.log('\n────────────────────────────────────');
  console.log(`${passes} passed, ${failures} failed`);

  if (failures > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
