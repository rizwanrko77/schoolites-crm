import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch lead details
    const leadRes = await sql`
      SELECT l.*,
             u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code,
             l_dup.lead_code as duplicate_of_code, l_dup.institute_name as duplicate_of_institute,
             e.enquiry_code as source_enquiry_code
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      LEFT JOIN leads l_dup ON l.duplicate_of_lead_id = l_dup.id
      LEFT JOIN enquiries e ON l.source_enquiry_id = e.id
      WHERE l.id = ${id}
      LIMIT 1
    `;

    if (leadRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const lead = leadRes[0];

    // Role-based view protection:
    // Pre-Sales and Referral partners can only see leads they created
    if ((user.role === 'pre_sales' || user.role === 'referral') && lead.owner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to view this lead.' }, { status: 403 });
    }

    // Fetch notes: Admin sees all; regular user sees global + personal notes authored by themselves
    let notes;
    if (user.role === 'admin') {
      notes = await sql`
        SELECT n.id, n.author_id, n.visibility, n.content, n.created_at,
               u.name as author_name, u.user_code as author_code, u.role as author_role
        FROM record_notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.record_type = 'lead' AND n.record_id = ${id}
        ORDER BY n.created_at ASC
      `;
    } else {
      notes = await sql`
        SELECT n.id, n.author_id, n.visibility, n.content, n.created_at,
               u.name as author_name, u.user_code as author_code, u.role as author_role
        FROM record_notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.record_type = 'lead' AND n.record_id = ${id}
          AND (n.visibility = 'global' OR n.author_id = ${user.id})
        ORDER BY n.created_at ASC
      `;
    }

    // Fetch audit history for this lead (latest on top)
    const auditLogs = await sql`
      SELECT id, actor_id, actor_name, action, metadata, created_at
      FROM audit_logs
      WHERE record_type = 'lead' AND record_id = ${id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ lead, notes, audit_logs: auditLogs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch lead details' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { status, deal_value, decision_flow, preferred_slot_date, preferred_slot_time, preferred_slot_mode, expected_start_date, additional_details } = body;

    const existingRes = await sql`SELECT id, lead_code, status, deal_value, manager_id, owner_id FROM leads WHERE id = ${id} LIMIT 1`;
    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const existing = existingRes[0];

    // Only manager, owner, or admin can update lead
    if (user.role !== 'admin' && existing.manager_id !== user.id && existing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to modify this lead.' }, { status: 403 });
    }

    const updateRes = await sql`
      UPDATE leads
      SET 
        status = COALESCE(${status ?? null}, status),
        deal_value = COALESCE(${deal_value !== undefined ? parseFloat(deal_value) : null}, deal_value),
        decision_flow = COALESCE(${decision_flow ?? null}, decision_flow),
        preferred_slot_date = COALESCE(${preferred_slot_date ?? null}, preferred_slot_date),
        preferred_slot_time = COALESCE(${preferred_slot_time ?? null}, preferred_slot_time),
        preferred_slot_mode = COALESCE(${preferred_slot_mode ?? null}, preferred_slot_mode),
        expected_start_date = COALESCE(${expected_start_date ?? null}, expected_start_date),
        additional_details = COALESCE(${additional_details ?? null}, additional_details),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Audit Log for status change
    if (status && status !== existing.status) {
      try {
        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'lead_status_changed', ${JSON.stringify({
            from: existing.status,
            to: status,
            lead_code: existing.lead_code,
          })})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for status change:', auditErr);
      }
    }

    return NextResponse.json({ success: true, lead: updateRes[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update lead' }, { status: 500 });
  }
}
