import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { asIdList, pushParam, type SqlValue } from '@/lib/queryParams';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const allowedStatuses = ['pending', 'fulfilled', 'rejected'];

    const params: SqlValue[] = [];
    const conditions: string[] = ['1=1'];
    if (status !== 'all') {
      const safeStatus = allowedStatuses.includes(status) ? status : 'pending';
      conditions.push(`r.status = ${pushParam(params, safeStatus)}`);
    }

    const whereClause = conditions.join(' AND ');

    const requests = await sql.query(`
      SELECT 
        r.id,
        r.user_id,
        r.remaining_count,
        r.requested_count,
        r.preferred_city,
        r.notes,
        r.status,
        r.fulfilled_by,
        r.fulfilled_count,
        r.fulfilled_at,
        r.created_at,
        u.name as user_name,
        u.user_code,
        u.role as user_role,
        u.email as user_email,
        fb.name as fulfilled_by_name
      FROM db_pipeline_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users fb ON r.fulfilled_by = fb.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
    `, params);

    return NextResponse.json({ requests });
  } catch (err: any) {
    console.error('Error in GET /api/admin/places/requests:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch data requests' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { request_id, batch_size, action = 'fulfill', place_ids } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }

    const reqRes = await sql`
      SELECT r.*, u.name as user_name, u.user_code, u.has_database_access 
      FROM db_pipeline_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ${request_id}
      LIMIT 1;
    `;

    if (reqRes.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const request = reqRes[0];

    if (request.status !== 'pending') {
      return NextResponse.json({ error: `This request has already been ${request.status}.` }, { status: 400 });
    }

    if (action === 'reject') {
      await sql`
        UPDATE db_pipeline_requests
        SET status = 'rejected', fulfilled_by = ${currentUser.id}, fulfilled_at = NOW()
        WHERE id = ${request.id};
      `;
      return NextResponse.json({ success: true, message: 'Request rejected' });
    }

    // Fulfill request
    let freshRecordsQuery: any[] = [];

    const selectedIds = asIdList(place_ids);
    if (selectedIds.length > 0) {
      freshRecordsQuery = await sql.query(`
        SELECT id, place_id, name, city, status
        FROM db_businesses
        WHERE id::text = ANY($1::text[])
          AND (status = 'fresh' OR status = 'unassigned')
          AND assigned_to_user_id IS NULL
      `, [selectedIds]);
    } else {
      const requestedSize = Number(batch_size || request.requested_count || 25);
      const countToAssign = Number.isFinite(requestedSize)
        ? Math.min(Math.max(Math.floor(requestedSize), 1), 200)
        : 25;
      const preferredCity = request.preferred_city;

      // Fetch fresh records (prioritizing preferred city if specified)
      if (preferredCity && preferredCity.trim()) {
        freshRecordsQuery = await sql`
          SELECT id, place_id, name, city, status
          FROM db_businesses
          WHERE (status = 'fresh' OR status = 'unassigned') AND assigned_to_user_id IS NULL
          ORDER BY 
            CASE WHEN LOWER(city) = LOWER(${preferredCity.trim()}) THEN 0 ELSE 1 END,
            created_at ASC
          LIMIT ${countToAssign};
        `;
      } else {
        freshRecordsQuery = await sql`
          SELECT id, place_id, name, city, status
          FROM db_businesses
          WHERE (status = 'fresh' OR status = 'unassigned') AND assigned_to_user_id IS NULL
          ORDER BY created_at ASC
          LIMIT ${countToAssign};
        `;
      }
    }

    if (freshRecordsQuery.length === 0) {
      return NextResponse.json({
        error: 'No fresh unassigned prospect records available in the central pool. Please import new CSV data or run a Places API search first.',
      }, { status: 400 });
    }

    const placeIds = freshRecordsQuery.map((r: any) => String(r.id));

    await sql.query(`
      UPDATE db_businesses
      SET
        assigned_to_user_id = $1::uuid,
        assigned_at = NOW(),
        assigned_by = $2::uuid,
        status = 'new',
        updated_at = NOW()
      WHERE id = ANY($3::uuid[])
    `, [request.user_id, currentUser.id, placeIds]);

    // Mark request fulfilled
    await sql`
      UPDATE db_pipeline_requests
      SET
        status = 'fulfilled',
        fulfilled_by = ${currentUser.id},
        fulfilled_count = ${freshRecordsQuery.length},
        fulfilled_at = NOW()
      WHERE id = ${request.id};
    `;

    // Record audit entries
    for (const p of freshRecordsQuery) {
      await sql`
        INSERT INTO db_place_history (
          place_id,
          business_id,
          actor_id,
          action,
          old_status,
          new_status,
          notes,
          metadata
        ) VALUES (
          ${p.place_id},
          ${p.id},
          ${currentUser.id},
          'assigned',
          'fresh',
          'new',
          ${`Fulfilled batch request (${freshRecordsQuery.length} items) for ${request.user_name} (${request.user_code})`},
          ${JSON.stringify({ request_id: request.id, assigned_to: request.user_id })}
        );
      `;
    }

    return NextResponse.json({
      success: true,
      fulfilledCount: freshRecordsQuery.length,
      assignedTo: {
        id: request.user_id,
        name: request.user_name,
        user_code: request.user_code,
      },
      message: `Successfully fulfilled request: assigned ${freshRecordsQuery.length} fresh prospects to ${request.user_name}.`,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/places/requests:', err);
    return NextResponse.json({ error: err.message || 'Failed to fulfill request' }, { status: 500 });
  }
}
