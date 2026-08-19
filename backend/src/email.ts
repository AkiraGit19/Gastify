const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

export async function sendMagicLinkEmail(to: string, token: string) {
  const url = `${FRONTEND_URL}/auth/verify?token=${token}`;

  if (!RESEND_API_KEY) {
    // ponytail: no email provider configured in dev, log the link instead of failing the request
    console.log(`[magic link] ${to} -> ${url}`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Gastify <login@gastify.app>",
      to,
      subject: "Tu enlace de acceso a Gastify",
      html: `<p>Haz clic para entrar: <a href="${url}">${url}</a></p><p>Expira en 15 minutos.</p>`,
    }),
  });
}
