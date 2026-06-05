const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const user = db.prepare('SELECT id, wallet_balance FROM users WHERE id = ?').get(1);
  const transactions = db.prepare('SELECT id, type, amount, description, reference, status, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC').all(1);
  res.json({ success: true, wallet: { balance: user.wallet_balance, transactions } });
});

router.post(
  '/credit',
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
    body('reference').trim().notEmpty().withMessage('Reference is required'),
    body('description').trim().optional().isString(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { amount, reference, description } = req.body;
    const existingTxn = db.prepare('SELECT * FROM wallet_transactions WHERE reference = ?').get(reference);
    if (existingTxn) {
      return res.status(409).json({ success: false, message: 'Duplicate wallet transaction reference' });
    }

    db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description, reference, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(1, 'credit', amount, description || 'Wallet credit', reference, 'completed');

    db.prepare('UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(amount, 1);

    const walletRecord = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(1);
    res.json({ success: true, wallet: { balance: walletRecord.wallet_balance } });
  }
);

router.post(
  '/debit',
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
    body('reference').trim().notEmpty().withMessage('Reference is required'),
    body('description').trim().optional().isString(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { amount, reference, description } = req.body;
    const existingTxn = db.prepare('SELECT * FROM wallet_transactions WHERE reference = ?').get(reference);
    if (existingTxn) {
      return res.status(409).json({ success: false, message: 'Duplicate wallet transaction reference' });
    }

    const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(1);
    if (user.wallet_balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description, reference, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(1, 'debit', amount, description || 'Wallet debit', reference, 'completed');

    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(amount, 1);

    const wallet = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(1);
    res.json({ success: true, wallet });
  }
);

module.exports = router;
