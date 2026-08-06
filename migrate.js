/**
 * Database Migration Runner
 *
 * Runs on every deploy via `npm run build`.
 *
 * How it works:
 * 1. Creates core tables (users, _migrations) - always runs, idempotent
 * 2. Reads migrations from migrations/ folder
 * 3. Runs new migrations in order (tracked in _migrations table)
 *
 * Migration file formats:
 *   .js  — module.exports = { name, up: async (client) => {} }
 *   .sql — raw SQL executed directly (tracked by filename)
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set; skipping database migrations for this build.');
  process.exit(0);
}

// Mirrors the TLS policy in db/index.js — migrations carry the same user data
// as the app and must not connect to an unauthenticated server.
const isLocal = /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== '1' },
});

async function migrate() {
  console.log('Running migrations...');

  const client = await pool.connect();
  try {
    // 1. Create migration tracking table (always first)
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Core tables (idempotent - safe to run every time)
    await runCoreMigrations(client);

    // 3. Run migrations from migrations/ folder
    await runFolderMigrations(client);

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Core tables that every app needs.
 * These use CREATE IF NOT EXISTS so they're safe to run repeatedly.
 */
async function runCoreMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      password_hash VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      stripe_subscription_id VARCHAR(255),
      subscription_status VARCHAR(50),
      subscription_plan VARCHAR(255),
      subscription_expires_at TIMESTAMPTZ,
      subscription_updated_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email))
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx ON users (stripe_subscription_id)
  `);
}

/**
 * Run migrations from migrations/ folder.
 * Each migration runs once and is tracked in _migrations table.
 */
async function runFolderMigrations(client) {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    return;
  }

  const applied = await client.query('SELECT name FROM _migrations');
  const appliedNames = new Set(applied.rows.map(r => r.name));

  for (const file of files) {
    const isJs = file.endsWith('.js');
    let name;
    if (isJs) {
      const m = require(path.join(migrationsDir, file));
      name = m.name || file.replace(/\//g, '');
    } else {
      name = file; // SQL files have no name property — use filename
    }

    if (appliedNames.has(name)) {
      continue;
    }

    console.log(`Running migration: ${name}`);

    try {
      await client.query('BEGIN');
      const fullPath = path.join(migrationsDir, file);

      if (isJs) {
        const m = require(fullPath);
        if (m.up) {
          await m.up(client);
        }
      } else {
        const sql = fs.readFileSync(fullPath, 'utf8');
        await client.query(sql);
      }

      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Migration complete: ${name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed (${name}): ${err.message}`);
    }
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});