const crypto = require('crypto');
const cfg = require('./config');

// Passordhash-format: <salt-hex>.<scrypt-hash-hex> (64 byte, standard N/r/p)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}.${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split('.');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const sessions = new Map(); // token -> utløpstid (ms)
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function validSession(token) {
  if (!token) return false;
  const expires = sessions.get(token);
  if (!expires) return false;
  if (Date.now() > expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  sessions.delete(token);
}

// Enkel brute force-brems: maks 5 innloggingsforsøk per IP per 15 min
const attempts = new Map();
function loginAllowed(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.reset) {
    attempts.set(ip, { count: 0, reset: now + 15 * 60 * 1000 });
    return true;
  }
  return a.count < 5;
}
function registerAttempt(ip) {
  const a = attempts.get(ip);
  if (a) a.count += 1;
}

function requireAdmin(req, res, next) {
  if (validSession(req.cookies?.sid)) return next();
  return res.redirect('/admin/login');
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  validSession,
  destroySession,
  loginAllowed,
  registerAttempt,
  requireAdmin,
  adminConfigured: () => Boolean(cfg.adminPasswordHash)
};

// CLI: node src/auth.js hash "passordet"
if (require.main === module && process.argv[2] === 'hash') {
  console.log(hashPassword(process.argv[3] || ''));
}
