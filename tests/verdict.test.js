/**
 * Automated test suite for HoldOff verdict endpoints.
 * Boots the real app server, then exercises the public verdict APIs.
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = Number(process.env.TEST_PORT) || 4310;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
let serverProcess = null;

function request(method, requestPath, body, cookies = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(requestPath, BASE_URL);
    const bodyStr = body === undefined ? '' : JSON.stringify(body);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        } : {}),
        ...(cookies ? { Cookie: cookies } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(bodyStr);
    req.end();
  });
}

function post(requestPath, body, cookies = '') {
  return request('POST', requestPath, body, cookies);
}

function get(requestPath, cookies = '') {
  return request('GET', requestPath, undefined, cookies);
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function assertIn(value, allowed, message) {
  if (!allowed.includes(value)) {
    throw new Error(`ASSERTION FAILED: ${message} — got "${value}", expected one of [${allowed.join(', ')}]`);
  }
}

async function waitForServer(timeoutMs = 30000, exitedEarly = () => null) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // Without this the suite happily tests whatever else is listening on PORT.
    const code = exitedEarly();
    if (code !== null && code !== undefined) {
      throw new Error(`App server exited with code ${code} before becoming ready`);
    }
    try {
      const res = await get('/health');
      if (res.status === 200) return;
    } catch (_) {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the app server to start');
}

async function startServer() {
  serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'test_jwt_secret_at_least_32_chars',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  serverProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exitedEarly = null;
  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      exitedEarly = code;
      console.error(`Server exited early with code ${code}`);
      if (stderr) console.error(stderr);
    }
  });

  await waitForServer(30000, () => exitedEarly);
}

async function stopServer() {
  if (!serverProcess) return;
  serverProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    serverProcess.on('exit', resolve);
    setTimeout(resolve, 5000);
  });
  serverProcess = null;
}

async function testEmptyAnalyzeMessage() {
  console.log('TEST: Empty analyze message → 400');
  const res = await post('/api/filter/analyze', { message: '' });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(res.body.error && res.body.error.toLowerCase().includes('required'), `Expected error about message, got: ${JSON.stringify(res.body)}`);
  console.log('  PASS');
}

async function testMissingAnalyzeMessage() {
  console.log('TEST: Missing analyze message → 400');
  const res = await post('/api/filter/analyze', {});
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(res.body.error && res.body.error.toLowerCase().includes('required'), `Expected error about required field, got: ${JSON.stringify(res.body)}`);
  console.log('  PASS');
}

async function testValidAnalyzeMessage() {
  console.log('TEST: Valid analyze message → 200 + valid verdict object');
  const messages = [
    'are we okay',
    'i miss you so much',
    'why arent you answering me',
    'just wanted to say goodnight',
    'i hate that you always do this',
  ];

  for (const message of messages) {
    const res = await post('/api/filter/analyze', { message });
    assert(res.status === 200, `Message "${message}": expected 200, got ${res.status}`);
    assertIn(res.body.verdict, ['SEND', 'HOLD', 'REWRITE'], 'verdict');
    assert(res.body.feedback_text || res.body.whats_happening, `Message "${message}": missing feedback_text / whats_happening`);
    assert(res.body.pattern || res.body.pattern_name, `Message "${message}": missing pattern`);
    console.log(`  PASS: "${message}" → ${res.body.verdict}`);
  }
}

async function testLegacyVerdictRouteStillWorks() {
  console.log('TEST: Legacy /api/verdict route still returns recipient-read analysis');
  const res = await post('/api/verdict', { outgoingMessage: 'can we talk tonight?' });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.recipientRead, `Expected recipientRead, got: ${JSON.stringify(res.body)}`);
  assert(res.body.safetyLevel, `Expected safetyLevel, got: ${JSON.stringify(res.body)}`);
  assert(res.body.themeCode, `Expected themeCode, got: ${JSON.stringify(res.body)}`);
  console.log(`  PASS: safetyLevel=${res.body.safetyLevel}`);
}

async function testRateLimitEnforced() {
  console.log('TEST: /api/verdict rate limit → 429 on 31st request in a minute');
  // Earlier tests make one counted /api/verdict POST in the current window.
  // GET read endpoints are intentionally skipped by the write limiter.
  const results = await Promise.all(
    Array.from({ length: 29 }, (_, i) => post('/api/verdict', { outgoingMessage: `rate test ${i}` }))
  );
  const all200 = results.every((r) => r.status === 200);
  console.log(`  First 29 requests: ${all200 ? 'all 200 OK' : 'some non-200: ' + results.map((r) => r.status).join(', ')}`);
  const res = await post('/api/verdict', { outgoingMessage: 'rate limit test' });
  assert(res.status === 429, `Expected 429 on 31st request, got ${res.status}`);
  assert(res.body.code === 'RATE_LIMITED', `Expected code RATE_LIMITED, got: ${JSON.stringify(res.body)}`);
  console.log('  PASS');
}

async function testHistoryNeedsAuth() {
  console.log('TEST: GET /api/verdict/history without auth → 401');
  const res = await get('/api/verdict/history');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  console.log('  PASS');
}

async function testStreakNeedsAuth() {
  console.log('TEST: GET /api/verdict/streak without auth → 401');
  const res = await get('/api/verdict/streak');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  console.log('  PASS');
}

async function testInvalidVerdictTypeInHistory() {
  console.log('TEST: GET /api/verdict/history?verdict_type=INVALID → 400');
  const res = await get('/api/verdict/history?verdict_type=INVALID');
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  console.log('  PASS');
}

async function main() {
  console.log(`\nRunning verdict API tests against ${BASE_URL}\n`);
  const failures = [];

  try {
    await startServer();
  } catch (err) {
    console.error('Failed to boot app server:', err);
    process.exit(1);
  }

  const tests = [
    testEmptyAnalyzeMessage,
    testMissingAnalyzeMessage,
    testValidAnalyzeMessage,
    testHistoryNeedsAuth,
    testStreakNeedsAuth,
    testInvalidVerdictTypeInHistory,
    testLegacyVerdictRouteStillWorks,
    testRateLimitEnforced,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      console.error(`  FAIL: ${err.message}\n`);
      failures.push({ name: test.name, err });
    }
  }

  await stopServer();

  console.log('\n────────────────────────────────────');
  if (failures.length === 0) {
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }

  console.log(`${failures.length} TEST(S) FAILED:`);
  for (const { name, err } of failures) {
    console.log(`  - ${name}: ${err.message}`);
  }
  process.exit(1);
}

main().catch(async (err) => {
  console.error('Test runner error:', err);
  await stopServer();
  process.exit(1);
});
