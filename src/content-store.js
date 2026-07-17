// Innhaldslager med tre moglege backend-ar, i prioritert rekkjefølgje:
//  1. Postgres (DATABASE_URL sett) – innhald, bilete og førespurnader i database.
//     Overlever omstart OG redeploy på Render. Tilrådd i produksjon.
//  2. GitHub (GITHUB_TOKEN + GITHUB_REPO) – innhald/bilete på eiga grein via API.
//  3. Berre lokale filer – for lokal utvikling (mistast ved redeploy i skya).
// Førespurnader (persondata) blir ALDRI lagra i GitHub – berre i database/lokalt.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const github = require('./github-store');
const db = require('./db-store');

const CONTENT_FILE = 'content.json';
const SUBMISSIONS_FILE = path.join(cfg.localDir, 'submissions.json');

let content = null;
const imageCache = new Map(); // filnamn -> buffer (lite tal bilete, ok i minne)

function seedPath() {
  return path.join(cfg.contentDir, CONTENT_FILE);
}
function localPath() {
  return path.join(cfg.localDir, CONTENT_FILE);
}

function backendName() {
  if (db.enabled()) return 'postgres';
  if (github.enabled()) return 'github';
  return 'lokal';
}

async function initContent() {
  fs.mkdirSync(cfg.uploadsDir, { recursive: true });

  if (db.enabled()) {
    await db.init();
    content = await db.loadContent();
    if (!content) {
      content = JSON.parse(fs.readFileSync(seedPath(), 'utf8'));
      await db.saveContentDb(content);
    }
    console.log('Innhald lasta frå Postgres.');
    return;
  }

  if (github.enabled()) {
    try {
      await github.ensureBranch();
      const remote = await github.getFile(CONTENT_FILE);
      if (remote) {
        fs.writeFileSync(localPath(), remote.buffer);
      } else {
        const seed = fs.readFileSync(seedPath());
        fs.writeFileSync(localPath(), seed);
        await github.putFile(CONTENT_FILE, seed, 'Startinnhald frå seed');
      }
      const files = await github.listDir('uploads');
      for (const f of files) {
        const local = path.join(cfg.uploadsDir, f.name);
        if (!fs.existsSync(local)) {
          const remoteFile = await github.getFile(`uploads/${f.name}`);
          if (remoteFile) fs.writeFileSync(local, remoteFile.buffer);
        }
      }
      console.log(`Innhald synkronisert frå GitHub (${cfg.github.repo}@${cfg.github.branch})`);
    } catch (err) {
      console.error('GitHub-synk feila, brukar lokalt/seed-innhald:', err.message);
      if (!fs.existsSync(localPath())) fs.copyFileSync(seedPath(), localPath());
    }
  } else {
    if (!fs.existsSync(localPath())) fs.copyFileSync(seedPath(), localPath());
    console.log('Verken database eller GitHub konfigurert – innhald blir berre lagra lokalt (mistast ved redeploy).');
  }

  content = JSON.parse(fs.readFileSync(localPath(), 'utf8'));
}

function getContent() {
  return content;
}

async function saveContent() {
  if (db.enabled()) {
    await db.saveContentDb(content);
    return;
  }
  const buf = Buffer.from(JSON.stringify(content, null, 2));
  fs.writeFileSync(localPath(), buf);
  if (github.enabled()) {
    try {
      await github.putFile(CONTENT_FILE, buf, 'Innhaldsendring frå admin');
    } catch (err) {
      console.error('Klarte ikkje lagre innhald til GitHub:', err.message);
      throw new Error('Endringa er lagra mellombels, men langtidslagringa (GitHub) feila. Prøv igjen.');
    }
  }
}

async function saveUpload(filename, buffer) {
  if (db.enabled()) {
    await db.saveImage(filename, buffer);
    imageCache.set(filename, buffer);
    return;
  }
  fs.writeFileSync(path.join(cfg.uploadsDir, filename), buffer);
  if (github.enabled()) {
    await github.putFile(`uploads/${filename}`, buffer, `Lasta opp ${filename}`);
  }
}

async function getUpload(filename) {
  if (db.enabled()) {
    if (imageCache.has(filename)) return imageCache.get(filename);
    const buf = await db.getImage(filename);
    if (buf) imageCache.set(filename, buf);
    return buf;
  }
  const p = path.join(cfg.uploadsDir, filename);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

async function deleteUpload(filename) {
  imageCache.delete(filename);
  if (db.enabled()) {
    await db.deleteImage(filename);
    return;
  }
  const p = path.join(cfg.uploadsDir, filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  if (github.enabled()) {
    await github.deleteFile(`uploads/${filename}`, `Sletta ${filename}`).catch(() => {});
  }
}

// ---------- Førespurnader (persondata – aldri til GitHub) ----------

function loadSubmissionsLocal() {
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function loadSubmissions() {
  if (db.enabled()) return db.listSubmissions();
  return loadSubmissionsLocal();
}

async function addSubmission(sub) {
  if (db.enabled()) return db.addSubmissionDb(sub);
  const list = loadSubmissionsLocal();
  list.unshift(sub);
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list.slice(0, 500), null, 2));
}

async function deleteSubmission(id) {
  if (db.enabled()) return db.deleteSubmissionDb(id);
  const list = loadSubmissionsLocal().filter((s) => s.id !== id);
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2));
}

module.exports = {
  initContent,
  getContent,
  saveContent,
  saveUpload,
  getUpload,
  deleteUpload,
  loadSubmissions,
  addSubmission,
  deleteSubmission,
  backendName
};
