/**
 * Database connection pool. Only this file may construct new Pool().
 *
 * Production note:
 * - With DATABASE_URL set, this exports a normal PostgreSQL pool.
 * - Without DATABASE_URL, the app boots in a guarded degraded mode so public
 *   pages and /health can render, but any DB-backed action fails explicitly.
 *   This prevents Render from serving the default placeholder while still
 *   protecting user/payment data until the real database URL is configured.
 */
const { Pool } = require('pg');

function databaseUnavailableError() {
  const err = new Error('DATABASE_URL environment variable is required for this database operation');
  err.code = 'DATABASE_UNAVAILABLE';
  err.status = 503;
  return err;
}

let pool;

if (!process.env.DATABASE_URL) {
  console.warn('[pg pool] DATABASE_URL is not set — starting in guarded degraded mode');
  pool = {
    query: async () => {
      throw databaseUnavailableError();
    },
    connect: async () => {
      throw databaseUnavailableError();
    },
    end: async () => undefined,
    on: () => undefined,
  };
} else {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL);

  // Azure Database for PostgreSQL presents a certificate chaining to a root
  // Node already trusts, so the connection is verified. Set
  // DATABASE_SSL_NO_VERIFY=1 only for a provider with a private CA — without
  // verification the session is encrypted but not authenticated.
  let ssl = false;
  if (!isLocal) {
    ssl = process.env.DATABASE_SSL_NO_VERIFY === '1'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true };
    if (process.env.DATABASE_SSL_NO_VERIFY === '1') {
      console.warn('[pg pool] TLS certificate verification disabled by DATABASE_SSL_NO_VERIFY');
    }
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: Number(process.env.PGPOOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Managed Postgres drops idle connections; the client emits 'error' on
  // reconnect failure. Log and keep running — the pool reconnects on next query.
  pool.on('error', (err) => {
    console.error('[pg pool] idle client error (non-fatal):', err?.message);
  });
}

module.exports = { pool };
