const cfg = require('./config');

let transport = null;
function smtpConfigured() {
  return Boolean(cfg.smtp.host && cfg.smtp.user && cfg.smtp.pass && cfg.smtp.to);
}

function getTransport() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.port === 465,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.pass }
    });
  }
  return transport;
}

// Sender førespurnaden på e-post om SMTP er konfigurert. Returnerer true/false
// slik at kontaktruta kan rapportere ærleg om kva som skjedde.
async function sendContactMail(sub) {
  if (!smtpConfigured()) return false;
  await getTransport().sendMail({
    from: `"Nettsida – Mesterbygg Stryn" <${cfg.smtp.user}>`,
    to: cfg.smtp.to,
    replyTo: sub.epost || undefined,
    subject: `Ny førespurnad frå ${sub.namn}`,
    text: [
      `Namn: ${sub.namn}`,
      `Telefon: ${sub.telefon || '-'}`,
      `E-post: ${sub.epost || '-'}`,
      '',
      'Melding:',
      sub.melding,
      '',
      `Sendt frå kontaktskjemaet ${sub.tidspunkt}`
    ].join('\n')
  });
  return true;
}

module.exports = { sendContactMail, smtpConfigured };
