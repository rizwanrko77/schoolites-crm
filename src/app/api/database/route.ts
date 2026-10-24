import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { containsPattern, pushParam, type SqlValue } from '@/lib/queryParams';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (!currentUser.has_database_access && currentUser.role !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden: You do not have Places Database Access enabled. Contact your administrator.',
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'new'; // 'new' or 'assigned'
    const status = searchParams.get('status') || 'all';
    const city = searchParams.get('city') || 'all';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    // Calculate queue metrics for the actor
    const metricsRes = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new')::int as unworked_count,
        COUNT(*) FILTER (WHERE status NOT IN ('fresh', 'unassigned', 'new', 'converted_to_lead'))::int as active_outreach_count,
        COUNT(*) FILTER (WHERE status = 'converted_to_lead')::int as converted_count,
        COUNT(*)::int as total_assigned
      FROM db_businesses
      WHERE assigned_to_user_id = ${currentUser.id};
    `;

    // Check if user has an active pending batch request
    const pendingReqRes = await sql`
      SELECT id, remaining_count, requested_count, preferred_city, status, created_at
      FROM db_pipeline_requests
      WHERE user_id = ${currentUser.id} AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const params: SqlValue[] = [];
    const conditions: string[] = [`b.assigned_to_user_id = ${pushParam(params, currentUser.id)}::uuid`];

    if (tab === 'new') {
      conditions.push(`b.status = 'new'`);
    } else {
      conditions.push(`b.status != 'new' AND b.status != 'fresh'`);
      if (status !== 'all') {
        conditions.push(`b.status = ${pushParam(params, status)}`);
      }
    }

    if (city !== 'all') {
      conditions.push(`LOWER(b.city) = ${pushParam(params, city.toLowerCase())}`);
    }

    if (search) {
      const pattern = pushParam(params, containsPattern(search));
      conditions.push(`(
        LOWER(b.name) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.primary_phone, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.alternative_phone, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.city, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.area, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.street_address, '')) LIKE ${pattern} ESCAPE '\\'
      )`);
    }

    const whereClause = conditions.join(' AND ');

    const records = await sql.query(`
      SELECT 
        b.id,
        b.place_id,
        b.name,
        b.primary_phone,
        b.alternative_phone,
        b.website,
        b.maps_url,
        b.rating,
        b.rating_count,
        b.primary_type,
        b.type_tags,
        b.formatted_address,
        b.street_address,
        b.area,
        b.city,
        b.state,
        b.postal_code,
        b.country,
        b.business_status,
        b.regular_opening_hours,
        b.search_keyword,
        b.search_city,
        b.search_area,
        b.status,
        b.assigned_to_user_id,
        b.assigned_at,
        b.last_contacted_at,
        b.callback_at,
        b.notes,
        b.converted_lead_id,
        b.created_at,
        b.updated_at,
        l.lead_code as converted_lead_code,
        l.status as converted_lead_status
      FROM db_businesses b
      LEFT JOIN leads l ON b.converted_lead_id = l.id
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN b.callback_at IS NOT NULL AND b.callback_at >= NOW() THEN 0 ELSE 1 END,
        b.updated_at DESC
      LIMIT 100
    `, params);

    // Available cities for actor's assigned data
    const citiesRes = await sql`
      SELECT DISTINCT city 
      FROM db_businesses 
      WHERE assigned_to_user_id = ${currentUser.id} AND city IS NOT NULL AND TRIM(city) != ''
      ORDER BY city ASC;
    `;

    return NextResponse.json({
      records,
      metrics: metricsRes[0] || {
        unworked_count: 0,
        active_outreach_count: 0,
        converted_count: 0,
        total_assigned: 0,
      },
      pendingRequest: pendingReqRes[0] || null,
      cities: citiesRes.map((r: any) => r.city),
    });
  } catch (err: any) {
    console.error('Error in GET /api/database:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch assigned places' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (!currentUser.has_database_access && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Places Database access disabled.' }, { status: 403 });
    }

    const body = await req.json();
    const { place_id, status, notes, callback_at } = body;

    if (!place_id) {
      return NextResponse.json({ error: 'place_id is required' }, { status: 400 });
    }

    const validStatuses = [
      'new',
      'rnr',
      'switched_off',
      'interested',
      'contact_later',
      'not_interested',
      'following_up',
      'converted_to_lead',
    ];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid outreach status' }, { status: 400 });
    }

    // Verify record is assigned to current user (unless admin)
    const existing = await sql`
      SELECT id, place_id, name, status, notes, assigned_to_user_id 
      FROM db_businesses 
      WHERE (id::text = ${place_id} OR place_id = ${place_id})
      LIMIT 1;
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Place record not found' }, { status: 404 });
    }

    const place = existing[0];
    if (place.assigned_to_user_id !== currentUser.id && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'You are not assigned to this record' }, { status: 403 });
    }

    const oldStatus = place.status;
    const newStatus = status || oldStatus;
    const updatedNotes = notes !== undefined ? notes : place.notes;
    let callbackTimestamp: string | null = null;
    if (callback_at && typeof callback_at === 'string' && callback_at.trim()) {
      try {
        const d = new Date(callback_at);
        if (!isNaN(d.getTime())) {
          callbackTimestamp = d.toISOString();
        }
      } catch {}
    }

    const updatedRes = await sql`
      UPDATE db_businesses
      SET
        status = ${newStatus},
        notes = ${updatedNotes},
        callback_at = ${callbackTimestamp},
        last_contacted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${place.id}
      RETURNING *;
    `;

    // Record audit trail
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
        ${place.place_id},
        ${place.id},
        ${currentUser.id},
        ${newStatus !== oldStatus ? 'status_changed' : 'note_added'},
        ${oldStatus},
        ${newStatus},
        ${updatedNotes || `Status changed from ${oldStatus} to ${newStatus}`},
        ${JSON.stringify({ callback_at: callbackTimestamp, actor_name: currentUser.name })}
      );
    `;

    return NextResponse.json({
      success: true,
      place: updatedRes[0],
      message: 'Outreach update saved successfully',
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/database:', err);
    return NextResponse.json({ error: err.message || 'Failed to update outreach record' }, { status: 500 });
  }
}
