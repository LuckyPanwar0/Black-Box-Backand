const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_ROLE } = require('./config');

const databaseDir = path.resolve(__dirname, '..', 'database');
const databasePath = path.resolve(databaseDir, 'app.db');

if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const db = new Database(databasePath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password_hash TEXT,
  mobile TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'user',
  wallet_balance REAL DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE,
  user_id INTEGER,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending',
  gateway TEXT DEFAULT 'imb',
  gateway_response TEXT,
  reference TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  reference TEXT UNIQUE,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  signature TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!adminUser) {
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, name, role, wallet_balance)
    VALUES (?, ?, ?, ?, ?)
  `).run(ADMIN_USERNAME, passwordHash, 'Super Admin', ADMIN_ROLE, 0);
  console.log('Seeded admin user:', ADMIN_USERNAME);
}

module.exports = db;
