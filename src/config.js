const path = require('path');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..');

module.exports = {
  rootDir,
  contentDir: path.join(rootDir, 'content'),
  localDir: path.join(rootDir, 'content', 'local'),
  uploadsDir: path.join(rootDir, 'content', 'local', 'uploads'),

  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  // Demo-modus: sida er noindex til SITE_PUBLIC=1 blir sett (etter godkjenning frå bedrifta)
  sitePublic: process.env.SITE_PUBLIC === '1',

  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),

  github: {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || '',
    branch: process.env.CONTENT_BRANCH || 'innhald'
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    to: process.env.CONTACT_TO || ''
  }
};
