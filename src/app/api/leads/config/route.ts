import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Active session required.' }, { status: 401 });
    }

    const configs = await sql`
      SELECT id, form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order
      FROM form_field_configs
      WHERE form_type = 'lead'
      ORDER BY display_order ASC
    `;

    return NextResponse.json({ configs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch lead form configs' }, { status: 500 });
  }
}
