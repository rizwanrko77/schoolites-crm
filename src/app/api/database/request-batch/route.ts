import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (!currentUser.has_database_access && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Places Database access disabled.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { preferred_city, notes, requested_count = 25 } = body;

    // Check actor's current remaining unworked records
    const countRes = await sql`
      SELECT COUNT(*)::int as remaining_count
      FROM db_businesses
      WHERE assigned_to_user_id = ${currentUser.id} AND status = 'new';
    `;
    const remainingCount = countRes[0]?.remaining_count || 0;

    // RULE: actor can request when 10 or less remains
    if (remainingCount > 10 && currentUser.role !== 'admin') {
      return NextResponse.json({
        error: `You currently have ${remainingCount} unworked prospect records remaining. You can request a new data batch when you have 10 or fewer records left.`,
        remainingCount,
      }, { status: 400 });
    }

    // Check if there's already a pending request
    const existingReq = await sql`
      SELECT id, status, created_at
      FROM db_pipeline_requests
      WHERE user_id = ${currentUser.id} AND status = 'pending'
      LIMIT 1;
    `;

    if (existingReq.length > 0) {
      return NextResponse.json({
        error: 'You already have a pending data request awaiting admin fulfillment.',
        request: existingReq[0],
      }, { status: 400 });
    }

    // Insert new request
    const insertRes = await sql`
      INSERT INTO db_pipeline_requests (
        user_id,
        remaining_count,
        requested_count,
        preferred_city,
        notes,
        status
      ) VALUES (
        ${currentUser.id},
        ${remainingCount},
        ${requested_count},
        ${preferred_city?.trim() || null},
        ${notes?.trim() || null},
        'pending'
      )
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      request: insertRes[0],
      message: 'New data request submitted to admin successfully!',
    });
  } catch (err: any) {
    console.error('Error in POST /api/database/request-batch:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit batch request' }, { status: 500 });
  }
}
