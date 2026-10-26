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

    const { id: userId } = await params;

    // 1. Fetch user record
    const userResult = await sql`
      SELECT id, user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access, created_at
      FROM users
      WHERE id = ${userId}
    `;

    if (!userResult || userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult[0];

    // 2. Fetch actor's associated enquiries
    const enquiries = await sql`
      SELECT e.id, e.enquiry_code, e.owner_id, e.promoter_id, e.spoc_name, e.phone, e.email,
             e.institute_type, e.institute_name, e.country, e.city, e.student_count, e.website, e.message,
             e.status, e.converted_lead_id, e.created_at, e.internal_notes, e.claimed_at,
             u_owner.name as owner_name, u_owner.user_code as owner_code,
             u_prom.name as promoter_name, u_prom.user_code as promoter_code,
             l.lead_code, l.status as lead_status, l.deal_value as lead_deal_value,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code
      FROM enquiries e
      LEFT JOIN users u_owner ON e.owner_id = u_owner.id
      LEFT JOIN users u_prom ON e.promoter_id = u_prom.id
      LEFT JOIN leads l ON e.converted_lead_id = l.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      WHERE e.promoter_id = ${userId} OR e.owner_id = ${userId}
      ORDER BY e.created_at DESC
    `;

    // 3. Fetch actor's associated leads
    const leads = await sql`
      SELECT l.id, l.lead_code, l.institute_name, l.institute_type, l.city, l.country,
             l.status, l.deal_value, l.preferred_slot_date, l.preferred_slot_time, l.preferred_slot_mode,
             l.manager_id, l.owner_id, l.promoter_id, l.created_at,
             u_mgr.name as manager_name, u_mgr.user_code as manager_code,
             u_owner.name as owner_name, u_owner.user_code as owner_code,
             u_prom.name as promoter_name, u_prom.user_code as promoter_code,
             lc.id as contract_id, lc.contract_amount, lc.status as contract_status, lc.start_date, lc.end_date,
             lc.promoter_rate, lc.owner_rate, lc.manager_rate
      FROM leads l
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      LEFT JOIN users u_owner ON l.owner_id = u_owner.id
      LEFT JOIN users u_prom ON l.promoter_id = u_prom.id
      LEFT JOIN lead_contracts lc ON l.id = lc.lead_id
      WHERE l.manager_id = ${userId} OR l.owner_id = ${userId} OR l.promoter_id = ${userId}
         OR l.id IN (SELECT converted_lead_id FROM enquiries WHERE promoter_id = ${userId} AND converted_lead_id IS NOT NULL)
      ORDER BY l.created_at DESC
    `;

    // 4. Fetch invoices & payment clearance across their deals
    const invoices = await sql`
      SELECT ci.id, ci.contract_id, ci.lead_id, ci.invoice_number, ci.amount, ci.raise_date,
             ci.due_date, ci.status, ci.cleared_at, ci.payment_method, ci.payment_reference, ci.notes,
             l.lead_code, l.institute_name
      FROM contract_invoices ci
      JOIN leads l ON ci.lead_id = l.id
      WHERE l.manager_id = ${userId} OR l.owner_id = ${userId} OR l.promoter_id = ${userId}
         OR l.id IN (SELECT converted_lead_id FROM enquiries WHERE promoter_id = ${userId} AND converted_lead_id IS NOT NULL)
      ORDER BY ci.created_at DESC
    `;

    // 5. Fetch actor commission payouts for this specific user
    const payouts = await sql`
      SELECT
        acp.id,
        acp.invoice_id,
        acp.contract_id,
        acp.lead_id,
        acp.user_id,
        acp.actor_role,
        acp.commission_rate,
        acp.invoice_amount,
        acp.payout_amount,
        acp.invoice_status,
        acp.payout_status,
        acp.paid_at,
        acp.payment_method,
        acp.payment_reference,
        acp.notes,
        ci.invoice_number,
        ci.raise_date,
        ci.due_date,
        ci.cleared_at as invoice_cleared_at,
        l.lead_code,
        l.institute_name,
        l.city
      FROM actor_commission_payouts acp
      JOIN contract_invoices ci ON acp.invoice_id = ci.id
      JOIN leads l ON acp.lead_id = l.id
      WHERE acp.user_id = ${userId}
      ORDER BY ci.created_at DESC
    `;

    // 6. Aggregate performance stats & payout stats
    const totalEnquiries = enquiries.length;
    const newEnquiries = enquiries.filter((e: any) => e.status === 'new').length;
    const qualifiedEnquiries = enquiries.filter((e: any) => e.status === 'converted_to_lead').length;
    const totalLeads = leads.length;
    const wonLeads = leads.filter((l: any) => String(l.status).toLowerCase() === 'won').length;
    const activePipeline = leads.filter((l: any) => String(l.status).toLowerCase() !== 'won' && String(l.status).toLowerCase() !== 'lost').length;

    const totalContractValue = leads.reduce((acc: number, curr: any) => {
      const val = parseFloat(curr.contract_amount || curr.deal_value || '0');
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const clearedPayments = invoices.reduce((acc: number, curr: any) => {
      if (curr.status === 'cleared') {
        const val = parseFloat(curr.amount || '0');
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);

    const pendingInvoices = invoices.reduce((acc: number, curr: any) => {
      if (curr.status === 'raised' || curr.status === 'pending') {
        const val = parseFloat(curr.amount || '0');
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);

    const conversionRate = totalEnquiries > 0
      ? Math.round((wonLeads / totalEnquiries) * 100)
      : totalLeads > 0
      ? Math.round((wonLeads / totalLeads) * 100)
      : 0;

    // Full contract potential across won or contracted deals for this actor
    const wonOrContractedLeads = leads.filter((l: any) => String(l.status).toLowerCase() === 'won' || Boolean(l.contract_id));
    const totalCommissionPotential = wonOrContractedLeads.reduce((acc: number, l: any) => {
      const contractVal = parseFloat(l.contract_amount || l.deal_value || '0');
      if (isNaN(contractVal) || contractVal <= 0) return acc;

      let rate = 0;
      if (l.manager_id === userId) {
        rate = l.manager_rate !== null ? parseFloat(l.manager_rate) : parseFloat(user.commission_rate || '10.0');
      } else if (l.owner_id === userId) {
        // Closer Priority: If owner is also manager, owner duplicate is waived to 0%
        const isOwnerCloser = Boolean(l.owner_id && l.manager_id && l.owner_id === l.manager_id);
        rate = isOwnerCloser
          ? 0
          : (l.owner_rate !== null ? parseFloat(l.owner_rate) : parseFloat(user.commission_rate || '10.0'));
      } else if (l.promoter_id === userId) {
        rate = l.promoter_rate !== null ? parseFloat(l.promoter_rate) : parseFloat(user.commission_rate || '10.0');
      }

      return acc + (contractVal * (rate / 100));
    }, 0);

    // Invoice-level payout stats from actor_commission_payouts
    const totalCommissionEarned = payouts.reduce((acc: number, p: any) => {
      return p.invoice_status === 'cleared' ? acc + parseFloat(p.payout_amount || '0') : acc;
    }, 0);
    const totalCommissionPaid = payouts.reduce((acc: number, p: any) => {
      return p.payout_status === 'paid' ? acc + parseFloat(p.payout_amount || '0') : acc;
    }, 0);
    const totalCommissionPendingPayout = payouts.reduce((acc: number, p: any) => {
      return (p.invoice_status === 'cleared' && p.payout_status !== 'paid') ? acc + parseFloat(p.payout_amount || '0') : acc;
    }, 0);
    const totalCommissionPendingInvoice = payouts.reduce((acc: number, p: any) => {
      return p.invoice_status !== 'cleared' ? acc + parseFloat(p.payout_amount || '0') : acc;
    }, 0);
    const totalCommissionUnbilled = Math.max(0, totalCommissionPotential - (totalCommissionEarned + totalCommissionPendingInvoice));

    return NextResponse.json({
      user,
      stats: {
        totalEnquiries,
        newEnquiries,
        qualifiedEnquiries,
        totalLeads,
        activePipeline,
        wonLeads,
        totalContractValue,
        clearedPayments,
        pendingInvoices,
        conversionRate,
      },
      payoutStats: {
        totalCommissionPotential: Number(totalCommissionPotential.toFixed(2)),
        totalCommissionEarned: Number(totalCommissionEarned.toFixed(2)),
        totalCommissionPaid: Number(totalCommissionPaid.toFixed(2)),
        totalCommissionPendingPayout: Number(totalCommissionPendingPayout.toFixed(2)),
        totalCommissionPendingInvoice: Number(totalCommissionPendingInvoice.toFixed(2)),
        totalCommissionUnbilled: Number(totalCommissionUnbilled.toFixed(2)),
      },
      enquiries,
      leads,
      invoices,
      payouts,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/users/[id]:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch user performance' }, { status: 500 });
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

    const { id: userId } = await params;
    const body = await req.json();

    const existingUser = await sql`
      SELECT id, user_code, name, email, role, commission_rate, description, date_of_joining, has_database_access
      FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (existingUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const current = existingUser[0];
    const name = body.name !== undefined ? String(body.name).trim() : current.name;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : current.email;
    const description = body.description !== undefined ? String(body.description).trim() : current.description;
    const doj = body.date_of_joining !== undefined ? body.date_of_joining : current.date_of_joining;
    const commissionRate = body.commission_rate !== undefined && body.commission_rate !== null && body.commission_rate !== ''
      ? parseFloat(body.commission_rate)
      : current.commission_rate;
    const isEligibleForDb = current.role === 'pre_sales' || current.role === 'referral';
    const hasDatabaseAccess = isEligibleForDb
      ? (body.has_database_access !== undefined
          ? (body.has_database_access === true || body.has_database_access === 'true')
          : current.has_database_access)
      : false;

    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE users
      SET
        name = ${name},
        email = ${email},
        commission_rate = ${commissionRate},
        description = ${description},
        date_of_joining = ${doj},
        has_database_access = ${hasDatabaseAccess},
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, user_code, name, email, role, commission_rate, date_of_joining, description, is_active, has_database_access, updated_at
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES (
        'user',
        ${userId},
        ${currentUser.id},
        ${currentUser.name},
        'USER_PROFILE_UPDATED',
        ${JSON.stringify({
          old_rate: current.commission_rate,
          new_rate: commissionRate,
          changes: {
            name: name !== current.name ? { from: current.name, to: name } : undefined,
            commission_rate: commissionRate !== current.commission_rate ? { from: current.commission_rate, to: commissionRate } : undefined,
          }
        })}
      )
    `;

    return NextResponse.json({ success: true, user: updated[0] });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/users/[id]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update user' }, { status: 500 });
  }
}

