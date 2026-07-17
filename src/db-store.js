// Postgres-lagring (Render gratis-Postgres). Held innhald, bilete og
// førespurnader i databasen slik at alt overlever omstart og redeploy.
// Blir brukt når DATABASE_URL er sett.
const { Pool } = require('pg');

let pool = null;

function enabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    // Render sine interne vertsnamn (*.internal) treng ikkje TLS; eksterne gjer det
    const needSsl = !/\.internal[:/]/.test(url) && !/localhost|127\.0\.0\.1/.test(url);
    pool = new Pool({ connectionString: url, ssl: needSsl ? { rejectUnauthorized: false } : false, max: 5 });
  }
  return pool;
}

async function init() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS innhald (
      id int PRIMARY KEY,
      data jsonb NOT NULL,
      oppdatert timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS bilete (
      fil text PRIMARY KEY,
      data bytea NOT NULL,
      lasta_opp timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS forespurnader (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      motteke timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function loadContent() {
  const res = await getPool().query('SELECT data FROM innhald WHERE id = 1');
  return res.rows[0] ? res.rows[0].data : null;
}

async function saveContentDb(content) {
  await getPool().query(
    `INSERT INTO innhald (id, data, oppdatert) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = $1, oppdatert = now()`,
    [JSON.stringify(content)]
  );
}

async function saveImage(fil, buffer) {
  await getPool().query(
    `INSERT INTO bilete (fil, data) VALUES ($1, $2)
     ON CONFLICT (fil) DO UPDATE SET data = $2`,
    [fil, buffer]
  );
}

async function getImage(fil) {
  const res = await getPool().query('SELECT data FROM bilete WHERE fil = $1', [fil]);
  return res.rows[0] ? res.rows[0].data : null;
}

async function deleteImage(fil) {
  await getPool().query('DELETE FROM bilete WHERE fil = $1', [fil]);
}

async function addSubmissionDb(sub) {
  await getPool().query('INSERT INTO forespurnader (id, data) VALUES ($1, $2)', [sub.id, JSON.stringify(sub)]);
}

async function listSubmissions() {
  const res = await getPool().query('SELECT data FROM forespurnader ORDER BY motteke DESC LIMIT 500');
  return res.rows.map((r) => r.data);
}

async function deleteSubmissionDb(id) {
  await getPool().query('DELETE FROM forespurnader WHERE id = $1', [id]);
}

module.exports = {
  enabled,
  init,
  loadContent,
  saveContentDb,
  saveImage,
  getImage,
  deleteImage,
  addSubmissionDb,
  listSubmissions,
  deleteSubmissionDb
};
