import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendInvitationEmail({ to, accessCode, siteUrl }) {
  const from = process.env.SMTP_USER;
  const url = siteUrl || process.env.FRONTEND_URL || 'http://localhost:8081';

  if (!from || !process.env.SMTP_PASS) {
    console.warn('[mail] SMTP non configuré — invitation non envoyée à', to);
    console.warn('[mail] Site :', url);
    console.warn('[mail] Code :', accessCode);
    return { skipped: true };
  }

  await getTransporter().sendMail({
    from: `"Association Spirale" <${from}>`,
    to,
    subject: 'Votre accès — Association Spirale',
    html: `
      <h2>Association Spirale</h2>
      <p>Votre code personnel : <strong style="font-size:1.25em;letter-spacing:2px">${accessCode}</strong></p>
      <ol>
        <li>Allez sur <a href="${url}">${url}</a></li>
        <li>Entrez votre email et ce code</li>
        <li>Choisissez votre activité</li>
      </ol>
      <p><small>Ce code est personnel. En cas de perte, contactez l'association.</small></p>
    `,
    text: `Code : ${accessCode}\nConnexion : ${url}\nEmail : ${to}`,
  });
  return { sent: true };
}
