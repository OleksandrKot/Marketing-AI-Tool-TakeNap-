// Minimal email helper used by server routes.
// Tries Mailjet API -> SendGrid API -> SMTP (nodemailer) fallback.

export type SendEmailResult =
  | { ok: true; provider: 'mailjet' | 'sendgrid' | 'smtp'; result?: unknown; info?: unknown }
  | { ok: false; reason: string; error?: string };

export async function sendApprovalEmail(
  toEmail: string,
  opts?: { subject?: string; text?: string; html?: string }
): Promise<SendEmailResult> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY || '';
  const fromEnv =
    process.env.SENDGRID_FROM || process.env.NOTIFY_FROM_EMAIL || process.env.SMTP_FROM || '';

  const mailjetKey = process.env.MAILJET_API_KEY || '';
  const mailjetSecret = process.env.MAILJET_API_SECRET || '';
  const mailjetFrom = process.env.MAILJET_FROM || fromEnv;

  const subject = opts?.subject || 'Access approved';
  const text = opts?.text || 'Your access to the site has been approved. You can now sign in.';
  const html =
    opts?.html ||
    '<p>Your access to the site has been <strong>approved</strong>. You can now sign in.</p>';

  // 1) Try Mailjet API if configured
  if (mailjetKey && mailjetSecret && mailjetFrom) {
    try {
      const mjBody = {
        Messages: [
          {
            From: { Email: mailjetFrom },
            To: [{ Email: toEmail }],
            Subject: subject,
            TextPart: text,
            HTMLPart: html,
          },
        ],
      };

      const basic = Buffer.from(`${mailjetKey}:${mailjetSecret}`).toString('base64');

      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mjBody),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        return { ok: true, provider: 'mailjet', result: json };
      } else {
        const details = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.warn('Mailjet send failed, proceeding to next provider', {
          status: res.status,
          details,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Mailjet exception, proceeding to next provider', (e as Error).message);
    }
  }

  // 2) Try SendGrid API if configured
  if (sendgridApiKey && fromEnv) {
    const body = {
      personalizations: [
        {
          to: [{ email: toEmail }],
        },
      ],
      from: { email: fromEnv },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    };

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return { ok: true, provider: 'sendgrid' };
      }

      const textResp = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.warn('SendGrid send failed, attempting SMTP fallback', {
        status: res.status,
        details: textResp,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('SendGrid exception, attempting SMTP fallback', (e as Error).message);
    }
  }

  // 3) SMTP fallback (nodemailer) if configured
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 0;
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpSecure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const smtpFrom = fromEnv || process.env.SMTP_FROM || '';

  if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
    try {
      const nodemailer = (await import('nodemailer')) as typeof import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject,
        text,
        html,
      });

      return { ok: true, provider: 'smtp', info };
    } catch (e) {
      return {
        ok: false,
        reason: 'smtp_failed',
        error: (e as Error).message,
      };
    }
  }

  return { ok: false, reason: 'no_mail_provider_configured' };
}

export default sendApprovalEmail;
