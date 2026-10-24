import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

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
    const { status } = body;

    const validStatuses = ['new', 'contacted', 'in_discussion', 'converted_to_lead', 'discarded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
    }

    // Verify permissions:
    // Admin, or owner of the enquiry, or Pre-Sales/BR team working on promoter pool enquiries
    let checkQuery;
    if (user.role === 'admin') {
      checkQuery = await sql`SELECT id, enquiry_code, status FROM enquiries WHERE id = ${id} LIMIT 1`;
    } else if (user.role === 'pre_sales' || user.role === 'business_relations') {
      checkQuery = await sql`
        SELECT id, enquiry_code, status 
        FROM enquiries 
        WHERE id = ${id} AND (owner_id = ${user.id} OR promoter_id IS NOT NULL) 
        LIMIT 1
      `;
    } else if (user.role === 'referral') {
      checkQuery = await sql`SELECT id, enquiry_code, status FROM enquiries WHERE id = ${id} AND owner_id = ${user.id} LIMIT 1`;
    } else {
      return NextResponse.json({ error: 'Unauthorized: Promoters cannot update enquiry statuses.' }, { status: 403 });
    }

    if (checkQuery.length === 0) {
      return NextResponse.json({ error: 'Enquiry not found or access denied.' }, { status: 404 });
    }

    const updated = await sql`
      UPDATE enquiries 
      SET status = ${status} 
      WHERE id = ${id} 
      RETURNING id, enquiry_code, status
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('enquiry', ${id}, ${user.id}, ${user.name}, 'enquiry_status_updated', ${JSON.stringify({
          from: checkQuery[0].status,
          to: status,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for enquiry status:', auditErr);
    }

    return NextResponse.json({ success: true, enquiry: updated[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update enquiry status' }, { status: 500 });
  }
}
