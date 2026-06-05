const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { PAYMENT_GATEWAY_TOKEN, PAYMENT_GATEWAY_URL, REDIRECT_URL, WEBHOOK_SECRET } = require('../config');

const router = express.Router();

router.post(
  '/create',
  authenticate,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
    body('order_id').trim().notEmpty().withMessage('Order ID is required'),
    body('remark').trim().optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { amount, order_id, remark } = req.body;
    const existing = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order_id);
    if (existing) {
      return res.status(200).json({ success: true, message: 'Order already exists', payment: existing });
    }

    const order = db.prepare(`
      INSERT INTO payments (order_id, user_id, amount, reference, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(order_id, req.user.id, parseFloat(amount), `order-${order_id}`, remark || 'Payment');

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(order.lastInsertRowid);

    try {
      const payload = new URLSearchParams();
      payload.append('user_token', PAYMENT_GATEWAY_TOKEN);
      payload.append('amount', amount);
      payload.append('order_id', order_id);
      payload.append('customer_mobile', req.user.mobile || '0000000000');
      payload.append('redirect_url', `${REDIRECT_URL}/payment-result?status=success&order_id=${order_id}`);
      payload.append('remark1', 'system@blackbuck');
      payload.append('remark2', remark || 'BlackBuck payment');

      const gatewayRes = await axios.post(PAYMENT_GATEWAY_URL, payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
      });

      const gatewayText = JSON.stringify(gatewayRes.data);
      db.prepare('UPDATE payments SET gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(gatewayText, payment.id);

      const savedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
      return res.json({ success: true, payment: savedPayment, gateway: gatewayRes.data });
    } catch (error) {
      const errorBody = error.response ? error.response.data : { message: error.message };
      db.prepare('UPDATE payments SET gateway_response = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(errorBody), 'failed', payment.id);
      return res.status(502).json({ success: false, message: 'Payment gateway communication failed', error: errorBody });
    }
  }
);

router.post(
  '/verify',
  authenticate,
  [
    body('order_id').trim().notEmpty().withMessage('Order ID is required'),
    body('status').trim().isIn(['success', 'failed']).withMessage('Status must be success or failed'),
    body('transaction_id').trim().optional(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { order_id, status, transaction_id } = req.body;

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(order_id, req.user.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }
    if (payment.status === 'success') {
      return res.json({ success: true, message: 'Payment already verified', payment });
    }

    const updatedStatus = status === 'success' ? 'success' : 'failed';
    db.prepare('UPDATE payments SET status = ?, reference = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(updatedStatus, transaction_id || payment.reference, payment.id);

    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
    res.json({ success: true, payment: updated });
  }
);

router.get('/', authenticate, (req, res) => {
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ success: true, payments });
});

router.get('/:order_id', authenticate, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(req.params.order_id, req.user.id);
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  res.json({ success: true, payment });
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-payment-signature'];
  const payload = req.body;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

  if (!signature || signature !== expected) {
    return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
  }

  const parsed = JSON.parse(payload.toString('utf8'));
  const { order_id, status, transaction_id, amount } = parsed;
  if (!order_id || !status) {
    return res.status(400).json({ success: false, message: 'Missing webhook payload fields' });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order_id);
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment order not found' });
  }

  if (payment.status === 'success') {
    return res.json({ success: true, message: 'Webhook already processed' });
  }

  const updatedStatus = status === 'success' ? 'success' : 'failed';
  db.prepare('UPDATE payments SET status = ?, gateway_response = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(updatedStatus, JSON.stringify(parsed), payment.id);

  res.json({ success: true, message: 'Webhook processed' });
});

module.exports = router;
