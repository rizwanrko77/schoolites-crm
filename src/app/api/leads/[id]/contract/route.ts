import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'business_relations') {
      return NextResponse.json({ error: 'Access denied: Only Admin and Business Relations can manage contracts.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const contractAmount = parseFloat(body.contract_amount) || 0;
    const durationMonths = parseInt(body.duration_months, 10) || 12;
    const startDate = body.start_date || null;
    const endDate = body.end_date || null;
    const status = ['active', 'completed', 'terminated', 'renewed'].includes(body.status)
      ? body.status
      : 'active';
    const notes = body.notes ? String(body.notes).trim() : null;

    // Verify lead exists and fetch actor commission rates
    const leadCheck = await sql`
      SELECT l.id, l.lead_code, l.status, l.promoter_id, l.owner_id, l.manager_id,
             u_prom.commission_rate as prom_rate,
             u_own.commission_rate as own_rate,
             u_mgr.commission_rate as mgr_rate
      FROM leads l
      LEFT JOIN users u_prom ON l.promoter_id = u_prom.id
      LEFT JOIN users u_own ON l.owner_id = u_own.id
      LEFT JOIN users u_mgr ON l.manager_id = u_mgr.id
      WHERE l.id = ${id} LIMIT 1
    `;
    if (leadCheck.length === 0) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const leadInfo = leadCheck[0];
    const promoterRate = leadInfo.promoter_id && leadInfo.prom_rate !== null ? parseFloat(leadInfo.prom_rate) : null;
    
    // Closer Priority: If owner is also manager (BR self-sourced & closed), BR gets ONLY manager share (no double incentives)
    const isOwnerSameAsManager = Boolean(leadInfo.owner_id && leadInfo.manager_id && leadInfo.owner_id === leadInfo.manager_id);
    const ownerRate = isOwnerSameAsManager 
      ? 0.00 
      : (leadInfo.owner_id && leadInfo.own_rate !== null ? parseFloat(leadInfo.own_rate) : 10.00);

    const managerRate = leadInfo.manager_id && leadInfo.mgr_rate !== null ? parseFloat(leadInfo.mgr_rate) : 10.00;

    // Upsert lead contract with commission rate snapshots
    const contractRes = await sql`
      INSERT INTO lead_contracts (
        lead_id, contract_amount, duration_months, start_date, end_date, status, notes,
        promoter_rate, owner_rate, manager_rate,
        created_by, updated_at
      )
      VALUES (
        ${id}, ${contractAmount}, ${durationMonths}, ${startDate}, ${endDate}, ${status}, ${notes},
        ${promoterRate}, ${ownerRate}, ${managerRate},
        ${user.id}, NOW()
      )
      ON CONFLICT (lead_id) DO UPDATE SET
        contract_amount = EXCLUDED.contract_amount,
        duration_months = EXCLUDED.duration_months,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        promoter_rate = COALESCE(lead_contracts.promoter_rate, EXCLUDED.promoter_rate),
        owner_rate = COALESCE(lead_contracts.owner_rate, EXCLUDED.owner_rate),
        manager_rate = COALESCE(lead_contracts.manager_rate, EXCLUDED.manager_rate),
        updated_at = NOW()
      RETURNING *
    `;

    // Automatically sync leads.deal_value with contract_amount
    await sql`
      UPDATE leads
      SET deal_value = ${contractAmount}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // Log to audit trail
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES (
        'lead',
        ${id},
        ${user.id},
        ${user.name},
        'CONTRACT_CONFIGURED',
        ${JSON.stringify({
          contract_amount: contractAmount,
          duration_months: durationMonths,
          status,
          start_date: startDate,
          end_date: endDate,
        })}
      )
    `;

    return NextResponse.json({
      success: true,
      contract: contractRes[0],
      message: 'Contract successfully saved.',
    });
  } catch (err: any) {
    console.error('Error saving contract:', err);
    return NextResponse.json({ error: err.message || 'Failed to save contract' }, { status: 500 });
  }
}
