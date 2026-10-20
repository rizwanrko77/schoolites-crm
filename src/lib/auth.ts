import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sql } from './db';

export interface UserSession {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: 'admin' | 'pre_sales' | 'referral' | 'business_relations';
  date_of_joining: string | null;
  description: string | null;
  is_active: boolean;
}

const SESSION_COOKIE_NAME = 'schoolites_session';
const SESSION_MAX_AGE_DAYS = 30;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export async function generateAndSaveOtp(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  
  // Verify user exists and is active
  const userRes = await sql`
    SELECT id, user_code, name, role, is_active 
    FROM users 
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `;

  if (userRes.length === 0) {
    throw new Error('No account found with this email address.');
  }

  if (!userRes[0].is_active) {
    throw new Error('This account has been deactivated. Please contact an administrator.');
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + crypto.randomInt(900000)).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  // Invalidate previous unconsumed OTPs for this email
  await sql`
    UPDATE otps 
    SET consumed = TRUE 
    WHERE LOWER(email) = ${normalizedEmail} AND consumed = FALSE
  `;

  // Insert new OTP
  await sql`
    INSERT INTO otps (email, code, expires_at)
    VALUES (${normalizedEmail}, ${code}, ${expiresAt.toISOString()})
  `;

  return code;
}

/**
 * Verify OTP and return the user
 */
export async function verifyOtpAndGetUser(email: string, code: string): Promise<UserSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  // Find valid unconsumed OTP
  const otpRes = await sql`
    SELECT id, expires_at 
    FROM otps 
    WHERE LOWER(email) = ${normalizedEmail} 
      AND code = ${trimmedCode} 
      AND consumed = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  if (otpRes.length === 0) {
    throw new Error('Invalid or expired OTP. Please request a new one.');
  }

  // Mark OTP as consumed
  await sql`
    UPDATE otps 
    SET consumed = TRUE 
    WHERE id = ${otpRes[0].id}
  `;

  // Fetch user
  const userRes = await sql`
    SELECT id, user_code, name, email, role, date_of_joining, description, is_active
    FROM users
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `;

  if (userRes.length === 0 || !userRes[0].is_active) {
    throw new Error('User account is invalid or deactivated.');
  }

  return userRes[0] as UserSession;
}

/**
 * Create a session in Neon DB and return the token
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `;

  return token;
}

/**
 * Set HTTP-only session cookie
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clear session cookie and delete session record
 */
export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
    } catch {
      // Ignore cleanup error if already deleted
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieve current authenticated user from session cookie
 */
export async function getSessionUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const res = await sql`
      SELECT u.id, u.user_code, u.name, u.email, u.role, u.date_of_joining, u.description, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
        AND u.is_active = TRUE
      LIMIT 1
    `;

    if (res.length === 0) {
      return null;
    }

    return res[0] as UserSession;
  } catch {
    return null;
  }
}
