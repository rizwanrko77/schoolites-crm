import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const logs = await sql`
      SELECT id, record_type, record_id, actor_id, actor_name, action, metadata, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
