const { requireAuth } = require('./_lib/auth');
const { syncAll, initDB } = require('./_lib/sync');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Allow Vercel cron (Authorization: Bearer <CRON_SECRET>) or authenticated users
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  if (!isCron && !requireAuth(req, res)) return;

  try {
    await initDB();
    const result = await syncAll();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Sync failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
