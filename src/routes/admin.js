const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/summary', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalPayments = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
  const revenue = db.prepare('SELECT SUM(amount) as total FROM payments WHERE status = ?').get('success').total || 0;
  const walletCredits = db.prepare('SELECT SUM(amount) as total FROM wallet_transactions WHERE type = ?').get('credit').total || 0;
  const walletDebits = db.prepare('SELECT SUM(amount) as total FROM wallet_transactions WHERE type = ?').get('debit').total || 0;

  res.json({
    success: true,
    data: { totalUsers, totalPayments, revenue, walletCredits, walletDebits },
  });
});

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, mobile, name, role, wallet_balance, blocked, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, users });
});

router.get('/payments', (req, res) => {
  const payments = db.prepare('SELECT p.*, u.username, u.mobile, u.name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC').all();
  res.json({ success: true, payments });
});

router.post('/users/:userId/block', (req, res) => {
  const { userId } = req.params;
  db.prepare('UPDATE users SET blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  res.json({ success: true, message: 'User blocked' });
});

router.post('/users/:userId/unblock', (req, res) => {
  const { userId } = req.params;
  db.prepare('UPDATE users SET blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  res.json({ success: true, message: 'User unblocked' });
});

router.delete('/users/:userId', (req, res) => {
  const { userId } = req.params;
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ success: true, message: 'User deleted' });
});

module.exports = router;
