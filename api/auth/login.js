module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const url = new URL('https://auth.monday.com/oauth2/authorize');
  url.searchParams.set('client_id', process.env.MONDAY_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/callback`);
  res.redirect(url.toString());
};
