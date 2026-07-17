const cfg = require('./config');

// To måtar å sende e-post på:
//  1. Brevo sitt HTTPS-API (BREVO_API_KEY) – fungerer òg på Render gratisplan,
//     som blokkerer utgåande SMTP-trafikk (portane 25/465/587).
//  2. Klassisk SMTP (SMTP_*) – krev betalt Render-instans eller annan vert.
function brevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && cfg.smtp.to);
}
function smtpOnlyConfigured() {
  return Boolean(cfg.smtp.host && cfg.smtp.user && cfg.smtp.pass && cfg.smtp.to);
}
function smtpConfigured() {
  return brevoConfigured() || smtpOnlyConfigured();
}

function mailText(sub) {
  return [
    `Namn: ${sub.namn}`,
    `Telefon: ${sub.telefon || '-'}`,
    `E-post: ${sub.epost || '-'}`,
    '',
    'Melding:',
    sub.melding,
    '',
    `Sendt frå kontaktskjemaet ${sub.tidspunkt}`
  ].join('\n');
}

async function sendViaBrevo(sub) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Nettsida – Mesterbygg Stryn', email: process.env.BREVO_FROM || cfg.smtp.to },
      to: [{ email: cfg.smtp.to }],
      ...(sub.epost ? { replyTo: { email: sub.epost } } : {}),
      subject: `Ny førespurnad frå ${sub.namn}`,
      textContent: mailText(sub)
    })
  });
  if (!res.ok) {
    throw new Error(`Brevo svarte ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return true;
}

let transport = null;
function getTransport() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.port === 465,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
      connectionTimeout: 15000
    });
  }
  return transport;
}

async function sendViaSmtp(sub) {
  await getTransport().sendMail({
    from: `"Nettsida – Mesterbygg Stryn" <${cfg.smtp.user}>`,
    to: cfg.smtp.to,
    replyTo: sub.epost || undefined,
    subject: `Ny førespurnad frå ${sub.namn}`,
    text: mailText(sub)
  });
  return true;
}

// Sender førespurnaden på e-post om ein leverandør er konfigurert.
// Returnerer true/false slik at kontaktruta kan rapportere ærleg.
async function sendContactMail(sub) {
  if (brevoConfigured()) return sendViaBrevo(sub);
  if (smtpOnlyConfigured()) return sendViaSmtp(sub);
  return false;
}

module.exports = { sendContactMail, smtpConfigured };
