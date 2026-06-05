const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

const router = express.Router();
const otpStore = new Map();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }
    if (user.blocked) {
      return res.status(403).json({ success: false, message: 'User is blocked' });
    }
    const token = createToken(user);
    res.json({ success: true, user: { id: user.id, username: user.username, mobile: user.mobile, name: user.name, role: user.role, wallet_balance: user.wallet_balance }, token });
  }
);

router.post(
  '/otp/send',
  [body('mobile').trim().isLength({ min: 10, max: 10 }).withMessage('Valid mobile number required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { mobile } = req.body;
    const otp = generateOTP();
    otpStore.set(mobile, { otp, expires: Date.now() + 5 * 60 * 1000 });
    console.log(`[AUTH] Sending OTP ${otp} to +91${mobile}`);
    res.json({ success: true, message: 'OTP sent successfully (server console)' });
  }
);

router.post(
  '/otp/verify',
  [
    body('mobile').trim().isLength({ min: 10, max: 10 }).withMessage('Valid mobile number required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { mobile, otp } = req.body;
    const stored = otpStore.get(mobile);
    if (!stored || stored.expires < Date.now()) {
      otpStore.delete(mobile);
      return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
    }
    if (stored.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    otpStore.delete(mobile);

    let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (!user) {
      user = db.prepare('INSERT INTO users (mobile, name, role, wallet_balance) VALUES (?, ?, ?, ?)')
        .run(mobile, `User ${mobile.slice(-4)}`, 'user', 0);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.lastInsertRowid);
    }
    if (user.blocked) {
      return res.status(403).json({ success: false, message: 'User is blocked' });
    }
    const token = createToken(user);
    res.json({ success: true, user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, wallet_balance: user.wallet_balance }, token });
  }
);

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, mobile, name, role, wallet_balance, blocked FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.blocked) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, user });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
