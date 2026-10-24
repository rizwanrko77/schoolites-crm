import nodemailer from 'nodemailer';

const GENERIC_FAILURE = 'Could not send the verification email. Try again shortly.';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.MAIL_FROM || 'Schoolites <noreply@schoolites.com>';
}

/**
 * Sends a login code. Throws EMAIL_NOT_CONFIGURED when no provider is set.
 * The code is never written to logs.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = 'Your Schoolites verification code';
  const text = [
    `Your Schoolites verification code is ${code}.`,
    'It expires in 10 minutes.',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = port === 465 || process.env.SMTP_SECURE === 'true';
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          }
        : undefined,
    });

    try {
      await transporter.sendMail({
        from: fromAddress(),
        to,
        subject,
        text,
      });
    } catch {
      console.error('OTP email delivery failed');
      throw new Error(GENERIC_FAILURE);
    }
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      console.error(`OTP email provider rejected the message (${res.status})`);
      throw new Error(GENERIC_FAILURE);
    }
    return;
  }

  const missing = new Error('EMAIL_NOT_CONFIGURED');
  missing.name = 'EmailNotConfiguredError';
  throw missing;
}
