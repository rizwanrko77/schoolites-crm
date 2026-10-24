import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    // Only Admin and Business Relations team members need to view managers for reassignment
    if (user.role !== 'admin' && user.role !== 'business_relations') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges.' }, { status: 403 });
    }

    const managers = await sql`
      SELECT id, name, user_code, email, role, is_active
      FROM users
      WHERE role = 'business_relations' AND is_active = TRUE
      ORDER BY name ASC
    `;

    return NextResponse.json({ managers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch managers' }, { status: 500 });
  }
}
