// Enkel klient mot GitHub Contents API. Innhald og opplasta bilete blir lagra
// på ei eiga grein (CONTENT_BRANCH) slik at lagringar IKKJE utløyser ny deploy
// på Render (som berre følgjer main). Dette gir gratis persistens som
// overlever både omstart og redeploy på Render sin gratisplan.
const cfg = require('./config');

const API = 'https://api.github.com';

function enabled() {
  return Boolean(cfg.github.token && cfg.github.repo);
}

async function gh(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.github.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mesterbygg-stryn-cms',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${method} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function ensureBranch() {
  if (!enabled()) return false;
  const { repo, branch } = cfg.github;
  const existing = await gh('GET', `/repos/${repo}/branches/${encodeURIComponent(branch)}`);
  if (existing) return true;
  const repoInfo = await gh('GET', `/repos/${repo}`);
  if (!repoInfo) throw new Error(`Finn ikkje repo ${repo}`);
  const base = await gh('GET', `/repos/${repo}/branches/${encodeURIComponent(repoInfo.default_branch)}`);
  await gh('POST', `/repos/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: base.commit.sha
  });
  return true;
}

async function getFile(path) {
  if (!enabled()) return null;
  const { repo, branch } = cfg.github;
  const data = await gh('GET', `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (!data || Array.isArray(data)) return null;
  return { sha: data.sha, buffer: Buffer.from(data.content, 'base64') };
}

async function listDir(path) {
  if (!enabled()) return [];
  const { repo, branch } = cfg.github;
  const data = await gh('GET', `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (!data || !Array.isArray(data)) return [];
  return data.filter((f) => f.type === 'file').map((f) => ({ name: f.name, sha: f.sha }));
}

async function putFile(path, buffer, message) {
  if (!enabled()) return false;
  const { repo, branch } = cfg.github;
  const existing = await getFile(path).catch(() => null);
  await gh('PUT', `/repos/${repo}/contents/${path}`, {
    message,
    branch,
    content: buffer.toString('base64'),
    ...(existing ? { sha: existing.sha } : {})
  });
  return true;
}

async function deleteFile(path, message) {
  if (!enabled()) return false;
  const { repo, branch } = cfg.github;
  const existing = await getFile(path).catch(() => null);
  if (!existing) return false;
  await gh('DELETE', `/repos/${repo}/contents/${path}`, {
    message,
    branch,
    sha: existing.sha
  });
  return true;
}

module.exports = { enabled, ensureBranch, getFile, putFile, deleteFile, listDir };
