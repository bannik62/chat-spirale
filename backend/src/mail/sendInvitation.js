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

export async function sendInvitationEmail({ to, chatName, inviteUrl }) {
  const from = process.env.SMTP_USER;
  if (!from || !process.env.SMTP_PASS) {
    console.warn('[mail] SMTP non configuré — invitation non envoyée à', to);
    console.warn('[mail] Lien :', inviteUrl);
    return { skipped: true };
  }

  await getTransporter().sendMail({
    from: `"Association Spirale" <${from}>`,
    to,
    subject: `Invitation au chat « ${chatName} »`,
    html: `
      <h2>Association Spirale</h2>
      <p>Vous êtes invité(e) au chat <strong>${chatName}</strong>.</p>
      <p><a href="${inviteUrl}">Rejoindre le chat</a></p>
      <p><small>Ce lien est personnel. Ne le partagez pas.</small></p>
    `,
    text: `Invitation au chat "${chatName}". Lien : ${inviteUrl}`,
  });
  return { sent: true };
}
