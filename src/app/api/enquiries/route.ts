import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET: Authenticated user fetches their enquiries (or admin fetches all)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    let enquiries;
    if (user.role === 'admin') {
      enquiries = await sql`
        SELECT e.id, e.enquiry_code, e.owner_id, e.spoc_name, e.phone, e.email, e.institute_type, 
               e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
               e.status, e.converted_lead_id, e.created_at,
               u.name as owner_name, u.user_code as owner_code, u.role as owner_role
        FROM enquiries e
        JOIN users u ON e.owner_id = u.id
        ORDER BY e.created_at DESC
      `;
    } else {
      enquiries = await sql`
        SELECT e.id, e.enquiry_code, e.owner_id, e.spoc_name, e.phone, e.email, e.institute_type, 
               e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
               e.status, e.converted_lead_id, e.created_at,
               u.name as owner_name, u.user_code as owner_code, u.role as owner_role
        FROM enquiries e
        JOIN users u ON e.owner_id = u.id
        WHERE e.owner_id = ${user.id}
        ORDER BY e.created_at DESC
      `;
    }

    if (statusFilter && statusFilter !== 'all') {
      enquiries = enquiries.filter((e: any) => e.status === statusFilter);
    }

    return NextResponse.json({ enquiries });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch enquiries' }, { status: 500 });
  }
}

// POST: Public endpoint for visitors submitting an enquiry form on /e/[user_code]
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner_code, form_data } = body;

    if (!owner_code || !form_data) {
      return NextResponse.json({ error: 'Missing owner reference or form details.' }, { status: 400 });
    }

    // 1. Resolve owner by user_code
    const ownerRes = await sql`
      SELECT id, user_code, name, email, role, is_active 
      FROM users 
      WHERE UPPER(user_code) = UPPER(${owner_code.trim()})
      LIMIT 1
    `;

    if (ownerRes.length === 0 || !ownerRes[0].is_active) {
      return NextResponse.json(
        { error: 'Invalid or inactive referral link. Please verify the link URL.' },
        { status: 404 }
      );
    }

    const owner = ownerRes[0];

    // 2. Fetch active form field configurations to validate
    const activeFields = await sql`
      SELECT field_key, label, is_required, field_type 
      FROM form_field_configs 
      WHERE form_type = 'enquiry' AND is_visible = TRUE
    `;

    // 3. Validate required fields
    for (const field of activeFields) {
      if (field.is_required) {
        const val = form_data[field.field_key];
        if (!val || (typeof val === 'string' && !val.trim())) {
          return NextResponse.json(
            { error: `The field "${field.label}" is required.` },
            { status: 400 }
          );
        }
      }
    }

    // 4. Validate numeric phone number
    if (form_data.phone) {
      const cleanPhone = String(form_data.phone).replace(/[^0-9]/g, '');
      if (cleanPhone.length < 7) {
        return NextResponse.json(
          { error: 'Please enter a valid numeric phone number (minimum 7 digits).' },
          { status: 400 }
        );
      }
    }

    // 5. Generate unique enquiry code
    const seqRes = await sql`SELECT nextval('enquiry_code_seq') as seq`;
    const enquiryCode = `ENQ-${seqRes[0].seq}`;

    // 6. Insert enquiry into database
    const insertRes = await sql`
      INSERT INTO enquiries (
        enquiry_code, owner_id, spoc_name, phone, email, 
        institute_type, institute_name, country, city, student_count, 
        website, message, status, custom_data
      ) VALUES (
        ${enquiryCode},
        ${owner.id},
        ${form_data.name?.trim() || 'Anonymous Contact'},
        ${String(form_data.phone || '').trim()},
        ${form_data.email?.trim() || null},
        ${form_data.institute_type?.trim() || 'School'},
        ${form_data.institute_name?.trim() || null},
        ${form_data.country?.trim() || 'India'},
        ${form_data.city?.trim() || null},
        ${form_data.student_count?.trim() || null},
        ${form_data.website?.trim() || null},
        ${form_data.message?.trim() || null},
        'new',
        ${JSON.stringify(form_data)}
      )
      RETURNING id, enquiry_code, created_at
    `;

    const newEnquiry = insertRes[0];

    // 7. Audit Log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('enquiry', ${newEnquiry.id}, ${owner.id}, ${owner.name}, 'enquiry_received', ${JSON.stringify({
          enquiry_code: enquiryCode,
          owner_code: owner.user_code,
          spoc_name: form_data.name,
          phone: form_data.phone,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for enquiry:', auditErr);
    }

    return NextResponse.json({
      success: true,
      enquiry_code: enquiryCode,
      message: 'Enquiry submitted successfully. A representative will connect with you soon.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit enquiry' }, { status: 500 });
  }
}
