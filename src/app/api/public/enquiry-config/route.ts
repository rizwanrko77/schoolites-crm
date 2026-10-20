import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Referral code is required.' }, { status: 400 });
    }

    // 1. Resolve owner by user_code
    const ownerRes = await sql`
      SELECT id, user_code, name, role, is_active
      FROM users
      WHERE UPPER(user_code) = UPPER(${code.trim()})
      LIMIT 1
    `;

    if (ownerRes.length === 0 || !ownerRes[0].is_active) {
      return NextResponse.json(
        { error: 'Referral link is invalid or inactive. Please contact the representative.' },
        { status: 404 }
      );
    }

    const owner = ownerRes[0];

    // 2. Fetch visible fields for Enquiry form in display order
    const fields = await sql`
      SELECT id, field_key, label, category, field_type, options, is_required, display_order
      FROM form_field_configs
      WHERE form_type = 'enquiry' AND is_visible = TRUE
      ORDER BY display_order ASC
    `;

    return NextResponse.json({
      valid: true,
      owner: {
        name: owner.name,
        user_code: owner.user_code,
        role: owner.role,
      },
      fields,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load enquiry configuration' }, { status: 500 });
  }
}
