import { NextRequest, NextResponse } from 'next/server';
import { AuthRateLimitError, assertSendIpLimit, generateAndSaveOtp } from '@/lib/auth';
import { isEmailConfigured, sendOtpEmail } from '@/lib/mail';

const GENERIC_MESSAGE = 'If an account exists for this email, a verification code has been sent.';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    assertSendIpLimit(clientIp(req));

    if (process.env.NODE_ENV === 'production' && !isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email delivery is not configured. Contact an administrator.' },
        { status: 503 }
      );
    }

    const code = await generateAndSaveOtp(email);
    if (!code) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Email delivery is not configured in this environment. Use the development code shown below.',
        devOtp: code,
      });
    }

    await sendOtpEmail(email.trim().toLowerCase(), code);

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  } catch (err: any) {
    if (err instanceof AuthRateLimitError || err?.name === 'AuthRateLimitError') {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to send verification code.' },
      { status: 400 }
    );
  }
}
