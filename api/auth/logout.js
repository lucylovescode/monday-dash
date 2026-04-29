const { clearAuthCookie } = require('../_lib/auth');

module.exports = function handler(req, res) {
  clearAuthCookie(res);
  res.redirect('/login');
};
