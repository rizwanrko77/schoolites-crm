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

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  pre_sales: 'Pre-Sales Specialist',
  referral: 'Referral Partner',
  promoter: 'Promoter',
  business_relations: 'Business Relations',
};

export interface UserWelcomeParams {
  to: string;
  name: string;
  role: string;
  userCode: string;
}

/**
 * Sends a welcome email when an admin creates a new user account.
 * Includes user code, role, login instructions (passwordless OTP), and personal referral link for promoters.
 * Safe in development when BREVO_API_KEY is not configured.
 */
export async function sendUserWelcomeEmail({ to, name, role, userCode }: UserWelcomeParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[Email] BREVO_API_KEY unset. Simulated welcome email to ${to} (${userCode})`);
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const loginUrl = `${appUrl}/login`;
  const referralUrl = `${appUrl}/e/${userCode}`;
  const roleTitle = ROLE_LABELS[role] || role;

  const subject = `Welcome to Schoolites - Your Account Details (${userCode})`;

  const textLines = [
    `Hello ${name},`,
    '',
    `Your account has been created on the Schoolites Platform as a ${roleTitle}.`,
    '',
    `Account Details:`,
    `• User Code: ${userCode}`,
    `• Role: ${roleTitle}`,
    `• Registered Email: ${to}`,
    '',
    `How to Sign In:`,
    `1. Visit the login page: ${loginUrl}`,
    `2. Enter your registered email (${to}).`,
    `3. You will receive a secure 6-digit one-time code to access your dashboard. No password is required.`,
  ];

  if (role === 'promoter') {
    textLines.push(
      '',
      `Your Public Referral Link:`,
      `${referralUrl}`,
      `Share this link with schools and educational institutions. Any enquiry submitted through your link will be automatically tracked under your profile.`
    );
  }

  textLines.push(
    '',
    `Best regards,`,
    `The Schoolites Team`,
    appUrl
  );

  const textContent = textLines.join('\n');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 20px; }
        .title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
        .subtitle { color: #94a3b8; font-size: 14px; margin: 0; }
        .badge { display: inline-block; background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-top: 8px; }
        .card { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 18px; margin: 20px 0; }
        .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .card-label { color: #94a3b8; }
        .card-value { color: #ffffff; font-weight: 700; }
        .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 20px 0; text-align: center; }
        .referral-box { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 16px; margin: 20px 0; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Welcome to Schoolites</h1>
          <p class="subtitle">AI-Powered School Management &amp; Growth Platform</p>
          <div class="badge">${roleTitle}</div>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #e2e8f0;">
          Hello <strong>${name}</strong>,<br>
          An account has been created for you on the Schoolites platform. Below are your account details and login instructions:
        </p>

        <div class="card">
          <div class="card-row"><span class="card-label">User Code:</span><span class="card-value">${userCode}</span></div>
          <div class="card-row"><span class="card-label">Role:</span><span class="card-value">${roleTitle}</span></div>
          <div class="card-row" style="margin-bottom:0;"><span class="card-label">Registered Email:</span><span class="card-value">${to}</span></div>
        </div>

        <h3 style="color: #ffffff; font-size: 16px; margin: 20px 0 8px 0;">How to Sign In:</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px 0;">
          Schoolites uses passwordless verification. No password is required. Simply enter your registered email address to receive a secure 6-digit access code.
        </p>

        <div style="text-align: center;">
          <a href="${loginUrl}" class="btn">Go to Login Page &rarr;</a>
        </div>

        ${role === 'promoter' ? `
        <div class="referral-box">
          <div style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">Your Dedicated Referral Link</div>
          <div style="font-size: 14px; word-break: break-all; color: #ffffff; font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
            <a href="${referralUrl}" style="color: #38bdf8; text-decoration: none;">${referralUrl}</a>
          </div>
          <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
            Share this link with schools and institutions. Enquiries submitted via this page will be tracked directly under your profile.
          </div>
        </div>
        ` : ''}

        <div class="footer">
          &copy; ${new Date().getFullYear()} Schoolites. All rights reserved.<br>
          Need help? Reply directly to this email or contact your platform administrator.
        </div>
      </div>
    </body>
    </html>
  `;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ name, email: to }],
      subject,
      textContent,
      htmlContent,
    }),
  });
}

