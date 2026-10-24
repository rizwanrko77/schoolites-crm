import { NextRequest, NextResponse } from 'next/server';
import { generateAndSaveOtp } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const code = await generateAndSaveOtp(email);

    // In a production email service, we call Resend/SendGrid/SMTP here.
    // For local dev/testing, we log to server console and provide devOtp for fast testing.
    console.log(`\n========================================`);
    console.log(`[AUTH OTP] Destination: ${email}`);
    console.log(`[AUTH OTP] 6-Digit Code: ${code}`);
    console.log(`[AUTH OTP] Valid for: 10 minutes`);
    console.log(`========================================\n`);

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been generated for ${email}.`,
      // Expose code in dev mode to make pair-programming testing seamless
      devOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to send verification code.' },
      { status: 400 }
    );
  }
}
