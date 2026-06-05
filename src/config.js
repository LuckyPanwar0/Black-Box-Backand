const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const getRequired = (name, fallback = undefined) => {
  const value = process.env[name] || fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: getRequired('JWT_SECRET', 'change-me-to-a-strong-secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'SuperAdmin@123',
  ADMIN_ROLE: process.env.ADMIN_ROLE || 'super_admin',
  PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || 'https://secure-stage.imb.org.in/api/create-order',
  PAYMENT_GATEWAY_TOKEN: getRequired('PAYMENT_GATEWAY_TOKEN', '525593ce8133d2ccfadf4b0ddc9d8aa5'),
  REDIRECT_URL: process.env.REDIRECT_URL || 'http://localhost:5173',
  WEBHOOK_SECRET: getRequired('WEBHOOK_SECRET', 'webhook-secret-change-this'),
  CLIENT_ORIGIN,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};
