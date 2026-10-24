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
      return NextResponse.json(
        { error: 'Forbidden: You do not have Places Database Access enabled.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { place_id, lead_id, lead_code } = body;

    if (!place_id || !lead_id) {
      return NextResponse.json({ error: 'Both place_id and lead_id are required' }, { status: 400 });
    }

    const placeRes = await sql`
      SELECT id, place_id, name, status, assigned_to_user_id 
      FROM db_businesses 
      WHERE id::text = ${place_id} OR place_id = ${place_id}
      LIMIT 1;
    `;

    if (placeRes.length === 0) {
      return NextResponse.json({ error: 'Place record not found' }, { status: 404 });
    }

    const place = placeRes[0];

    if (place.assigned_to_user_id !== currentUser.id && currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'You can only convert places assigned to you.' },
        { status: 403 }
      );
    }

    const leadRes = await sql`
      SELECT id, lead_code, owner_id
      FROM leads
      WHERE id = ${lead_id}
      LIMIT 1
    `;
    if (leadRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }
    const linkedLead = leadRes[0];
    if (currentUser.role !== 'admin' && linkedLead.owner_id !== currentUser.id) {
      return NextResponse.json(
        { error: 'You can only attach a lead you created.' },
        { status: 403 }
      );
    }
    const linkedCode = linkedLead.lead_code || lead_code || lead_id;

    // Update place status to converted_to_lead
    await sql`
      UPDATE db_businesses
      SET
        status = 'converted_to_lead',
        converted_lead_id = ${lead_id},
        last_contacted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${place.id};
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
        'converted_to_lead',
        ${place.status},
        'converted_to_lead',
        ${`Converted to CRM Lead [${linkedCode}] by ${currentUser.name}`},
        ${JSON.stringify({ lead_id, lead_code: linkedCode, converted_by: currentUser.name })}
      );
    `;

    return NextResponse.json({
      success: true,
      message: `Place successfully converted to Lead ${linkedCode}`,
    });
  } catch (err: any) {
    console.error('Error in POST /api/database/convert-lead:', err);
    return NextResponse.json({ error: err.message || 'Failed to convert place to lead' }, { status: 500 });
  }
}
