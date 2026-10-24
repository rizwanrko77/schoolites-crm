import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

const MAX_UNCONTACTED_WIP_LIMIT = 5;

// POST: Claim/Grab an unclaimed promoter enquiry from the pool
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    // Only Pre-Sales, Business Relations, or Admins can claim pool enquiries
    if (user.role !== 'pre_sales' && user.role !== 'business_relations' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Pre-Sales and Business Relations reps can claim pool enquiries.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 1. Enforce WIP Limit: rep cannot hoard more than 5 uncontacted ('new') enquiries
    if (user.role !== 'admin') {
      const wipCheck = await sql`
        SELECT COUNT(*)::int as count 
        FROM enquiries 
        WHERE owner_id = ${user.id} AND status = 'new'
      `;
      const currentUncontacted = wipCheck[0]?.count || 0;
      if (currentUncontacted >= MAX_UNCONTACTED_WIP_LIMIT) {
        return NextResponse.json(
          {
            error: `WIP limit reached: You currently have ${currentUncontacted} uncontacted enquiries. Please reach out to them and update their status (e.g. Contacted or In Discussion) before claiming more.`,
            wip_limit: MAX_UNCONTACTED_WIP_LIMIT,
            current_uncontacted: currentUncontacted,
          },
          { status: 400 }
        );
      }
    }

    // 2. Fetch the target enquiry and check eligibility
    const targetEnquiry = await sql`
      SELECT id, enquiry_code, owner_id, promoter_id, claimed_at, status 
      FROM enquiries 
      WHERE id = ${id} 
      LIMIT 1
    `;

    if (targetEnquiry.length === 0) {
      return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    }

    const enq = targetEnquiry[0];

    // Must be a promoter enquiry
    if (!enq.promoter_id) {
      return NextResponse.json({ error: 'Only promoter-sourced enquiries can be claimed from the pool.' }, { status: 400 });
    }

    // Must not be already converted or discarded
    if (enq.status === 'converted_to_lead' || enq.status === 'discarded') {
      return NextResponse.json({ error: `Cannot claim an enquiry that is already ${enq.status}.` }, { status: 400 });
    }

    // Must not be claimed by another rep (claimed_at is set AND owner is not the promoter)
    if (enq.claimed_at && enq.owner_id !== enq.promoter_id) {
      return NextResponse.json(
        { error: 'This enquiry has already been claimed by another representative.' },
        { status: 409 }
      );
    }

    // 3. Atomically update owner and set claimed_at
    const claimResult = await sql`
      UPDATE enquiries 
      SET owner_id = ${user.id}, claimed_at = NOW() 
      WHERE id = ${id} AND (claimed_at IS NULL OR owner_id = promoter_id)
      RETURNING id, enquiry_code, owner_id, claimed_at, status
    `;

    if (claimResult.length === 0) {
      return NextResponse.json(
        { error: 'Conflict: This enquiry was just claimed by another representative.' },
        { status: 409 }
      );
    }

    const updated = claimResult[0];

    // 4. Audit Log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('enquiry', ${id}, ${user.id}, ${user.name}, 'enquiry_claimed', ${JSON.stringify({
          enquiry_code: updated.enquiry_code,
          claimed_by: user.name,
          claimed_by_code: user.user_code,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for enquiry claim:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Enquiry ${updated.enquiry_code} successfully claimed and moved to your direct enquiries.`,
      enquiry: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to claim enquiry' }, { status: 500 });
  }
}
