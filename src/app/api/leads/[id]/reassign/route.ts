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

    // Deal closed check: Only Admin can reassign won/lost leads
    if ((lead.status === 'won' || lead.status === 'lost') && user.role !== 'admin') {
      return NextResponse.json({ error: 'Deal is closed. Only Admin can reassign a finalized deal.' }, { status: 403 });
    }

    // Only Admin or current assigned Manager can reassign
    if (user.role !== 'admin' && lead.manager_id !== user.id) {
      return NextResponse.json({ error: 'Only the assigned Lead Manager or an Admin can reassign this lead.' }, { status: 403 });
    }

    // Cannot reassign to the currently assigned manager
    if (lead.manager_id === new_manager_id) {
      return NextResponse.json({ error: 'This lead is already assigned to this representative.' }, { status: 400 });
    }

    // Verify target manager exists, is active, and belongs to Business Relations
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
    if (targetUser.role !== 'business_relations') {
      return NextResponse.json({ error: 'Leads can only be assigned to members of the Business Relations team.' }, { status: 400 });
    }

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
        VALUES ('lead', ${id}, ${user.id}, ${user.name}, ${lead.manager_id ? 'lead_reassigned' : 'lead_assigned'}, ${JSON.stringify({
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
      message: `Lead ${lead.lead_code} ${lead.manager_id ? 'reassigned' : 'assigned'} to ${targetUser.name} (${targetUser.user_code}).`,
      lead: updateRes[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reassign lead' }, { status: 500 });
  }
}
