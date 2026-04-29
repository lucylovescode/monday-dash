const { setAuthCookie } = require('../_lib/auth');

const TRILOGY_ACCOUNT_ID = 26962871;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { code, error } = req.query;
  if (error || !code) return res.redirect('/login?error=denied');

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  try {
    const tokenRes = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.MONDAY_CLIENT_ID,
        client_secret: process.env.MONDAY_CLIENT_SECRET,
        code,
        redirect_uri:  `${appUrl}/api/auth/callback`,
        grant_type:    'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    // Decode JWT payload — Monday issued it, we can trust the account ID
    const payload = JSON.parse(Buffer.from(tokenData.access_token.split('.')[1], 'base64url').toString());

    if (Number(payload.actid) !== TRILOGY_ACCOUNT_ID) {
      return res.redirect('/login?error=wrong_account');
    }

    // Fetch name via service token
    let name = null, email = null;
    try {
      const r = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.MONDAY_API_TOKEN },
        body: JSON.stringify({ query: `query{users(ids:[${payload.uid}]){name email}}` })
      });
      const d = await r.json();
      name  = d.data?.users?.[0]?.name  || null;
      email = d.data?.users?.[0]?.email || null;
    } catch {}

    setAuthCookie(res, { id: String(payload.uid), name, email });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect('/login?error=auth_failed');
  }
};
