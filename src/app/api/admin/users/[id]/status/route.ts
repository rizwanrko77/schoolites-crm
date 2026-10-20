import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_active boolean value.' }, { status: 400 });
    }

    // Prevent admin from deactivating their own account
    if (id === currentUser.id && !is_active) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own administrative account.' },
        { status: 400 }
      );
    }

    const updateRes = await sql`
      UPDATE users
      SET is_active = ${is_active}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_code, name, email, is_active
    `;

    if (updateRes.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const updatedUser = updateRes[0];

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('user', ${id}, ${currentUser.id}, ${currentUser.name}, 'user_status_changed', ${JSON.stringify({
          user_code: updatedUser.user_code,
          is_active: updatedUser.is_active,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for user status change:', auditErr);
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update user status' }, { status: 500 });
  }
}
