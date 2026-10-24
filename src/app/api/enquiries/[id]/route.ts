import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

const VALID_STATUSES = ['new', 'contacted', 'in_discussion', 'converted_to_lead', 'discarded'];

// PATCH: Update an enquiry's status and/or internal notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (user.role === 'promoter') {
      return NextResponse.json({ error: 'Promoters have read-only access to enquiries.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, internal_notes } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status value. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify record exists and check authorization
    const checkQuery = await sql`
      SELECT id, enquiry_code, owner_id, promoter_id, status, internal_notes 
      FROM enquiries 
      WHERE id = ${id} 
      LIMIT 1
    `;

    if (checkQuery.length === 0) {
      return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    }

    const currentEnq = checkQuery[0];

    // Authorization: Admin can update any. Others must own or be pre_sales/BR handling promoter enquiries.
    const isOwner = currentEnq.owner_id === user.id;
    const isPreSalesOrBR = user.role === 'pre_sales' || user.role === 'business_relations';
    const isPromoterEnq = currentEnq.promoter_id !== null;

    if (user.role !== 'admin' && !isOwner && !(isPreSalesOrBR && isPromoterEnq)) {
      return NextResponse.json({ error: 'Access denied: You do not have permission to edit this enquiry.' }, { status: 403 });
    }

    // Prepare update fields
    const newStatus = status !== undefined ? status : currentEnq.status;
    const newNotes = internal_notes !== undefined ? internal_notes : currentEnq.internal_notes;

    const updated = await sql`
      UPDATE enquiries 
      SET status = ${newStatus}, internal_notes = ${newNotes}
      WHERE id = ${id} 
      RETURNING id, enquiry_code, status, internal_notes, owner_id, claimed_at
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('enquiry', ${id}, ${user.id}, ${user.name}, 'enquiry_updated', ${JSON.stringify({
          enquiry_code: currentEnq.enquiry_code,
          status_changed: status !== undefined && status !== currentEnq.status,
          old_status: currentEnq.status,
          new_status: newStatus,
          notes_updated: internal_notes !== undefined && internal_notes !== currentEnq.internal_notes,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for enquiry update:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Enquiry updated successfully.',
      enquiry: updated[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update enquiry' }, { status: 500 });
  }
}
