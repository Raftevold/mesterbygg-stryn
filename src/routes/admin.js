const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const cfg = require('../config');
const auth = require('../auth');
const {
  getContent,
  saveContent,
  saveUpload,
  deleteUpload,
  loadSubmissions,
  deleteSubmission,
  backendName
} = require('../content-store');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 10 }
});

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  console.warn('sharp er ikkje tilgjengeleg – bilete blir lagra utan optimalisering.');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'side';
}

function back(res, section, ok, feil) {
  const q = feil ? `feil=${encodeURIComponent(feil)}` : ok ? 'lagra=1' : '';
  res.redirect(`/admin/${section}${q ? '?' + q : ''}${section.includes('#') ? '' : ''}`);
}

async function trySave(res, section, mutate) {
  try {
    mutate(getContent());
    await saveContent();
    back(res, section, true);
  } catch (err) {
    back(res, section, false, err.message);
  }
}

// ---------- Innlogging ----------

router.get('/login', (req, res) => {
  if (auth.validSession(req.cookies?.sid)) return res.redirect('/admin');
  res.render('admin/login', { feil: null, konfigurert: auth.adminConfigured() });
});

router.post('/login', (req, res) => {
  if (!auth.adminConfigured()) {
    return res.render('admin/login', { feil: 'Admin er ikkje konfigurert (ADMIN_PASSWORD_HASH manglar).', konfigurert: false });
  }
  if (!auth.loginAllowed(req.ip)) {
    return res.status(429).render('admin/login', { feil: 'For mange forsøk. Vent 15 minutt.', konfigurert: true });
  }
  auth.registerAttempt(req.ip);
  if (!auth.verifyPassword(req.body.passord || '', cfg.adminPasswordHash)) {
    return res.status(401).render('admin/login', { feil: 'Feil passord.', konfigurert: true });
  }
  const token = auth.createSession();
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `sid=${token}; HttpOnly; Path=/admin; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure ? '; Secure' : ''}`
  );
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  auth.destroySession(req.cookies?.sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/admin; Max-Age=0');
  res.redirect('/admin/login');
});

router.use(auth.requireAdmin);

// Felles malvariablar for admin-sider
router.use((req, res, next) => {
  res.locals.lagra = req.query.lagra === '1';
  res.locals.feil = req.query.feil || null;
  next();
});

// ---------- Oversikt ----------

router.get('/', async (req, res) => {
  res.render('admin/dashboard', {
    talSubmissions: (await loadSubmissions()).length,
    sitePublic: cfg.sitePublic,
    lager: backendName(),
    smtpAktiv: require('../mailer').smtpConfigured()
  });
});

// ---------- Varsellinje ----------

router.get('/varsel', (req, res) => res.render('admin/varsel'));

router.post('/varsel', (req, res) =>
  trySave(res, 'varsel', (c) => {
    c.varsel.aktiv = req.body.aktiv === 'on';
    c.varsel.tekst = (req.body.tekst || '').trim();
    c.varsel.lenkje = (req.body.lenkje || '').trim();
  })
);

// ---------- Tekstinnhald ----------

router.get('/tekst', (req, res) => res.render('admin/tekst'));

router.post('/tekst/heim', (req, res) =>
  trySave(res, 'tekst', (c) => {
    c.heim.heroTittel = (req.body.heroTittel || '').trim();
    c.heim.heroIngress = (req.body.heroIngress || '').trim();
    c.heim.heroBilete = req.body.heroBilete || '';
    c.heim.punkt = [0, 1, 2]
      .map((i) => ({
        tittel: (req.body[`punktTittel${i}`] || '').trim(),
        tekst: (req.body[`punktTekst${i}`] || '').trim()
      }))
      .filter((p) => p.tittel);
  })
);

router.post('/tekst/omoss', (req, res) =>
  trySave(res, 'tekst', (c) => {
    c.omOss.ingress = (req.body.ingress || '').trim();
    c.omOss.brodtekst = (req.body.brodtekst || '').trim();
    const folk = [];
    for (let i = 0; i < 10; i++) {
      const namn = (req.body[`folkNamn${i}`] || '').trim();
      const rolle = (req.body[`folkRolle${i}`] || '').trim();
      if (namn && req.body[`folkSlett${i}`] !== 'on') folk.push({ namn, rolle });
    }
    c.omOss.folk = folk;
  })
);

