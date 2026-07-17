# Mesterbygg Stryn AS – nettside

Moderne, rask og universelt utforma nettside for Mesterbygg Stryn AS (org.nr 933 537 552),
med innebygd administrasjonspanel der bedrifta sjølv kan endre alt innhald utan kode.

## Teknologi

- **Node.js + Express + EJS** – server-rendra sider, ingen byggsteg
- **Vanilla CSS/JS** – sjølvhosta font, ingen tredjepartsavhengigheiter i nettlesaren
- **Postgres som innhaldslager** (`DATABASE_URL`) – innhald, opplasta bilete og
  førespurnader ligg i databasen og overlever omstart/redeploy på Render.
  Alternativ: GitHub-lagring via API (`GITHUB_TOKEN`+`GITHUB_REPO`), eller berre
  lokale filer under utvikling.
- **sharp** – automatisk komprimering og skalering av opplasta bilete (WebP)

## Køyr lokalt

```bash
npm install
npm start          # http://localhost:3000
```

## Miljøvariablar

| Variabel | Påkravd | Forklaring |
| --- | --- | --- |
| `ADMIN_PASSWORD_HASH` | ja (for admin) | Generer med `node src/auth.js hash "passordet"` |
| `SESSION_SECRET` | tilrådd | Vilkårleg lang tilfeldig streng |
| `SITE_URL` | tilrådd | T.d. `https://…onrender.com` (for kanoniske lenkjer/sitemap) |
| `SITE_PUBLIC` | nei | Sett til `1` FØRST når bedrifta har godkjent sida – før det er alle sider `noindex` |
| `DATABASE_URL` | for persistens | Postgres-tilkopling (Render: «Add from database») |
| `GITHUB_TOKEN` / `GITHUB_REPO` | alternativ | GitHub-lagring om database ikkje er tilgjengeleg |
| `CONTENT_BRANCH` | nei | Standard `innhald` (berre GitHub-lagring) |
| `SMTP_HOST/PORT/USER/PASS` | nei | Set opp for å få førespurnader på e-post |
| `CONTACT_TO` | nei | E-postadressa som skal få førespurnadene |

Ingen løyndomar skal nokosinne sjekkast inn i repoet.

## Personvern og tilgjenge

- Ingen informasjonskapslar på dei opne sidene (berre nødvendig innloggingskapsel i admin) → ikkje behov for cookie-banner
- Personvernerklæring på `/personvern`
- WCAG 2.1 AA: semantisk HTML, tastaturnavigasjon, fokusmarkering, kontrastsikra fargar, `prefers-reduced-motion`
- Kontaktskjema-data blir IKKJE lagra i GitHub – berre lokalt + eventuell e-post via SMTP
