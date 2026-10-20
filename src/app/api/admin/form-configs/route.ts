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
    const formType = searchParams.get('form_type');

    let configs;
    if (formType) {
      configs = await sql`
        SELECT id, form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order
        FROM form_field_configs
        WHERE form_type = ${formType}
        ORDER BY display_order ASC
      `;
    } else {
      configs = await sql`
        SELECT id, form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order
        FROM form_field_configs
        ORDER BY form_type ASC, display_order ASC
      `;
    }

    return NextResponse.json({ configs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch form configs' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, is_visible, is_required } = body;

    if (!id) {
      return NextResponse.json({ error: 'Field config ID is required.' }, { status: 400 });
    }

    const existing = await sql`SELECT id, form_type, field_key, label FROM form_field_configs WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Field config not found.' }, { status: 404 });
    }

    const updateRes = await sql`
      UPDATE form_field_configs
      SET 
        is_visible = COALESCE(${is_visible ?? null}, is_visible),
        is_required = COALESCE(${is_required ?? null}, is_required)
      WHERE id = ${id}
      RETURNING id, form_type, field_key, label, is_visible, is_required
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('form_config', ${id}, ${user.id}, ${user.name}, 'form_field_updated', ${JSON.stringify({
          form_type: existing[0].form_type,
          field_key: existing[0].field_key,
          is_visible,
          is_required,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for form config change:', auditErr);
    }

    return NextResponse.json({ success: true, config: updateRes[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update form config' }, { status: 500 });
  }
}