router.post('/tekst/kontakt', (req, res) =>
  trySave(res, 'tekst', (c) => {
    c.kontakt.ingress = (req.body.ingress || '').trim();
    c.prosjekt.ingress = (req.body.prosjektIngress || '').trim();
  })
);

// ---------- Kontaktinfo ----------

router.get('/kontaktinfo', (req, res) => res.render('admin/kontaktinfo'));

router.post('/kontaktinfo', (req, res) =>
  trySave(res, 'kontaktinfo', (c) => {
    c.site.telefon = (req.body.telefon || '').trim();
    c.site.epost = (req.body.epost || '').trim();
    c.site.adresse.gate = (req.body.gate || '').trim();
    c.site.adresse.postnr = (req.body.postnr || '').trim();
    c.site.adresse.stad = (req.body.stad || '').trim();
    c.site.opningstider = (req.body.opningstider || '').trim();
    c.site.omrade = (req.body.omrade || '').trim();
    c.site.slagord = (req.body.slagord || '').trim();
    c.site.sosiale.facebook = (req.body.facebook || '').trim();
    c.site.sosiale.instagram = (req.body.instagram || '').trim();
  })
);

// ---------- Tenester ----------

router.get('/tenester', (req, res) => res.render('admin/tenester'));

router.post('/tenester/ny', (req, res) =>
  trySave(res, 'tenester', (c) => {
    const tittel = (req.body.tittel || '').trim();
    if (!tittel) throw new Error('Tenesta må ha ein tittel.');
    let slug = slugify(tittel);
    while (c.tenester.some((t) => t.slug === slug)) slug += '-2';
    c.tenester.push({
      id: crypto.randomUUID().slice(0, 8),
      slug,
      tittel,
      kort: (req.body.kort || '').trim(),
      brodtekst: (req.body.brodtekst || '').trim(),
      bilete: req.body.bilete || ''
    });
  })
);

router.post('/tenester/:id', (req, res) => {
  if (req.body.slett === 'on') {
    return trySave(res, 'tenester', (c) => {
      c.tenester = c.tenester.filter((t) => t.id !== req.params.id);
    });
  }
  trySave(res, 'tenester', (c) => {
    const t = c.tenester.find((x) => x.id === req.params.id);
    if (!t) throw new Error('Fann ikkje tenesta.');
    t.tittel = (req.body.tittel || '').trim() || t.tittel;
    t.kort = (req.body.kort || '').trim();
    t.brodtekst = (req.body.brodtekst || '').trim();
    t.bilete = req.body.bilete || '';
  });
});

// ---------- Prosjekt ----------

router.get('/prosjekt', (req, res) => res.render('admin/prosjekt'));

router.post('/prosjekt/ny', (req, res) =>
  trySave(res, 'prosjekt', (c) => {
    const tittel = (req.body.tittel || '').trim();
    if (!tittel) throw new Error('Prosjektet må ha ein tittel.');
    c.prosjekt.liste.unshift({
      id: crypto.randomUUID().slice(0, 8),
      tittel,
      skildring: (req.body.skildring || '').trim(),
      bilete: [].concat(req.body.bilete || []).filter(Boolean)
    });
  })
);

router.post('/prosjekt/:id', (req, res) => {
  if (req.body.slett === 'on') {
    return trySave(res, 'prosjekt', (c) => {
      c.prosjekt.liste = c.prosjekt.liste.filter((p) => p.id !== req.params.id);
    });
  }
  trySave(res, 'prosjekt', (c) => {
    const p = c.prosjekt.liste.find((x) => x.id === req.params.id);
    if (!p) throw new Error('Fann ikkje prosjektet.');
    p.tittel = (req.body.tittel || '').trim() || p.tittel;
    p.skildring = (req.body.skildring || '').trim();
    p.bilete = [].concat(req.body.bilete || []).filter(Boolean);
  });
});

// ---------- Referansar ----------

