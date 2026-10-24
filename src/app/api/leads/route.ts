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
    const statusParam = searchParams.get('statuses') || searchParams.get('status');
    const sortBy = searchParams.get('sort_by') || 'created_desc';
    const search = searchParams.get('search')?.toLowerCase().trim() || '';

    let leads = await sql`
      SELECT l.id, l.lead_code, l.owner_id, l.promoter_id, l.manager_id, l.source_enquiry_id,
             l.institute_type, l.institute_name, l.country, l.city, l.student_strength,
             l.current_erp, l.current_erp_name,
             l.spoc_name, l.spoc_role, l.spoc_phone, l.spoc_email,
             l.dm_same_as_spoc, l.dm_name, l.dm_role, l.dm_phone, l.dm_email,
             l.additional_contact_name, l.additional_contact_role, l.additional_contact_phone, l.additional_contact_email,
             l.decision_flow, l.preferred_slot_date, l.preferred_slot_time, l.preferred_slot_mode, l.expected_start_date, l.additional_details,
             l.status, l.deal_value, l.is_duplicate, l.duplicate_of_lead_id, l.duplicate_flag_cleared,
             l.created_at, l.updated_at,
             u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code,
             u_prom.name as promoter_name, u_prom.user_code as promoter_code,
             lc.contract_amount, lc.status as contract_status
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      LEFT JOIN users u_prom ON l.promoter_id = u_prom.id
      LEFT JOIN lead_contracts lc ON l.id = lc.lead_id
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
    } else if (user.role === 'promoter') {
      // Promoters view only leads originated from their promotional enquiries
      leads = leads.filter((l: any) => l.promoter_id === user.id);
      // Mask contact information for promoter privacy protection
      leads = leads.map((l: any) => ({
        ...l,
        spoc_phone: l.spoc_phone ? `${l.spoc_phone.slice(0, 3)}*****${l.spoc_phone.slice(-2)}` : '—',
        spoc_email: l.spoc_email ? l.spoc_email.replace(/(?<=^.).(?=.*@)/g, '*') : null,
        dm_phone: null,
        dm_email: null,
        additional_contact_phone: null,
        additional_contact_email: null,
      }));
    }

    // Multi-status filtering
    if (statusParam && statusParam !== 'all') {
      const activeStatuses = statusParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (activeStatuses.length > 0) {
        leads = leads.filter((l: any) => activeStatuses.includes((l.status || '').toLowerCase()));
      }
    }

    // Comprehensive search covering all fields collected in create lead form + owner and manager
    if (search) {
      leads = leads.filter((l: any) => {
        const matchField = (val?: string | null) => (val ? val.toLowerCase().includes(search) : false);

        return (
          matchField(l.lead_code) ||
          matchField(l.institute_name) ||
          matchField(l.institute_type) ||
          matchField(l.city) ||
          matchField(l.country) ||
          matchField(l.student_strength) ||
          matchField(l.current_erp_name) ||
          matchField(l.current_erp) ||
          matchField(l.spoc_name) ||
          matchField(l.spoc_role) ||
          matchField(l.spoc_phone) ||
          matchField(l.spoc_email) ||
          matchField(l.dm_name) ||
          matchField(l.dm_role) ||
          matchField(l.dm_phone) ||
          matchField(l.dm_email) ||
          matchField(l.additional_contact_name) ||
          matchField(l.additional_contact_role) ||
          matchField(l.additional_contact_phone) ||
          matchField(l.additional_contact_email) ||
          matchField(l.decision_flow) ||
          matchField(l.preferred_slot_time) ||
          matchField(l.preferred_slot_mode) ||
          matchField(l.expected_start_date) ||
          matchField(l.additional_details) ||
          matchField(l.owner_name) ||
          matchField(l.owner_code) ||
          matchField(l.manager_name) ||
          matchField(l.manager_code) ||
          matchField(l.status)
        );
      });
    }

    // Sort leads according to sortBy query
    leads.sort((a: any, b: any) => {
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();
      const aUpdated = new Date(a.updated_at || a.created_at).getTime();
      const bUpdated = new Date(b.updated_at || b.created_at).getTime();

      switch (sortBy) {
        case 'created_asc':
          return aCreated - bCreated;
        case 'updated_desc':
          return bUpdated - aUpdated;
        case 'updated_asc':
          return aUpdated - bUpdated;
        case 'created_desc':
        default:
          return bCreated - aCreated;
      }
    });

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

    if (user.role === 'promoter') {
      return NextResponse.json(
        { error: 'Promoters cannot create leads directly. Inbound enquiries are qualified and converted by the Pre-Sales and Business Relations team.' },
        { status: 403 }
      );
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

    // Dynamic requirement check against form_field_configs
    try {
      const requiredFields = await sql`
        SELECT field_key, label 
        FROM form_field_configs 
        WHERE form_type = 'lead' AND is_visible = TRUE AND is_required = TRUE
      `;
      for (const rf of requiredFields) {
        const key = rf.field_key;
        if (Boolean(dm_same_as_spoc) && key.startsWith('dm_')) continue;
        if (key.startsWith('additional_contact_') && !additional_contact_name && !additional_contact_phone) continue;
        const val = (body as any)[key];
        if (val === undefined || val === null || String(val).trim() === '') {
          return NextResponse.json({ error: `${rf.label} is required.` }, { status: 400 });
        }
      }
    } catch (cfgErr) {
      console.warn('Could not validate dynamic lead configs:', cfgErr);
    }

    // Resolve Decision Maker details if same_as_spoc is true
    const finalDmName = dm_same_as_spoc ? spoc_name : (dm_name || spoc_name);
    const finalDmRole = dm_same_as_spoc ? spoc_role : (dm_role || spoc_role);
    const finalDmPhone = dm_same_as_spoc ? cleanSpocPhone : String(dm_phone || cleanSpocPhone).replace(/[^0-9]/g, '');
    const finalDmEmail = dm_same_as_spoc ? spoc_email : (dm_email || null);

    // Normalize enum fields to match database check constraints
    const rawErp = current_erp ? String(current_erp).toLowerCase().trim() : 'unsure';
    const finalCurrentErp = ['yes', 'no', 'unsure'].includes(rawErp) ? rawErp : 'unsure';

    const rawMode = preferred_slot_mode ? String(preferred_slot_mode).trim() : null;
    const validModes = ['Phone/WhatsApp Call', 'Virtual Meet', 'Unsure', 'Call', 'Meeting', 'Other'];
    const finalSlotMode = rawMode && validModes.includes(rawMode) ? rawMode : null;


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

    // Inherit promoter_id from source enquiry if present
    let resolvedPromoterId: string | null = body.promoter_id || null;
    if (source_enquiry_id && !resolvedPromoterId) {
      const enqRes = await sql`SELECT promoter_id FROM enquiries WHERE id = ${source_enquiry_id} LIMIT 1`;
      if (enqRes.length > 0 && enqRes[0].promoter_id) {
        resolvedPromoterId = enqRes[0].promoter_id;
      }
    }

    // 4. Insert Lead
    const insertRes = await sql`
      INSERT INTO leads (
        lead_code, owner_id, promoter_id, manager_id, source_enquiry_id,
        institute_type, institute_name, country, city, student_strength,
        current_erp, current_erp_name,
        spoc_name, spoc_role, spoc_phone, spoc_email,
        dm_same_as_spoc, dm_name, dm_role, dm_phone, dm_email,
        additional_contact_name, additional_contact_role, additional_contact_phone, additional_contact_email,
        decision_flow, preferred_slot_date, preferred_slot_time, preferred_slot_mode, expected_start_date, additional_details,
        status, deal_value, is_duplicate, duplicate_of_lead_id
      ) VALUES (
        ${leadCode}, ${user.id}, ${resolvedPromoterId}, ${initialManagerId}, ${source_enquiry_id || null},
        ${institute_type || 'School'}, ${institute_name.trim()}, ${country || 'India'}, ${city || 'Unknown'}, ${student_strength || 'Unspecified'},
        ${finalCurrentErp}, ${current_erp_name || null},
        ${spoc_name.trim()}, ${spoc_role ? spoc_role.trim() : 'SPOC'}, ${cleanSpocPhone}, ${normalizedSpocEmail},
        ${Boolean(dm_same_as_spoc)}, ${finalDmName.trim()}, ${finalDmRole ? finalDmRole.trim() : 'Decision Maker'}, ${finalDmPhone}, ${finalDmEmail},
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
