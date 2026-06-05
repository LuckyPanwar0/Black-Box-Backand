const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { CLIENT_ORIGIN, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, NODE_ENV } = require('./config');
const paymentRoutes = require('./routes/payments');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');
const db = require('./db');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(morgan('combined'));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment-Signature'],
    credentials: true,
  })
);

app.use(rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', environment: NODE_ENV });
});

app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
