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

    if (user.role !== 'business_relations' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Business Relations representatives can grab leads.' }, { status: 403 });
    }

    const { id } = await params;

    // Concurrency-safe atomic grab:
    // Only succeeds if the lead has no manager assigned yet
    const grabRes = await sql`
      UPDATE leads
      SET manager_id = ${user.id}, status = 'assigned', updated_at = NOW()
      WHERE id = ${id} AND manager_id IS NULL
      RETURNING id, lead_code, institute_name, status, manager_id
    `;

    if (grabRes.length === 0) {
      return NextResponse.json(
        { error: 'This lead has already been claimed by another representative.' },
        { status: 409 }
      );
    }

    const lead = grabRes[0];

    // Audit Log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('lead', ${lead.id}, ${user.id}, ${user.name}, 'lead_grabbed', ${JSON.stringify({
          lead_code: lead.lead_code,
          manager_code: user.user_code,
          timestamp: new Date().toISOString(),
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for lead grab:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Lead ${lead.lead_code} successfully assigned to you!`,
      lead,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to grab lead' }, { status: 500 });
  }
}