export interface EnquiryConfirmationParams {
  to: string;
  name: string;
  enquiryCode: string;
  instituteName?: string;
}

/**
 * Sends a confirmation email to a visitor who submitted an enquiry on /e/[code].
 * Safe in development when BREVO_API_KEY is not configured.
 */
export async function sendEnquiryConfirmationEmail({
  to,
  name,
  enquiryCode,
  instituteName,
}: EnquiryConfirmationParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[Email] BREVO_API_KEY unset. Simulated enquiry confirmation email to ${to} (${enquiryCode})`);
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const subject = `Thank you for contacting Schoolites [Ref: ${enquiryCode}]`;

  const textLines = [
    `Dear ${name},`,
    '',
    `Thank you for expressing interest in Schoolites${instituteName ? ` for ${instituteName}` : ''}!`,
    '',
    `We have successfully received your enquiry.`,
    `Reference Number: ${enquiryCode}`,
    '',
    `What happens next?`,
    `• Our dedicated education consulting team will review your requirements.`,
    `• A representative will connect with you shortly via phone/WhatsApp to schedule a personalized walkthrough.`,
    `• You will receive access to your 1-Month Free Trial with complete campus onboarding support.`,
    '',
    `Explore 100+ Enterprise Capabilities:`,
    `• Live GPS bus tracking with parent notifications`,
    `• Zero-leakage fee management with WhatsApp receipts`,
    `• Biometric attendance & smart substitution`,
    `• 1-Click UDISE+ government compliance export`,
    '',
    `If you have any urgent queries, you can reply directly to this email referencing ${enquiryCode}.`,
    '',
    `Warm regards,`,
    `The Schoolites Team`,
    appUrl
  ];

  const textContent = textLines.join('\n');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 20px; }
        .title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
        .subtitle { color: #94a3b8; font-size: 14px; margin: 0; }
        .ref-box { background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 8px; padding: 14px 20px; margin: 20px 0; text-align: center; }
        .ref-label { font-size: 12px; color: #a7f3d0; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
        .ref-code { font-size: 22px; color: #34d399; font-weight: 800; font-family: monospace; letter-spacing: 0.05em; }
        .feature-list { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
        .feature-item { font-size: 14px; color: #cbd5e1; margin-bottom: 8px; line-height: 1.5; }
        .feature-item strong { color: #ffffff; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Schoolites</h1>
          <p class="subtitle">AI-Powered School Management &amp; Growth Platform</p>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #e2e8f0;">
          Dear <strong>${name}</strong>,<br>
          Thank you for reaching out to us${instituteName ? ` regarding <strong>${instituteName}</strong>` : ''}. We have received your enquiry and our team is already reviewing your details.
        </p>

        <div class="ref-box">
          <div class="ref-label">Your Enquiry Reference Number</div>
          <div class="ref-code">${enquiryCode}</div>
        </div>

        <h3 style="color: #ffffff; font-size: 15px; margin: 20px 0 10px 0;">What happens next?</h3>
        <div class="feature-list">
          <div class="feature-item">&bull; <strong>Dedicated Consultant:</strong> A Schoolites education technology specialist will reach out to understand your campus requirements.</div>
          <div class="feature-item">&bull; <strong>Personalized Demo:</strong> Experience a live walkthrough tailored to your institution's fee structure, transport routes, and exam formats.</div>
          <div class="feature-item" style="margin-bottom:0;">&bull; <strong>1-Month Free Trial:</strong> All 100+ modules unlocked with complete data onboarding and staff training.</div>
        </div>

        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Have questions or need immediate assistance? You can reply directly to this email referencing <strong>${enquiryCode}</strong>.
        </p>

        <div class="footer">
          &copy; ${new Date().getFullYear()} Schoolites. All rights reserved.<br>
          Empowering modern campuses with intelligent school automation.
        </div>
      </div>
    </body>
    </html>
  `;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ name, email: to }],
      subject,
      textContent,
      htmlContent,
    }),
  });
}

