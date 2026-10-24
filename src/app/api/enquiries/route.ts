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
    const view = searchParams.get('view'); // 'promoter_pool', 'my', etc.
    const actorUserId = searchParams.get('user_id');

    let enquiries;
    if (user.role === 'admin') {
      if (actorUserId) {
        enquiries = await sql`
          SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email, e.institute_type, 
                 e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
                 e.status, e.converted_lead_id, e.created_at, e.internal_notes, e.claimed_at,
                 u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
                 u_prom.name as promoter_name, u_prom.user_code as promoter_code,
                 l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
                 u_mgr.name as manager_name, u_mgr.user_code as manager_code
          FROM enquiries e
          LEFT JOIN users u_owner ON e.owner_id = u_owner.id
          LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
          LEFT JOIN leads l ON e.converted_lead_id = l.id
          LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
          WHERE e.promoter_id = ${actorUserId} OR e.owner_id = ${actorUserId}
          ORDER BY e.created_at DESC
        `;
      } else {
        enquiries = await sql`
          SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email, e.institute_type, 
                 e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
                 e.status, e.converted_lead_id, e.created_at, e.internal_notes, e.claimed_at,
                 u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
                 u_prom.name as promoter_name, u_prom.user_code as promoter_code,
                 l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
                 u_mgr.name as manager_name, u_mgr.user_code as manager_code
          FROM enquiries e
          LEFT JOIN users u_owner ON e.owner_id = u_owner.id
          LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
          LEFT JOIN leads l ON e.converted_lead_id = l.id
          LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
          ORDER BY e.created_at DESC
        `;
      }
    } else if (user.role === 'promoter') {
      // Promoter sees only their enquiries with live lead status and cross-actor team (internal_notes kept private)
      const rawEnquiries = await sql`
        SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email, e.institute_type, 
               e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
               e.status, e.converted_lead_id, e.created_at, e.claimed_at,
               u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
               u_prom.name as promoter_name, u_prom.user_code as promoter_code,
               l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
               u_mgr.name as manager_name, u_mgr.user_code as manager_code
        FROM enquiries e
        LEFT JOIN users u_owner ON e.owner_id = u_owner.id
        LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
        LEFT JOIN leads l ON e.converted_lead_id = l.id
        LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
        WHERE e.promoter_id = ${user.id} OR e.owner_id = ${user.id}
        ORDER BY e.created_at DESC
      `;

      enquiries = rawEnquiries.map((e: any) => ({
        ...e,
        // Mask phone & email for promoter view
        phone: e.phone ? `${e.phone.slice(0, 3)}*****${e.phone.slice(-2)}` : '—',
        email: e.email ? e.email.replace(/(?<=^.).(?=.*@)/g, '*') : null,
      }));
    } else if ((user.role === 'pre_sales' || user.role === 'business_relations') && view === 'promoter_pool') {
      // Pre-Sales & BR team viewing the unclaimed shared Promoter Enquiries pool
      enquiries = await sql`
        SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email, e.institute_type, 
               e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
               e.status, e.converted_lead_id, e.created_at, e.internal_notes, e.claimed_at,
               u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
               u_prom.name as promoter_name, u_prom.user_code as promoter_code,
               l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
               u_mgr.name as manager_name, u_mgr.user_code as manager_code
        FROM enquiries e
        LEFT JOIN users u_owner ON e.owner_id = u_owner.id
        LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
        LEFT JOIN leads l ON e.converted_lead_id = l.id
        LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
        WHERE e.promoter_id IS NOT NULL 
          AND (e.claimed_at IS NULL OR e.owner_id = e.promoter_id)
          AND e.status != 'discarded' 
          AND e.status != 'converted_to_lead'
        ORDER BY e.created_at DESC
      `;
    } else {
      // My direct and grabbed enquiries
      enquiries = await sql`
        SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email, e.institute_type, 
               e.institute_name, e.country, e.city, e.student_count, e.website, e.message, 
               e.status, e.converted_lead_id, e.created_at, e.internal_notes, e.claimed_at,
               u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
               u_prom.name as promoter_name, u_prom.user_code as promoter_code,
               l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
               u_mgr.name as manager_name, u_mgr.user_code as manager_code
        FROM enquiries e
        LEFT JOIN users u_owner ON e.owner_id = u_owner.id
        LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
        LEFT JOIN leads l ON e.converted_lead_id = l.id
        LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
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
    const promoterId = owner.role === 'promoter' ? owner.id : null;
    const insertRes = await sql`
      INSERT INTO enquiries (
        enquiry_code, owner_id, promoter_id, spoc_name, phone, email, 
        institute_type, institute_name, country, city, student_count, 
        website, message, status, custom_data
      ) VALUES (
        ${enquiryCode},
        ${owner.id},
        ${promoterId},
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
