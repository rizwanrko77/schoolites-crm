import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendUserWelcomeEmail } from '@/lib/mail';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rolesParam = searchParams.get('roles');
    const roleFilter = searchParams.get('role');
    const statusFilter = searchParams.get('status'); // 'all' | 'active' | 'inactive'
    const search = searchParams.get('search')?.toLowerCase() || '';

    // Fetch users list
    let users = await sql`
      SELECT id, user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    // Calculate aggregated metrics
    const counts = {
      total: users.length,
      active: users.filter((u: any) => u.is_active).length,
      inactive: users.filter((u: any) => !u.is_active).length,
      admin: users.filter((u: any) => u.role === 'admin').length,
      pre_sales: users.filter((u: any) => u.role === 'pre_sales').length,
      referral: users.filter((u: any) => u.role === 'referral').length,
      promoter: users.filter((u: any) => u.role === 'promoter').length,
      business_relations: users.filter((u: any) => u.role === 'business_relations').length,
    };

    // Calculate role-level active vs inactive breakdown
    const roleStats: Record<string, { total: number; active: number; inactive: number }> = {};
    for (const r of ['admin', 'pre_sales', 'referral', 'promoter', 'business_relations']) {
      const rUsers = users.filter((u: any) => u.role === r);
      roleStats[r] = {
        total: rUsers.length,
        active: rUsers.filter((u: any) => u.is_active).length,
        inactive: rUsers.filter((u: any) => !u.is_active).length,
      };
    }

    // Apply role filtering (supports comma-separated roles or legacy single role)
    if (rolesParam) {
      if (rolesParam === 'none') {
        users = [];
      } else {
        const allowed = rolesParam.split(',').map((r) => r.trim()).filter(Boolean);
        if (allowed.length > 0 && !allowed.includes('all')) {
          users = users.filter((u: any) => allowed.includes(u.role));
        }
      }
    } else if (roleFilter && roleFilter !== 'all') {
      users = users.filter((u: any) => u.role === roleFilter);
    }

    // Apply active status filtering
    if (statusFilter === 'active') {
      users = users.filter((u: any) => u.is_active);
    } else if (statusFilter === 'inactive') {
      users = users.filter((u: any) => !u.is_active);
    }

    if (search) {
      users = users.filter(
        (u: any) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.user_code.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ users, counts, roleStats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role, date_of_joining, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'User name is required.' }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const validRoles = ['admin', 'pre_sales', 'referral', 'business_relations', 'promoter'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already in use
    const existing = await sql`
      SELECT id, user_code FROM users WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `A user with email ${email} already exists (Code: ${existing[0].user_code}).` },
        { status: 400 }
      );
    }

    // Determine Role prefix
    const rolePrefixes: Record<string, string> = {
      admin: 'ADM',
      pre_sales: 'PS',
      referral: 'REF',
      promoter: 'PM',
      business_relations: 'BR',
    };
    const prefix = rolePrefixes[role] || 'USR';

    // Fetch next value from shared sequence
    const seqRes = await sql`SELECT nextval('user_code_seq') as next_val`;
    const userCode = `${prefix}-${seqRes[0].next_val}`;

    const doj = date_of_joining ? date_of_joining : new Date().toISOString().split('T')[0];
    const defaultRate = role === 'promoter' ? 10.00 : role === 'referral' ? 15.00 : 0.00;
    const finalRate = body.commission_rate !== undefined && body.commission_rate !== null && body.commission_rate !== ''
      ? parseFloat(body.commission_rate)
      : defaultRate;

    const isEligibleForDb = role === 'pre_sales' || role === 'referral';
    const hasDatabaseAccess = isEligibleForDb && (body.has_database_access === true || body.has_database_access === 'true');

    // Insert new user
    const insertRes = await sql`
      INSERT INTO users (user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access)
      VALUES (${userCode}, ${name.trim()}, ${normalizedEmail}, ${role}, ${finalRate}, ${doj}, ${description?.trim() || null}, TRUE, ${hasDatabaseAccess})
      RETURNING id, user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access, created_at
    `;

    const newUser = insertRes[0];

    // Audit log insertion
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('user', ${newUser.id}, ${currentUser.id}, ${currentUser.name}, 'user_created', ${JSON.stringify({
          user_code: newUser.user_code,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for user creation:', auditErr);
    }

    // Dispatch Welcome Email with login instructions & referral link (non-blocking)
    try {
      await sendUserWelcomeEmail({
        to: newUser.email,
        name: newUser.name,
        role: newUser.role,
        userCode: newUser.user_code,
      });
    } catch (mailErr) {
      console.warn('Failed to send welcome email for new user:', mailErr);
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create user' }, { status: 500 });
  }
}
