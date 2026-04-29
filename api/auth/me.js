const { getUser } = require('../_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
};
