const GENERIC_FAILURE = 'Could not send the verification email. Try again shortly.';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

function sender(): { name: string; email: string } {
  const raw = (process.env.MAIL_FROM || 'Schoolites <noreply@schoolites.com>').trim();
  const named = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (named) {
    const name = named[1].trim().replace(/^["']|["']$/g, '');
    return { name: name || 'Schoolites', email: named[2].trim() };
  }
  return { name: 'Schoolites', email: raw };
}

/**
 * Sends a login code through Brevo. Throws EMAIL_NOT_CONFIGURED when the API key is unset.
 * The code is never written to logs.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = 'Your Schoolites verification code';
  const text = [
    `Your Schoolites verification code is ${code}.`,
    'It expires in 10 minutes.',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    const missing = new Error('EMAIL_NOT_CONFIGURED');
    missing.name = 'EmailNotConfiguredError';
    throw missing;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') detail = `: ${body.message}`;
    } catch {
      detail = '';
    }
    console.error(`OTP email provider rejected the message (${res.status})${detail}`);
    throw new Error(GENERIC_FAILURE);
  }
}
