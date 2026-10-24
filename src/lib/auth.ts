import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sql } from './db';

export interface UserSession {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: 'admin' | 'pre_sales' | 'referral' | 'business_relations' | 'promoter';
  commission_rate?: number | string | null;
  date_of_joining: string | null;
  description: string | null;
  is_active: boolean;
  has_database_access?: boolean;
}

const SESSION_COOKIE_NAME = 'schoolites_session';
const SESSION_MAX_AGE_DAYS = 30;

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_SENDS = 5;
const OTP_MIN_GAP_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_SENDS = 20;
const IP_MAX_VERIFIES = 30;

export class AuthRateLimitError extends Error {
  constructor() {
    super('Too many verification attempts. Please wait a few minutes and try again.');
    this.name = 'AuthRateLimitError';
  }
}

const ipHits = new Map<string, number[]>();

function allowIp(scope: string, ip: string, limit: number): boolean {
  const key = `${scope}:${ip || 'unknown'}`;
  const now = Date.now();
  const recent = (ipHits.get(key) || []).filter((ts) => now - ts < IP_WINDOW_MS);
  if (recent.length >= limit) {
    ipHits.set(key, recent);
    return false;
  }
  recent.push(now);
  ipHits.set(key, recent);
  if (ipHits.size > 5000) {
    const oldest = ipHits.keys().next().value;
    if (oldest) ipHits.delete(oldest);
  }
  return true;
}

export function assertSendIpLimit(ip: string) {
  if (!allowIp('otp-send', ip, IP_MAX_SENDS)) {
    throw new AuthRateLimitError();
  }
}

export function assertVerifyIpLimit(ip: string) {
  if (!allowIp('otp-verify', ip, IP_MAX_VERIFIES)) {
    throw new AuthRateLimitError();
  }
}

function codesMatch(stored: string, provided: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Returns null when no active account exists, so callers can respond
 * without revealing whether the email is registered.
 */
export async function generateAndSaveOtp(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const recent = await sql`
    SELECT COUNT(*)::int AS recent_count, MAX(created_at) AS last_sent
    FROM otps
    WHERE LOWER(email) = ${normalizedEmail}
      AND created_at > NOW() - INTERVAL '15 minutes'
  `;
  const recentCount = Number(recent[0]?.recent_count || 0);
  const lastSent = recent[0]?.last_sent ? new Date(recent[0].last_sent).getTime() : 0;
  if (recentCount >= OTP_MAX_SENDS || (lastSent && Date.now() - lastSent < OTP_MIN_GAP_MS)) {
    throw new AuthRateLimitError();
  }

  const userRes = await sql`
    SELECT id, is_active
    FROM users
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `;

  if (userRes.length === 0 || !userRes[0].is_active) {
    return null;
  }

  const code = Math.floor(100000 + crypto.randomInt(900000)).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await sql`
    UPDATE otps
    SET consumed = TRUE
    WHERE LOWER(email) = ${normalizedEmail} AND consumed = FALSE
  `;

  await sql`
    INSERT INTO otps (email, code, expires_at, attempts)
    VALUES (${normalizedEmail}, ${code}, ${expiresAt.toISOString()}, 0)
  `;

  return code;
}

/**
 * Verify OTP and return the user
 */
export async function verifyOtpAndGetUser(email: string, code: string): Promise<UserSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  const otpRes = await sql`
    SELECT id, code, attempts
    FROM otps
    WHERE LOWER(email) = ${normalizedEmail}
      AND consumed = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (otpRes.length === 0) {
    throw new Error('Invalid or expired OTP. Please request a new one.');
  }

  const otp = otpRes[0];
  const attempts = Number(otp.attempts || 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await sql`UPDATE otps SET consumed = TRUE WHERE id = ${otp.id}`;
    throw new Error('Too many incorrect attempts. Please request a new code.');
  }

  if (!codesMatch(String(otp.code), trimmedCode)) {
    const nextAttempts = attempts + 1;
    await sql`
      UPDATE otps
      SET attempts = ${nextAttempts}, consumed = (${nextAttempts} >= ${OTP_MAX_ATTEMPTS})
      WHERE id = ${otp.id}
    `;
    throw new Error(
      nextAttempts >= OTP_MAX_ATTEMPTS
        ? 'Too many incorrect attempts. Please request a new code.'
        : 'Invalid or expired OTP. Please request a new one.'
    );
  }

  await sql`
    UPDATE otps
    SET consumed = TRUE
    WHERE id = ${otp.id}
  `;

  // Fetch user
  const userRes = await sql`
    SELECT id, user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access
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
      SELECT u.id, u.user_code, u.name, u.email, u.role, u.commission_rate, u.date_of_joining, u.description, u.is_active, u.has_database_access
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
