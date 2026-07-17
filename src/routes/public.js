const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cfg = require('../config');
const { getContent, addSubmission, getUpload } = require('../content-store');
const { sendContactMail, smtpConfigured } = require('../mailer');

const router = express.Router();

function seo(page) {
  const c = getContent();
  return c.seo[page] || { tittel: c.site.namn, beskriving: '' };
}

router.get('/', (req, res) => {
  res.render('index', { seo: seo('heim') });
});

router.get('/tenester', (req, res) => {
  res.render('tenester', { seo: seo('tenester') });
});

router.get('/tenester/:slug', (req, res, next) => {
  const teneste = getContent().tenester.find((t) => t.slug === req.params.slug);
  if (!teneste) return next();
  res.render('teneste', {
    teneste,
    seo: {
      tittel: `${teneste.tittel} – Mesterbygg Stryn AS`,
      beskriving: teneste.kort
    }
  });
});

router.get('/prosjekt', (req, res) => {
  res.render('prosjekt', { seo: seo('prosjekt') });
});

router.get('/om-oss', (req, res) => {
  res.render('om-oss', { seo: seo('omOss') });
});

router.get('/personvern', (req, res) => {
  res.render('personvern', { seo: seo('personvern'), smtpAktiv: smtpConfigured() });
});

router.get('/kontakt', (req, res) => {
  res.render('kontakt', {
    seo: seo('kontakt'),
    sendt: req.query.sendt === '1',
    feil: null,
    verdiar: {}
  });
});

// Enkel brems: maks 5 innsendingar per IP per time
const sendCount = new Map();
function contactAllowed(ip) {
  const now = Date.now();
  const s = sendCount.get(ip);
  if (!s || now > s.reset) {
    sendCount.set(ip, { count: 0, reset: now + 60 * 60 * 1000 });
    return true;
  }
  return s.count < 5;
}

router.post('/kontakt', async (req, res) => {
  const { namn = '', telefon = '', epost = '', melding = '', nettstad = '' } = req.body;

  // Honningkrukke: skjulte feltet "nettstad" skal vere tomt for menneske
  if (nettstad.trim() !== '') return res.redirect('/kontakt?sendt=1');

  const verdiar = { namn: namn.trim(), telefon: telefon.trim(), epost: epost.trim(), melding: melding.trim() };
  let feil = null;

  if (!verdiar.namn || !verdiar.melding) {
    feil = 'Fyll inn namn og melding.';
  } else if (!verdiar.telefon && !verdiar.epost) {
    feil = 'Oppgi telefonnummer eller e-postadresse, slik at vi kan nå deg.';
  } else if (verdiar.epost && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verdiar.epost)) {
    feil = 'E-postadressa ser ikkje gyldig ut.';
  } else if (!contactAllowed(req.ip)) {
    feil = 'For mange innsendingar på kort tid. Prøv igjen seinare, eller ring oss direkte.';
  }

  if (feil) {
    return res.status(400).render('kontakt', { seo: seo('kontakt'), sendt: false, feil, verdiar });
  }

  sendCount.get(req.ip).count += 1;

  const sub = {
    id: crypto.randomUUID(),
    ...verdiar,
    tidspunkt: new Date().toISOString(),
    epostSendt: false
  };

  try {
    sub.epostSendt = await sendContactMail(sub);
  } catch (err) {
    console.error('E-postsending feila:', err.message);
  }
  await addSubmission(sub);

  res.redirect('/kontakt?sendt=1');
});

// Opplasta bilete (admin) blir serverte herifrå
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
router.get('/media/:fil', async (req, res) => {
  const fil = path.basename(req.params.fil);
  const buf = await getUpload(fil).catch(() => null);
  if (!buf) return res.status(404).send('Fann ikkje fila.');
  res.set('Cache-Control', 'public, max-age=2592000');
  res.type(MIME[path.extname(fil).toLowerCase()] || 'application/octet-stream').send(buf);
});

router.get('/robots.txt', (req, res) => {
  const lines = ['User-agent: *'];
  if (cfg.sitePublic) {
    lines.push('Allow: /', `Sitemap: ${cfg.siteUrl}/sitemap.xml`);
  } else {
    // Demo-modus: la robotar hente sidene slik at dei ser noindex-metataggen
    lines.push('Allow: /');
  }
  lines.push('Disallow: /admin');
  res.type('text/plain').send(lines.join('\n'));
});

router.get('/sitemap.xml', (req, res) => {
  const c = getContent();
  const pages = ['/', '/tenester', '/prosjekt', '/om-oss', '/kontakt', '/personvern'].concat(
    c.tenester.map((t) => `/tenester/${t.slug}`)
  );
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((p) => `  <url><loc>${cfg.siteUrl}${p}</loc></url>`).join('\n') +
    '\n</urlset>';
  res.type('application/xml').send(xml);
});

module.exports = router;
