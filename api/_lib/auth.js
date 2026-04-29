const jwt = require('jsonwebtoken');

const COOKIE = 'auth_token';

function signToken(user) {
  return jwt.sign(user, process.env.SESSION_SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
  try { return jwt.verify(token, process.env.SESSION_SECRET); }
  catch { return null; }
}

function parseCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').find(c => c.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : null;
}

function getUser(req) {
  const token = parseCookie(req.headers.cookie, COOKIE);
  return token ? verifyToken(token) : null;
}

function setAuthCookie(res, user) {
  const token = signToken(user);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${8 * 3600}${secure}`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return user;
}

module.exports = { getUser, setAuthCookie, clearAuthCookie, requireAuth };
