import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { asIdList, containsPattern, pushParam, type SqlValue } from '@/lib/queryParams';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const status = searchParams.get('status') || 'all';
    const city = searchParams.get('city') || 'all';
    const assignedTo = searchParams.get('assigned_to') || 'all';
    const parsedPage = parseInt(searchParams.get('page') || '1', 10);
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const offset = (page - 1) * limit;

    const params: SqlValue[] = [];
    const conditions: string[] = ['1=1'];

    if (status !== 'all') {
      if (status === 'fresh') {
        conditions.push(`(b.status = 'fresh' OR b.status = 'unassigned') AND b.assigned_to_user_id IS NULL`);
      } else {
        conditions.push(`b.status = ${pushParam(params, status)}`);
      }
    }

    if (city !== 'all') {
      conditions.push(`LOWER(b.city) = ${pushParam(params, city.toLowerCase())}`);
    }

    if (assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        conditions.push(`b.assigned_to_user_id IS NULL`);
      } else {
        conditions.push(`b.assigned_to_user_id::text = ${pushParam(params, assignedTo)}`);
      }
    }

    if (search) {
      const pattern = pushParam(params, containsPattern(search));
      conditions.push(`(
        LOWER(b.name) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.primary_phone, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.alternative_phone, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.city, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.search_keyword, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.street_address, '')) LIKE ${pattern} ESCAPE '\\' OR
        LOWER(COALESCE(b.place_id, '')) LIKE ${pattern} ESCAPE '\\'
      )`);
    }

    const whereClause = conditions.join(' AND ');
    const filterParams = [...params];
    const limitPlaceholder = pushParam(params, limit);
    const offsetPlaceholder = pushParam(params, offset);

    // Aggregate statistics across the entire database
    const statsQuery = await sql`
      SELECT
        COUNT(*)::int as total_records,
        COUNT(*) FILTER (WHERE status = 'fresh' OR status = 'unassigned')::int as fresh_count,
        COUNT(*) FILTER (WHERE assigned_to_user_id IS NOT NULL)::int as assigned_count,
        COUNT(*) FILTER (WHERE status = 'converted_to_lead')::int as converted_count,
        (SELECT COUNT(*)::int FROM db_pipeline_requests WHERE status = 'pending') as pending_requests_count
      FROM db_businesses;
    `;

    // Distinct cities for filter dropdown
    const citiesQuery = await sql`
      SELECT DISTINCT city 
      FROM db_businesses 
      WHERE city IS NOT NULL AND TRIM(city) != ''
      ORDER BY city ASC;
    `;

    // Users with DB access for assignment dropdown (pre_sales & referral only)
    const dbUsers = await sql`
      SELECT id, user_code, name, role 
      FROM users 
      WHERE has_database_access = TRUE AND is_active = TRUE AND role IN ('pre_sales', 'referral')
      ORDER BY name ASC;
    `;

    // Total count for filtered query
    const countQuery = await sql.query(`
      SELECT COUNT(*)::int as filtered_total
      FROM db_businesses b
      WHERE ${whereClause}
    `, filterParams);
    const totalFiltered = countQuery[0]?.filtered_total || 0;

    // Fetch paginated records with assigned user and lead details
    const recordsQuery = await sql.query(`
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
        b.assigned_by,
        b.last_contacted_at,
        b.callback_at,
        b.notes,
        b.converted_lead_id,
        b.created_at,
        b.updated_at,
        u.name as assigned_user_name,
        u.user_code as assigned_user_code,
        u.role as assigned_user_role,
        l.lead_code as converted_lead_code,
        l.status as converted_lead_status
      FROM db_businesses b
      LEFT JOIN users u ON b.assigned_to_user_id = u.id
      LEFT JOIN leads l ON b.converted_lead_id = l.id
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN b.status = 'fresh' THEN 0 ELSE 1 END,
        b.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `, params);

    return NextResponse.json({
      records: recordsQuery,
      pagination: {
        total: totalFiltered,
        page,
        limit,
        totalPages: Math.ceil(totalFiltered / limit),
      },
      stats: statsQuery[0] || {
        total_records: 0,
        fresh_count: 0,
        assigned_count: 0,
        converted_count: 0,
        pending_requests_count: 0,
      },
      cities: citiesQuery.map((r: any) => r.city),
      dbUsers,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/places:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch places' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { place_ids, user_id } = body;

    if (!Array.isArray(place_ids) || place_ids.length === 0) {
      return NextResponse.json({ error: 'Please select at least one place record to assign.' }, { status: 400 });
    }

    if (!user_id) {
      return NextResponse.json({ error: 'Please select a team member to assign records to.' }, { status: 400 });
    }

    // Verify target user has DB access
    const userRes = await sql`
      SELECT id, name, user_code, role, has_database_access 
      FROM users 
      WHERE id = ${user_id} AND is_active = TRUE
      LIMIT 1;
    `;

    if (userRes.length === 0) {
      return NextResponse.json({ error: 'Selected user does not exist or is deactivated.' }, { status: 400 });
    }

    const targetUser = userRes[0];
    if (!targetUser.has_database_access || (targetUser.role !== 'pre_sales' && targetUser.role !== 'referral')) {
      return NextResponse.json(
        { error: `${targetUser.name} is not eligible for Places Database access (Pre-Sales and Referral roles only).` },
        { status: 400 }
      );
    }

    const ids = asIdList(place_ids);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Please select at least one place record to assign.' }, { status: 400 });
    }

    const existingPlaces = await sql.query(`
      SELECT id, place_id, name, status, assigned_to_user_id
      FROM db_businesses
      WHERE id::text = ANY($1::text[]) OR place_id = ANY($1::text[])
    `, [ids]);

    await sql.query(`
      UPDATE db_businesses
      SET
        assigned_to_user_id = $1::uuid,
        assigned_at = NOW(),
        assigned_by = $2::uuid,
        status = 'new',
        updated_at = NOW()
      WHERE id::text = ANY($3::text[]) OR place_id = ANY($3::text[])
    `, [targetUser.id, currentUser.id, ids]);

    // Record audit history entries
    for (const p of existingPlaces) {
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
          ${p.status},
          'new',
          ${`Assigned to ${targetUser.name} (${targetUser.user_code}) by ${currentUser.name}`},
          ${JSON.stringify({ assigned_to: targetUser.id, assigned_to_name: targetUser.name })}
        );
      `;
    }

    return NextResponse.json({
      success: true,
      assignedCount: existingPlaces.length,
      assignedTo: {
        id: targetUser.id,
        name: targetUser.name,
        user_code: targetUser.user_code,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/places:', err);
    return NextResponse.json({ error: err.message || 'Failed to assign places' }, { status: 500 });
  }
}
