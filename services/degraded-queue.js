const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, '..', 'data', 'degraded');
const QUEUE_FILE = path.join(QUEUE_DIR, 'failed-work.ndjson');

function appendFailedWork(type, payload, errorMessage) {
  try {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
    const row = {
      ts: new Date().toISOString(),
      type,
      payload,
      error: errorMessage || null,
    };
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(row) + '\n', 'utf8');
  } catch (err) {
    console.error('[degraded-queue] append failed:', err.message);
  }
}

module.exports = {
  appendFailedWork,
};
