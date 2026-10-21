import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'all'; // 'unassigned', 'my', 'all', 'created_by_me'
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.toLowerCase() || '';

    let leads = await sql`
      SELECT l.id, l.lead_code, l.owner_id, l.manager_id, l.source_enquiry_id,
             l.institute_type, l.institute_name, l.country, l.city, l.student_strength,
             l.current_erp, l.current_erp_name,
             l.spoc_name, l.spoc_role, l.spoc_phone, l.spoc_email,
             l.dm_same_as_spoc, l.dm_name, l.dm_role, l.dm_phone, l.dm_email,
             l.additional_contact_name, l.additional_contact_role, l.additional_contact_phone, l.additional_contact_email,
             l.decision_flow, l.preferred_slot_date, l.preferred_slot_time, l.preferred_slot_mode, l.expected_start_date, l.additional_details,
             l.status, l.deal_value, l.is_duplicate, l.duplicate_of_lead_id, l.duplicate_flag_cleared,
             l.created_at, l.updated_at,
             u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      ORDER BY l.created_at DESC
    `;

    // Apply view filters
    if (view === 'unassigned') {
      leads = leads.filter((l: any) => l.manager_id === null || l.status === 'unassigned');
    } else if (view === 'my') {
      leads = leads.filter((l: any) => l.manager_id === user.id);
    } else if (view === 'created_by_me') {
      leads = leads.filter((l: any) => l.owner_id === user.id);
    }

    // Role-based restrictions for non-admin/non-BR users:
    // Pre-Sales and Referral partners can only view leads created by themselves
    if (user.role === 'pre_sales' || user.role === 'referral') {
      leads = leads.filter((l: any) => l.owner_id === user.id);
    }

    if (status && status !== 'all') {
      leads = leads.filter((l: any) => l.status === status);
    }

    if (search) {
      leads = leads.filter(
        (l: any) =>
          l.lead_code.toLowerCase().includes(search) ||
          l.institute_name.toLowerCase().includes(search) ||
          l.spoc_name.toLowerCase().includes(search) ||
          l.spoc_phone.toLowerCase().includes(search) ||
          (l.dm_name && l.dm_name.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({ leads });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      institute_type,
      institute_name,
      country,
      city,
      student_strength,
      current_erp,
      current_erp_name,
      spoc_name,
      spoc_role,
      spoc_phone,
      spoc_email,
      dm_same_as_spoc,
      dm_name,
      dm_role,
      dm_phone,
      dm_email,
      additional_contact_name,
      additional_contact_role,
      additional_contact_phone,
      additional_contact_email,
      decision_flow,
      preferred_slot_date,
      preferred_slot_time,
      preferred_slot_mode,
      expected_start_date,
      additional_details,
      deal_value,
      source_enquiry_id,
    } = body;

    // Basic Validation
    if (!institute_name || !institute_name.trim()) {
      return NextResponse.json({ error: 'Institute Name is required.' }, { status: 400 });
    }
    if (!spoc_name || !spoc_name.trim()) {
      return NextResponse.json({ error: 'SPOC Name is required.' }, { status: 400 });
    }
    if (!spoc_phone) {
      return NextResponse.json({ error: 'SPOC Mobile/WhatsApp is required.' }, { status: 400 });
    }

    const cleanSpocPhone = String(spoc_phone).replace(/[^0-9]/g, '');
    if (cleanSpocPhone.length < 7) {
      return NextResponse.json({ error: 'SPOC Phone must be at least 7 numeric digits.' }, { status: 400 });
    }

    // Resolve Decision Maker details if same_as_spoc is true
    const finalDmName = dm_same_as_spoc ? spoc_name : (dm_name || spoc_name);
    const finalDmRole = dm_same_as_spoc ? spoc_role : (dm_role || spoc_role);
    const finalDmPhone = dm_same_as_spoc ? cleanSpocPhone : String(dm_phone || cleanSpocPhone).replace(/[^0-9]/g, '');
    const finalDmEmail = dm_same_as_spoc ? spoc_email : (dm_email || null);

    // Normalize enum fields to match database check constraints
    const rawErp = current_erp ? String(current_erp).toLowerCase().trim() : 'unsure';
    const finalCurrentErp = ['yes', 'no', 'unsure'].includes(rawErp) ? rawErp : 'unsure';

    const rawMode = preferred_slot_mode ? String(preferred_slot_mode).trim() : 'Phone/WhatsApp Call';
    const validModes = ['Phone/WhatsApp Call', 'Virtual Meet', 'Unsure', 'Call', 'Meeting', 'Other'];
    const finalSlotMode = validModes.includes(rawMode) ? rawMode : 'Phone/WhatsApp Call';


    // 1. Duplicate Detection Check
    // Checks if spoc_phone or spoc_email already exists in leads table
    const normalizedSpocEmail = spoc_email ? spoc_email.trim().toLowerCase() : null;
    let duplicateOfLeadId: string | null = null;
    let isDuplicate = false;

    const existingMatch = await sql`
      SELECT id, lead_code, institute_name, created_at
      FROM leads
      WHERE spoc_phone = ${cleanSpocPhone}
         OR (spoc_email IS NOT NULL AND LOWER(spoc_email) = ${normalizedSpocEmail})
      LIMIT 1
    `;

    if (existingMatch.length > 0) {
      isDuplicate = true;
      duplicateOfLeadId = existingMatch[0].id;
    }

    // 2. Generate Lead Code
    const seqRes = await sql`SELECT nextval('lead_code_seq') as seq`;
    const leadCode = `LD-${seqRes[0].seq}`;

    // 3. Determine Initial Manager & Status:
    // If created by a Business Relations member, they can self-assign; otherwise 'unassigned'
    let initialManagerId: string | null = null;
    let initialStatus = 'unassigned';

    if (user.role === 'business_relations') {
      initialManagerId = user.id;
      initialStatus = 'assigned';
    }

    // 4. Insert Lead
    const insertRes = await sql`
      INSERT INTO leads (
        lead_code, owner_id, manager_id, source_enquiry_id,
        institute_type, institute_name, country, city, student_strength,
        current_erp, current_erp_name,
        spoc_name, spoc_role, spoc_phone, spoc_email,
        dm_same_as_spoc, dm_name, dm_role, dm_phone, dm_email,
        additional_contact_name, additional_contact_role, additional_contact_phone, additional_contact_email,
        decision_flow, preferred_slot_date, preferred_slot_time, preferred_slot_mode, expected_start_date, additional_details,
        status, deal_value, is_duplicate, duplicate_of_lead_id
      ) VALUES (
        ${leadCode}, ${user.id}, ${initialManagerId}, ${source_enquiry_id || null},
        ${institute_type || 'School'}, ${institute_name.trim()}, ${country || 'India'}, ${city || 'Unknown'}, ${student_strength || 'Unspecified'},
        ${finalCurrentErp}, ${current_erp_name || null},
        ${spoc_name.trim()}, ${spoc_role || 'SPOC'}, ${cleanSpocPhone}, ${normalizedSpocEmail},
        ${Boolean(dm_same_as_spoc)}, ${finalDmName.trim()}, ${finalDmRole || 'Principal'}, ${finalDmPhone}, ${finalDmEmail},
        ${additional_contact_name || null}, ${additional_contact_role || null}, ${additional_contact_phone || null}, ${additional_contact_email || null},
        ${decision_flow || null}, ${preferred_slot_date || null}, ${preferred_slot_time || null}, ${finalSlotMode}, ${expected_start_date || null}, ${additional_details || null},
        ${initialStatus}, ${deal_value ? parseFloat(deal_value) : 0.00}, ${isDuplicate}, ${duplicateOfLeadId}
      )
      RETURNING *
    `;

    const newLead = insertRes[0];

    // If converted from an enquiry, update enquiry status
    if (source_enquiry_id) {
      try {
        await sql`
          UPDATE enquiries 
          SET status = 'converted_to_lead', converted_lead_id = ${newLead.id} 
          WHERE id = ${source_enquiry_id}
        `;
      } catch (enqErr) {
        console.warn('Failed to update source enquiry converted status:', enqErr);
      }
    }

    // 5. Audit Log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('lead', ${newLead.id}, ${user.id}, ${user.name}, 'lead_created', ${JSON.stringify({
          lead_code: leadCode,
          institute_name: newLead.institute_name,
          owner_code: user.user_code,
          is_duplicate: isDuplicate,
          duplicate_of: existingMatch.length > 0 ? existingMatch[0].lead_code : null,
          from_enquiry: Boolean(source_enquiry_id),
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for lead creation:', auditErr);
    }

    return NextResponse.json({
      success: true,
      lead: newLead,
      duplicate_warning: isDuplicate
        ? `Note: Lead marked with Duplicate Flag matching ${existingMatch[0].lead_code} (${existingMatch[0].institute_name}).`
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create lead' }, { status: 500 });
  }
}
