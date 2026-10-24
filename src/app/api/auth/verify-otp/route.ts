import { NextRequest, NextResponse } from 'next/server';
import { verifyOtpAndGetUser, createSession, setSessionCookie } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and 6-digit verification code are required.' }, { status: 400 });
    }

    // Verify OTP and fetch user profile
    const user = await verifyOtpAndGetUser(email, code);

    // Create session in Neon DB
    const sessionToken = await createSession(user.id);

    // Set HTTP-only cookie
    await setSessionCookie(sessionToken);

    // Record login into audit_logs
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('user', ${user.id}, ${user.id}, ${user.name}, 'login', ${JSON.stringify({
          role: user.role,
          user_code: user.user_code,
          timestamp: new Date().toISOString()
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to record login audit log:', auditErr);
    }

    // Determine target redirect dashboard based on role
    let redirectUrl = '/';
    switch (user.role) {
      case 'admin':
        redirectUrl = '/admin/users';
        break;
      case 'pre_sales':
        redirectUrl = '/presales';
        break;
      case 'referral':
        redirectUrl = '/referral';
        break;
      case 'promoter':
        redirectUrl = '/promoter';
        break;
      case 'business_relations':
        redirectUrl = '/business';
        break;
    }

    return NextResponse.json({
      success: true,
      user,
      redirectUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Verification failed. Please check the code and try again.' },
      { status: 400 }
    );
  }
}
