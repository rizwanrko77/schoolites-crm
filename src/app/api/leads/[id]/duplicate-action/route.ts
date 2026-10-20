import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const leadRes = await sql`SELECT id, lead_code, institute_name, is_duplicate FROM leads WHERE id = ${id} LIMIT 1`;
    if (leadRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const lead = leadRes[0];

    if (action === 'clear_flag' || action === 'clear') {
      await sql`
        UPDATE leads 
        SET is_duplicate = FALSE, duplicate_flag_cleared = TRUE, updated_at = NOW() 
        WHERE id = ${id}
      `;

      try {
        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'duplicate_flag_cleared', ${JSON.stringify({
            lead_code: lead.lead_code,
            admin_name: user.name,
          })})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for clearing duplicate flag:', auditErr);
      }

      return NextResponse.json({
        success: true,
        message: `Duplicate flag cleared for lead ${lead.lead_code}.`,
        lead: { ...lead, is_duplicate: false, duplicate_flag_cleared: true },
      });
    } else if (action === 'disqualify') {
      await sql`
        UPDATE leads 
        SET status = 'lost', updated_at = NOW() 
        WHERE id = ${id}
      `;

      try {
        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'duplicate_disqualified', ${JSON.stringify({
            lead_code: lead.lead_code,
            admin_name: user.name,
          })})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for duplicate disqualification:', auditErr);
      }

      return NextResponse.json({
        success: true,
        message: `Lead ${lead.lead_code} marked as Disqualified/Lost.`,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process duplicate action' }, { status: 500 });
  }
}