router.get('/referansar', (req, res) => res.render('admin/referansar'));

router.post('/referansar/vis', (req, res) =>
  trySave(res, 'referansar', (c) => {
    c.referansar.vis = req.body.vis === 'on';
  })
);

router.post('/referansar/ny', (req, res) =>
  trySave(res, 'referansar', (c) => {
    const tekst = (req.body.tekst || '').trim();
    if (!tekst) throw new Error('Referansen må ha tekst.');
    c.referansar.liste.push({
      id: crypto.randomUUID().slice(0, 8),
      tekst,
      namn: (req.body.namn || '').trim(),
      kjelde: (req.body.kjelde || '').trim()
    });
  })
);

router.post('/referansar/:id', (req, res) => {
  if (req.body.slett === 'on') {
    return trySave(res, 'referansar', (c) => {
      c.referansar.liste = c.referansar.liste.filter((r) => r.id !== req.params.id);
    });
  }
  trySave(res, 'referansar', (c) => {
    const r = c.referansar.liste.find((x) => x.id === req.params.id);
    if (!r) throw new Error('Fann ikkje referansen.');
    r.tekst = (req.body.tekst || '').trim();
    r.namn = (req.body.namn || '').trim();
    r.kjelde = (req.body.kjelde || '').trim();
  });
});

// ---------- Bilete ----------

router.get('/bilete', (req, res) => res.render('admin/bilete'));

async function processImage(buffer) {
  if (sharp) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { buffer: out, ext: '.webp' };
  }
  return { buffer, ext: '.jpg' };
}

router.post('/bilete/opplast', upload.array('filer'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) throw new Error('Ingen filer valde.');
    const c = getContent();
    for (const f of req.files) {
      if (!/^image\//.test(f.mimetype)) throw new Error(`«${f.originalname}» er ikkje eit bilete.`);
      const { buffer, ext } = await processImage(f.buffer);
      const base = slugify(f.originalname.replace(/\.[^.]+$/, ''));
      const fil = `${base}-${crypto.randomUUID().slice(0, 6)}${ext}`;
      await saveUpload(fil, buffer);
      c.bilete.push({ fil, alt: (req.body.alt || '').trim() || base.replace(/-/g, ' ') });
    }
    await saveContent();
    back(res, 'bilete', true);
  } catch (err) {
    back(res, 'bilete', false, err.message);
  }
});

router.post('/bilete/:fil/slett', async (req, res) => {
  try {
    const c = getContent();
    c.bilete = c.bilete.filter((b) => b.fil !== req.params.fil);
    // Fjern referansar til biletet frå innhaldet
    if (c.heim.heroBilete === req.params.fil) c.heim.heroBilete = '';
    c.tenester.forEach((t) => {
      if (t.bilete === req.params.fil) t.bilete = '';
    });
    c.prosjekt.liste.forEach((p) => {
      p.bilete = p.bilete.filter((b) => b !== req.params.fil);
    });
    await deleteUpload(req.params.fil);
    await saveContent();
    back(res, 'bilete', true);
  } catch (err) {
    back(res, 'bilete', false, err.message);
  }
});

router.post('/bilete/:fil/alt', (req, res) =>
  trySave(res, 'bilete', (c) => {
    const b = c.bilete.find((x) => x.fil === req.params.fil);
    if (b) b.alt = (req.body.alt || '').trim();
  })
);

// ---------- SEO ----------

router.get('/seo', (req, res) => res.render('admin/seo'));

router.post('/seo', (req, res) =>
  trySave(res, 'seo', (c) => {
    for (const side of Object.keys(c.seo)) {
      c.seo[side].tittel = (req.body[`tittel_${side}`] || '').trim();
      c.seo[side].beskriving = (req.body[`beskriving_${side}`] || '').trim();
    }
  })
);

// ---------- Førespurnader ----------

router.get('/forespurnader', async (req, res) => {
  res.render('admin/forespurnader', { liste: await loadSubmissions() });
});

router.post('/forespurnader/:id/slett', async (req, res) => {
  await deleteSubmission(req.params.id);
  back(res, 'forespurnader', true);
});

module.exports = router;
