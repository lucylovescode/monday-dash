const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    idleTimeoutMillis: 240_000,
    connectionTimeoutMillis: 10_000
  });
  return pool;
}

module.exports = { getPool };
