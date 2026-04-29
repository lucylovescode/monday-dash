const { requireAuth } = require('./_lib/auth');
const { getPool } = require('./_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAuth(req, res)) return;

  try {
    const pool = getPool();
    const { rows: tasks } = await pool.query('SELECT * FROM monday_tasks');
    const { rows: [lastSync] } = await pool.query(
      'SELECT completed_at, item_count FROM syncs WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1'
    );
    res.json({ tasks, lastSync: lastSync || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
