import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (status !== 'all') {
      if (status === 'fresh') {
        conditions.push(`(b.status = 'fresh' OR b.status = 'unassigned') AND b.assigned_to_user_id IS NULL`);
      } else {
        conditions.push(`b.status = '${status.replace(/'/g, "''")}'`);
      }
    }

    if (city !== 'all') {
      conditions.push(`LOWER(b.city) = '${city.toLowerCase().replace(/'/g, "''")}'`);
    }

    if (assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        conditions.push(`b.assigned_to_user_id IS NULL`);
      } else {
        conditions.push(`b.assigned_to_user_id = '${assignedTo.replace(/'/g, "''")}'`);
      }
    }

    if (search) {
      const s = search.replace(/'/g, "''");
      conditions.push(`(
        LOWER(b.name) LIKE '%${s}%' OR
        LOWER(b.primary_phone) LIKE '%${s}%' OR
        LOWER(COALESCE(b.alternative_phone, '')) LIKE '%${s}%' OR
        LOWER(COALESCE(b.city, '')) LIKE '%${s}%' OR
        LOWER(COALESCE(b.search_keyword, '')) LIKE '%${s}%' OR
        LOWER(COALESCE(b.street_address, '')) LIKE '%${s}%' OR
        LOWER(COALESCE(b.place_id, '')) LIKE '%${s}%'
      )`);
    }

    const whereClause = conditions.join(' AND ');

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

    // Users with DB access for assignment dropdown
    const dbUsers = await sql`
      SELECT id, user_code, name, role 
      FROM users 
      WHERE has_database_access = TRUE AND is_active = TRUE
      ORDER BY name ASC;
    `;

    // Total count for filtered query
    const countQuery = await sql.query(`
      SELECT COUNT(*)::int as filtered_total
      FROM db_businesses b
      WHERE ${whereClause}
    `);
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
      LIMIT ${limit} OFFSET ${offset};
    `);

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
    if (!targetUser.has_database_access) {
      return NextResponse.json(
        { error: `${targetUser.name} does not have Places Database Access enabled. Enable it in their user profile first.` },
        { status: 400 }
      );
    }

    // Bulk assign records
    const sanitizedIds = place_ids.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',');
    
    // Fetch places to record audit history
    const existingPlaces = await sql.query(`
      SELECT id, place_id, name, status, assigned_to_user_id 
      FROM db_businesses 
      WHERE id::text IN (${sanitizedIds}) OR place_id IN (${sanitizedIds});
    `);

    // Perform bulk update
    await sql.query(`
      UPDATE db_businesses
      SET
        assigned_to_user_id = '${targetUser.id}',
        assigned_at = NOW(),
        assigned_by = '${currentUser.id}',
        status = 'new',
        updated_at = NOW()
      WHERE id::text IN (${sanitizedIds}) OR place_id IN (${sanitizedIds});
    `);

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
