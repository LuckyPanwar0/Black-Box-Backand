const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../db');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, mobile, name, role, wallet_balance, blocked FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.blocked) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

function authorize(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.role !== role && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin privileges required' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
