import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch lead details
    const leadRes = await sql`
      SELECT l.*,
             u_owner.name as owner_name, u_owner.user_code as owner_code, u_owner.role as owner_role,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code,
             l_dup.lead_code as duplicate_of_code, l_dup.institute_name as duplicate_of_institute,
             e.enquiry_code as source_enquiry_code
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      LEFT JOIN leads l_dup ON l.duplicate_of_lead_id = l_dup.id
      LEFT JOIN enquiries e ON l.source_enquiry_id = e.id
      WHERE l.id = ${id}
      LIMIT 1
    `;

    if (leadRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const lead = leadRes[0];

    // Role-based view protection:
    // Promoters are restricted from accessing deep lead contact info
    if (user.role === 'promoter') {
      return NextResponse.json({ error: 'Access denied: Promoters can only track high-level pipeline status.' }, { status: 403 });
    }

    // Pre-Sales and Referral partners can only see leads they created
    if ((user.role === 'pre_sales' || user.role === 'referral') && lead.owner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to view this lead.' }, { status: 403 });
    }

    // Fetch notes:
    // - Admin sees all
    // - Assigned BR Manager sees all global remarks + their own personal notes + personal notes written by previous BR managers on this lead!
    // - Others (Pre-Sales, Referral Partners, non-manager reps) see global remarks + notes authored by themselves
    let notes;
    const isLeadManager = user.role === 'business_relations' && lead.manager_id === user.id;

    if (user.role === 'admin') {
      notes = await sql`
        SELECT n.id, n.author_id, n.visibility, n.content, n.created_at,
               u.name as author_name, u.user_code as author_code, u.role as author_role
        FROM record_notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.record_type = 'lead' AND n.record_id = ${id}
        ORDER BY n.created_at ASC
      `;
    } else if (isLeadManager) {
      notes = await sql`
        SELECT n.id, n.author_id, n.visibility, n.content, n.created_at,
               u.name as author_name, u.user_code as author_code, u.role as author_role
        FROM record_notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.record_type = 'lead' AND n.record_id = ${id}
          AND (n.visibility = 'global' OR n.author_id = ${user.id} OR u.role = 'business_relations')
        ORDER BY n.created_at ASC
      `;
    } else {
      notes = await sql`
        SELECT n.id, n.author_id, n.visibility, n.content, n.created_at,
               u.name as author_name, u.user_code as author_code, u.role as author_role
        FROM record_notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.record_type = 'lead' AND n.record_id = ${id}
          AND (n.visibility = 'global' OR n.author_id = ${user.id})
        ORDER BY n.created_at ASC
      `;
    }

    // Fetch audit history for this lead (latest on top)
    const auditLogs = await sql`
      SELECT id, actor_id, actor_name, action, metadata, created_at
      FROM audit_logs
      WHERE record_type = 'lead' AND record_id = ${id}
      ORDER BY created_at DESC
    `;

    // Fetch contract and invoices (Admin and Business Relations only)
    let contract = null;
    let invoices: any[] = [];

    if (user.role === 'admin' || user.role === 'business_relations') {
      const contractRes = await sql`
        SELECT c.*, u.name as created_by_name, u.user_code as created_by_code
        FROM lead_contracts c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.lead_id = ${id}
        LIMIT 1
      `;
      if (contractRes.length > 0) {
        contract = contractRes[0];
        invoices = await sql`
          SELECT *
          FROM contract_invoices
          WHERE contract_id = ${contract.id}
          ORDER BY COALESCE(raise_date, due_date) ASC, created_at ASC
        `;
      }
    }

    return NextResponse.json({ lead, notes, audit_logs: auditLogs, contract, invoices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch lead details' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingRes = await sql`SELECT * FROM leads WHERE id = ${id} LIMIT 1`;
    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const existing = existingRes[0];

    // 1. Locked Status on Closed Deals: Only Admin can reopen or modify Won/Lost deals
    if ((existing.status === 'won' || existing.status === 'lost') && user.role !== 'admin') {
      return NextResponse.json({ error: 'Deal is closed. Only an Administrator can modify or reopen a finalized deal.' }, { status: 403 });
    }

    // 2. Status Modification Permissions: Only Admin or the assigned Lead Manager can change status
    if (body.status !== undefined && body.status !== existing.status) {
      if (user.role !== 'admin' && existing.manager_id !== user.id) {
        return NextResponse.json({ error: 'Only the assigned Lead Manager or an Administrator can change the lead status.' }, { status: 403 });
      }
    }

    // 3. Edit Permissions: Only Lead Owner, Lead Manager, or Admin can edit lead fields
    const isOwner = existing.owner_id === user.id;
    const isManager = existing.manager_id === user.id;
    const isAdmin = user.role === 'admin';

    if (!isAdmin && !isOwner && !isManager) {
      return NextResponse.json({ error: 'Unauthorized to modify this lead.' }, { status: 403 });
    }

    // Extract updatable fields
    const {
      status,
      manager_id,
      institute_name,
      institute_type,
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
    } = body;

    // 4. Lead Manager Synchronization & Assignment Rules:
    let targetManagerId = existing.manager_id;
    let isManagerChanged = false;
    let targetManagerUser: any = null;

    if (status === 'unassigned') {
      // Rule A: Transitioning to 'unassigned' always resets manager to NULL
      targetManagerId = null;
      if (existing.manager_id !== null) {
        isManagerChanged = true;
      }
    } else if (manager_id !== undefined) {
      // Rule B: Explicit manager assignment / reassignment
      if (user.role !== 'admin' && existing.manager_id !== user.id) {
        return NextResponse.json({ error: 'Only an Administrator or the assigned Lead Manager can assign or reassign this lead.' }, { status: 403 });
      }

      if (manager_id === null || manager_id === '') {
        targetManagerId = null;
        if (existing.manager_id !== null) {
          isManagerChanged = true;
        }
      } else {
        const mgrCheck = await sql`
          SELECT id, name, user_code, role, is_active
          FROM users
          WHERE id = ${manager_id} AND is_active = TRUE
          LIMIT 1
        `;
        if (mgrCheck.length === 0) {
          return NextResponse.json({ error: 'Selected lead manager not found or inactive.' }, { status: 400 });
        }
        if (mgrCheck[0].role !== 'business_relations') {
          return NextResponse.json({ error: 'Leads can only be assigned to members of the Business Relations team.' }, { status: 400 });
        }
        targetManagerUser = mgrCheck[0];
        targetManagerId = targetManagerUser.id;
        if (existing.manager_id !== targetManagerId) {
          isManagerChanged = true;
        }
      }
    } else if ((existing.status === 'unassigned' || !existing.manager_id) && status && status !== 'unassigned') {
      // Rule C: Prevent moving a lead out of unassigned without assigning a manager
      return NextResponse.json({ error: 'A Lead Manager must be assigned when moving a lead out of the Unassigned pool.' }, { status: 400 });
    }

    // Detect field diffs for granular audit logging
    const diffs: Record<string, { from: any; to: any }> = {};
    const trackDiff = (key: string, newVal: any, oldVal: any) => {
      if (newVal !== undefined && newVal !== null && String(newVal).trim() !== String(oldVal ?? '').trim()) {
        diffs[key] = { from: oldVal ?? null, to: newVal };
      }
    };

    trackDiff('institute_name', institute_name, existing.institute_name);
    trackDiff('institute_type', institute_type, existing.institute_type);
    trackDiff('country', country, existing.country);
    trackDiff('city', city, existing.city);
    trackDiff('student_strength', student_strength, existing.student_strength);
    trackDiff('current_erp', current_erp, existing.current_erp);
    trackDiff('current_erp_name', current_erp_name, existing.current_erp_name);
    trackDiff('spoc_name', spoc_name, existing.spoc_name);
    trackDiff('spoc_role', spoc_role, existing.spoc_role);
    trackDiff('spoc_phone', spoc_phone, existing.spoc_phone);
    trackDiff('spoc_email', spoc_email, existing.spoc_email);
    trackDiff('dm_name', dm_name, existing.dm_name);
    trackDiff('dm_role', dm_role, existing.dm_role);
    trackDiff('dm_phone', dm_phone, existing.dm_phone);
    trackDiff('dm_email', dm_email, existing.dm_email);
    trackDiff('additional_contact_name', additional_contact_name, existing.additional_contact_name);
    trackDiff('additional_contact_role', additional_contact_role, existing.additional_contact_role);
    trackDiff('additional_contact_phone', additional_contact_phone, existing.additional_contact_phone);
    trackDiff('additional_contact_email', additional_contact_email, existing.additional_contact_email);
    trackDiff('decision_flow', decision_flow, existing.decision_flow);
    trackDiff('preferred_slot_date', preferred_slot_date, existing.preferred_slot_date ? new Date(existing.preferred_slot_date).toISOString().split('T')[0] : null);
    trackDiff('preferred_slot_time', preferred_slot_time, existing.preferred_slot_time);
    trackDiff('preferred_slot_mode', preferred_slot_mode, existing.preferred_slot_mode);
    trackDiff('expected_start_date', expected_start_date, existing.expected_start_date);
    trackDiff('additional_details', additional_details, existing.additional_details);

    // Clean phone number if updated
    const cleanSpocPhone = spoc_phone ? String(spoc_phone).replace(/[^0-9]/g, '') : existing.spoc_phone;

    // Resolve Decision Maker details if same_as_spoc is true
    const resolvedDmSameAsSpoc = dm_same_as_spoc !== undefined ? Boolean(dm_same_as_spoc) : Boolean(existing.dm_same_as_spoc);
    const finalDmName = resolvedDmSameAsSpoc
      ? (spoc_name !== undefined && spoc_name !== '' ? spoc_name : existing.spoc_name)
      : (dm_name !== undefined ? dm_name : existing.dm_name);
    const finalDmRole = resolvedDmSameAsSpoc
      ? (spoc_role !== undefined && spoc_role !== '' ? spoc_role : existing.spoc_role)
      : (dm_role !== undefined ? dm_role : existing.dm_role);
    const finalDmPhone = resolvedDmSameAsSpoc
      ? cleanSpocPhone
      : (dm_phone !== undefined ? String(dm_phone).replace(/[^0-9]/g, '') : existing.dm_phone);
    const finalDmEmail = resolvedDmSameAsSpoc
      ? (spoc_email !== undefined ? spoc_email : existing.spoc_email)
      : (dm_email !== undefined ? dm_email : existing.dm_email);

    // Normalize enum fields to match database check constraints
    const rawErp = current_erp !== undefined ? String(current_erp).toLowerCase().trim() : undefined;
    const finalCurrentErp = rawErp ? (['yes', 'no', 'unsure'].includes(rawErp) ? rawErp : 'unsure') : undefined;

    const rawMode = preferred_slot_mode !== undefined ? String(preferred_slot_mode).trim() : undefined;
    const validModes = ['Phone/WhatsApp Call', 'Virtual Meet', 'Unsure', 'Call', 'Meeting', 'Other'];
    const finalSlotMode = rawMode !== undefined ? (validModes.includes(rawMode) ? rawMode : null) : undefined;

    // Check duplicate if SPOC phone or email was changed
    let isDuplicate = existing.is_duplicate;
    let duplicateOfLeadId = existing.duplicate_of_lead_id;

    if ((spoc_phone && spoc_phone !== existing.spoc_phone) || (spoc_email && spoc_email !== existing.spoc_email)) {
      const dupCheck = await sql`
        SELECT id, lead_code FROM leads
        WHERE id != ${id}
          AND (spoc_phone = ${cleanSpocPhone} OR (spoc_email IS NOT NULL AND spoc_email != '' AND LOWER(spoc_email) = LOWER(${spoc_email ?? ''})))
        LIMIT 1
      `;
      if (dupCheck.length > 0) {
        isDuplicate = true;
        duplicateOfLeadId = dupCheck[0].id;
      }
    }

    const updateRes = await sql`
      UPDATE leads
      SET 
        status = COALESCE(${status ?? null}, status),
        manager_id = ${targetManagerId},
        institute_name = COALESCE(${institute_name ?? null}, institute_name),
        institute_type = COALESCE(${institute_type ?? null}, institute_type),
        country = COALESCE(${country ?? null}, country),
        city = COALESCE(${city ?? null}, city),
        student_strength = COALESCE(${student_strength ?? null}, student_strength),
        current_erp = COALESCE(${finalCurrentErp ?? null}, current_erp),
        current_erp_name = COALESCE(${current_erp_name ?? null}, current_erp_name),
        spoc_name = COALESCE(${spoc_name ?? null}, spoc_name),
        spoc_role = COALESCE(${spoc_role ?? null}, spoc_role),
        spoc_phone = COALESCE(${cleanSpocPhone ?? null}, spoc_phone),
        spoc_email = COALESCE(${spoc_email ?? null}, spoc_email),
        dm_same_as_spoc = ${resolvedDmSameAsSpoc},
        dm_name = COALESCE(${finalDmName ?? null}, dm_name),
        dm_role = COALESCE(${finalDmRole ?? null}, dm_role),
        dm_phone = COALESCE(${finalDmPhone ?? null}, dm_phone),
        dm_email = COALESCE(${finalDmEmail ?? null}, dm_email),
        additional_contact_name = COALESCE(${additional_contact_name ?? null}, additional_contact_name),
        additional_contact_role = COALESCE(${additional_contact_role ?? null}, additional_contact_role),
        additional_contact_phone = COALESCE(${additional_contact_phone ?? null}, additional_contact_phone),
        additional_contact_email = COALESCE(${additional_contact_email ?? null}, additional_contact_email),
        decision_flow = COALESCE(${decision_flow ?? null}, decision_flow),
        preferred_slot_date = COALESCE(${preferred_slot_date ?? null}, preferred_slot_date),
        preferred_slot_time = COALESCE(${preferred_slot_time ?? null}, preferred_slot_time),
        preferred_slot_mode = COALESCE(${finalSlotMode ?? null}, preferred_slot_mode),
        expected_start_date = COALESCE(${expected_start_date ?? null}, expected_start_date),
        additional_details = COALESCE(${additional_details ?? null}, additional_details),
        is_duplicate = ${isDuplicate},
        duplicate_of_lead_id = ${duplicateOfLeadId},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Audit Log for status change
    if (status && status !== existing.status) {
      try {
        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'lead_status_changed', ${JSON.stringify({
            from: existing.status,
            to: status,
            lead_code: existing.lead_code,
          })})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for status change:', auditErr);
      }
    }

    // Audit Log for manager assignment / unassignment / reassignment
    if (isManagerChanged) {
      try {
        const action = targetManagerId === null
          ? 'lead_unassigned'
          : existing.manager_id === null
          ? 'lead_assigned'
          : 'lead_reassigned';

        const metadata: any = {
          lead_code: existing.lead_code,
          from_manager_id: existing.manager_id,
        };
        if (targetManagerUser) {
          metadata.to_manager = `${targetManagerUser.name} (${targetManagerUser.user_code})`;
          metadata.to_manager_id = targetManagerUser.id;
        }

        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, ${action}, ${JSON.stringify(metadata)})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for manager change:', auditErr);
      }
    }

    // Audit Log for field updates
    if (Object.keys(diffs).length > 0) {
      try {
        await sql`
          INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
          VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'lead_updated', ${JSON.stringify({
            lead_code: existing.lead_code,
            changed_fields: Object.keys(diffs),
            diffs: diffs,
          })})
        `;
      } catch (auditErr) {
        console.warn('Failed to write audit log for lead updates:', auditErr);
      }
    }

    return NextResponse.json({ success: true, lead: updateRes[0], diffs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update lead' }, { status: 500 });
  }
}
