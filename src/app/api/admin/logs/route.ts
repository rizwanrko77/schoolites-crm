import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const limitParam = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.min(Math.max(limitParam, 20), 200);

    let logs: any[] = [];

    if (category === 'database') {
      // Query database places outreach & data requests only
      logs = await sql`
        WITH top_places AS (
          SELECT 
            h.id,
            'database_place'::text AS record_type,
            h.business_id::text AS record_id,
            h.actor_id,
            COALESCE(u.name, 'Pre-Sales') AS actor_name,
            h.action,
            jsonb_build_object(
              'place_id', h.place_id,
              'school_name', b.name,
              'city', b.city,
              'old_status', h.old_status,
              'new_status', h.new_status,
              'notes', h.notes,
              'metadata', h.metadata
            ) AS metadata,
            h.created_at
          FROM db_place_history h
          LEFT JOIN users u ON h.actor_id = u.id
          LEFT JOIN db_businesses b ON h.business_id = b.id
          ORDER BY h.created_at DESC
          LIMIT ${limit}
        ),
        top_requests AS (
          SELECT 
            r.id,
            'database_request'::text AS record_type,
            r.id::text AS record_id,
            r.user_id AS actor_id,
            COALESCE(u.name, 'Pre-Sales') AS actor_name,
            'batch_quota_requested'::text AS action,
            jsonb_build_object(
              'requested_count', r.requested_count,
              'remaining_count', r.remaining_count,
              'preferred_city', r.preferred_city,
              'notes', r.notes,
              'status', r.status
            ) AS metadata,
            r.created_at
          FROM db_pipeline_requests r
          LEFT JOIN users u ON r.user_id = u.id
          ORDER BY r.created_at DESC
          LIMIT 50
        )
        SELECT * FROM (
          SELECT * FROM top_places
          UNION ALL
          SELECT * FROM top_requests
        ) q
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    } else if (category === 'leads') {
      logs = await sql`
        SELECT id, record_type, record_id::text, actor_id, actor_name, action, metadata, created_at
        FROM audit_logs
        WHERE record_type = 'lead'
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    } else if (category === 'enquiries') {
      logs = await sql`
        SELECT id, record_type, record_id::text, actor_id, actor_name, action, metadata, created_at
        FROM audit_logs
        WHERE record_type = 'enquiry'
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    } else if (category === 'users') {
      logs = await sql`
        SELECT id, record_type, record_id::text, actor_id, actor_name, action, metadata, created_at
        FROM audit_logs
        WHERE record_type = 'user'
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    } else {
      // 'all' category: High-performance union of top records from each source
      logs = await sql`
        WITH top_audit AS (
          SELECT 
            id,
            record_type,
            record_id::text,
            actor_id,
            actor_name,
            action,
            metadata,
            created_at
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT ${limit}
        ),
        top_places AS (
          SELECT 
            h.id,
            'database_place'::text AS record_type,
            h.business_id::text AS record_id,
            h.actor_id,
            COALESCE(u.name, 'Pre-Sales') AS actor_name,
            h.action,
            jsonb_build_object(
              'place_id', h.place_id,
              'school_name', b.name,
              'city', b.city,
              'old_status', h.old_status,
              'new_status', h.new_status,
              'notes', h.notes,
              'metadata', h.metadata
            ) AS metadata,
            h.created_at
          FROM db_place_history h
          LEFT JOIN users u ON h.actor_id = u.id
          LEFT JOIN db_businesses b ON h.business_id = b.id
          ORDER BY h.created_at DESC
          LIMIT ${limit}
        ),
        top_requests AS (
          SELECT 
            r.id,
            'database_request'::text AS record_type,
            r.id::text AS record_id,
            r.user_id AS actor_id,
            COALESCE(u.name, 'Pre-Sales') AS actor_name,
            'batch_quota_requested'::text AS action,
            jsonb_build_object(
              'requested_count', r.requested_count,
              'remaining_count', r.remaining_count,
              'preferred_city', r.preferred_city,
              'notes', r.notes,
              'status', r.status
            ) AS metadata,
            r.created_at
          FROM db_pipeline_requests r
          LEFT JOIN users u ON r.user_id = u.id
          ORDER BY r.created_at DESC
          LIMIT 40
        )
        SELECT * FROM (
          SELECT * FROM top_audit
          UNION ALL
          SELECT * FROM top_places
          UNION ALL
          SELECT * FROM top_requests
        ) combined
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('Error in GET /api/admin/logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
