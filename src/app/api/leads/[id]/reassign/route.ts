import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { new_manager_id } = body;

    if (!new_manager_id) {
      return NextResponse.json({ error: 'Target manager ID is required.' }, { status: 400 });
    }

    const leadRes = await sql`SELECT id, lead_code, manager_id FROM leads WHERE id = ${id} LIMIT 1`;
    if (leadRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const lead = leadRes[0];

    // Only Admin or current assigned Manager can reassign
    if (user.role !== 'admin' && lead.manager_id !== user.id) {
      return NextResponse.json({ error: 'Only the assigned manager or an Admin can reassign this lead.' }, { status: 403 });
    }

    // Verify target manager exists and is active
    const targetUserRes = await sql`
      SELECT id, name, user_code, role, is_active 
      FROM users 
      WHERE id = ${new_manager_id} AND is_active = TRUE
      LIMIT 1
    `;
    if (targetUserRes.length === 0) {
      return NextResponse.json({ error: 'Target representative not found or inactive.' }, { status: 404 });
    }

    const targetUser = targetUserRes[0];

    const updateRes = await sql`
      UPDATE leads
      SET manager_id = ${targetUser.id}, status = 'assigned', updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, lead_code, manager_id
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'lead_reassigned', ${JSON.stringify({
          lead_code: lead.lead_code,
          from_manager_id: lead.manager_id,
          to_manager: `${targetUser.name} (${targetUser.user_code})`,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for lead reassignment:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Lead ${lead.lead_code} reassigned to ${targetUser.name} (${targetUser.user_code}).`,
      lead: updateRes[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reassign lead' }, { status: 500 });
  }
}
