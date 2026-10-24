import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch place record
    const placeRes = await sql`
      SELECT 
        b.*,
        u.name as assigned_user_name,
        u.user_code as assigned_user_code,
        u.role as assigned_user_role,
        ab.name as assigned_by_name,
        l.lead_code as converted_lead_code,
        l.status as converted_lead_status
      FROM db_businesses b
      LEFT JOIN users u ON b.assigned_to_user_id = u.id
      LEFT JOIN users ab ON b.assigned_by = ab.id
      LEFT JOIN leads l ON b.converted_lead_id = l.id
      WHERE b.id::text = ${id} OR b.place_id = ${id}
      LIMIT 1;
    `;

    if (placeRes.length === 0) {
      return NextResponse.json({ error: 'Place record not found' }, { status: 404 });
    }

    const place = placeRes[0];

    // Fetch full audit trail
    const historyRes = await sql`
      SELECT 
        h.id,
        h.action,
        h.old_status,
        h.new_status,
        h.notes,
        h.metadata,
        h.created_at,
        u.name as actor_name,
        u.user_code as actor_code,
        u.role as actor_role
      FROM db_place_history h
      LEFT JOIN users u ON h.actor_id = u.id
      WHERE h.place_id = ${place.place_id} OR h.business_id = ${place.id}
      ORDER BY h.created_at DESC;
    `;

    return NextResponse.json({
      place,
      history: historyRes,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/places/[id]:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch place details' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingRes = await sql`
      SELECT id, place_id, name, status, notes
      FROM db_businesses
      WHERE id::text = ${id} OR place_id = ${id}
      LIMIT 1;
    `;

    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Place record not found' }, { status: 404 });
    }

    const existing = existingRes[0];
    const newStatus = body.status !== undefined ? body.status : existing.status;
    const newNotes = body.notes !== undefined ? body.notes : existing.notes;

    const updated = await sql`
      UPDATE db_businesses
      SET
        status = ${newStatus},
        notes = ${newNotes},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *;
    `;

    // Audit log
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
        ${existing.place_id},
        ${existing.id},
        ${currentUser.id},
        'admin_updated',
        ${existing.status},
        ${newStatus},
        ${`Updated by Admin ${currentUser.name}: ${newNotes || 'Status updated'}`},
        ${JSON.stringify({ updated_by: currentUser.name })}
      );
    `;

    return NextResponse.json({ success: true, place: updated[0] });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/places/[id]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update place' }, { status: 500 });
  }
}
