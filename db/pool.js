/**
 * Compatibility export for modules that expect db/pool.js.
 * The canonical PostgreSQL pool is created in db/index.js.
 */
const { pool } = require('./index');

module.exports = pool;
