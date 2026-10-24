import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin';
    const searchParams = req.nextUrl.searchParams;
    const isPersonalView = searchParams.get('view') === 'personal' || !isAdmin;

    // 1. Fetch won / contracted leads with invoice aggregations
    // If not personal view (Admin Pipeline View): all won/contracted leads
    // If personal view (Actor / Personal Ledger): only leads where user is promoter, owner, or manager
    let leadsRaw: any[] = [];

    if (!isPersonalView) {
      leadsRaw = await sql`
        SELECT
          l.id as lead_id,
          l.lead_code,
          l.institute_name,
          l.institute_type,
          l.city,
          l.country,
          l.status as lead_status,
          l.created_at,
          l.promoter_id,
          l.owner_id,
          l.manager_id,
          u_p.name as promoter_name,
          u_p.user_code as promoter_code,
          u_p.commission_rate as prom_live_rate,
          u_o.name as owner_name,
          u_o.user_code as owner_code,
          u_o.role as owner_role,
          u_o.commission_rate as own_live_rate,
          u_m.name as manager_name,
          u_m.user_code as manager_code,
          u_m.commission_rate as mgr_live_rate,
          lc.id as contract_id,
          COALESCE(lc.contract_amount, l.deal_value, 0.00) as contract_amount,
          lc.duration_months,
          lc.start_date,
          lc.end_date,
          lc.status as contract_status,
          lc.promoter_rate,
          lc.owner_rate,
          lc.manager_rate,
          COALESCE(SUM(CASE WHEN ci.status = 'cleared' THEN ci.amount ELSE 0 END), 0.00) as cleared_amount,
          COALESCE(SUM(CASE WHEN ci.status IN ('raised', 'pending') THEN ci.amount ELSE 0 END), 0.00) as pending_invoice_amount,
          COUNT(ci.id) as invoice_count
        FROM leads l
        LEFT JOIN users u_p ON l.promoter_id = u_p.id
        LEFT JOIN users u_o ON l.owner_id = u_o.id
        LEFT JOIN users u_m ON l.manager_id = u_m.id
        LEFT JOIN lead_contracts lc ON l.id = lc.lead_id
        LEFT JOIN contract_invoices ci ON lc.id = ci.contract_id
        WHERE l.status = 'won' OR lc.id IS NOT NULL
        GROUP BY l.id, u_p.id, u_o.id, u_m.id, lc.id
        ORDER BY l.created_at DESC
      `;
    } else {
      leadsRaw = await sql`
        SELECT
          l.id as lead_id,
          l.lead_code,
          l.institute_name,
          l.institute_type,
          l.city,
          l.country,
          l.status as lead_status,
          l.created_at,
          l.promoter_id,
          l.owner_id,
          l.manager_id,
          u_p.name as promoter_name,
          u_p.user_code as promoter_code,
          u_p.commission_rate as prom_live_rate,
          u_o.name as owner_name,
          u_o.user_code as owner_code,
          u_o.role as owner_role,
          u_o.commission_rate as own_live_rate,
          u_m.name as manager_name,
          u_m.user_code as manager_code,
          u_m.commission_rate as mgr_live_rate,
          lc.id as contract_id,
          COALESCE(lc.contract_amount, l.deal_value, 0.00) as contract_amount,
          lc.duration_months,
          lc.start_date,
          lc.end_date,
          lc.status as contract_status,
          lc.promoter_rate,
          lc.owner_rate,
          lc.manager_rate,
          COALESCE(SUM(CASE WHEN ci.status = 'cleared' THEN ci.amount ELSE 0 END), 0.00) as cleared_amount,
          COALESCE(SUM(CASE WHEN ci.status IN ('raised', 'pending') THEN ci.amount ELSE 0 END), 0.00) as pending_invoice_amount,
          COUNT(ci.id) as invoice_count
        FROM leads l
        LEFT JOIN users u_p ON l.promoter_id = u_p.id
        LEFT JOIN users u_o ON l.owner_id = u_o.id
        LEFT JOIN users u_m ON l.manager_id = u_m.id
        LEFT JOIN lead_contracts lc ON l.id = lc.lead_id
        LEFT JOIN contract_invoices ci ON lc.id = ci.contract_id
        WHERE (l.status = 'won' OR lc.id IS NOT NULL)
          AND (l.promoter_id = ${user.id} OR l.owner_id = ${user.id} OR l.manager_id = ${user.id})
        GROUP BY l.id, u_p.id, u_o.id, u_m.id, lc.id
        ORDER BY l.created_at DESC
      `;
    }

    // Process deals & commission splits
    const deals = leadsRaw.map((row) => {
      const contractValue = parseFloat(row.contract_amount || '0');
      const clearedCash = parseFloat(row.cleared_amount || '0');
      const pendingInvoiceCash = parseFloat(row.pending_invoice_amount || '0');
      const unbilledCash = Math.max(0, contractValue - (clearedCash + pendingInvoiceCash));
      const pendingCash = pendingInvoiceCash + unbilledCash;

      // Snapshotted rates or fallback
      const promRate = row.promoter_rate !== null
        ? parseFloat(row.promoter_rate)
        : (row.promoter_id ? parseFloat(row.prom_live_rate || '10.0') : 0.0);

      // Closer Priority: If owner is also manager (BR self-sourced & closed), BR gets ONLY manager share
      const isOwnerSameAsManager = Boolean(row.owner_id && row.manager_id && row.owner_id === row.manager_id);
      const ownRate = isOwnerSameAsManager
        ? 0.0
        : (row.owner_rate !== null
            ? parseFloat(row.owner_rate)
            : (row.owner_id ? parseFloat(row.own_live_rate || '10.0') : 0.0));

      const mgrRate = row.manager_rate !== null
        ? parseFloat(row.manager_rate)
        : (row.manager_id ? parseFloat(row.mgr_live_rate || '10.0') : 10.0);

      const promoterSplit = {
        id: row.promoter_id,
        name: row.promoter_name,
        code: row.promoter_code,
        rate: promRate,
        paid: row.promoter_id ? Number((clearedCash * (promRate / 100)).toFixed(2)) : 0,
        pending_invoice: row.promoter_id ? Number((pendingInvoiceCash * (promRate / 100)).toFixed(2)) : 0,
        unbilled: row.promoter_id ? Number((unbilledCash * (promRate / 100)).toFixed(2)) : 0,
        pending: row.promoter_id ? Number((pendingCash * (promRate / 100)).toFixed(2)) : 0,
        total: row.promoter_id ? Number((contractValue * (promRate / 100)).toFixed(2)) : 0,
      };

      const ownerSplit = {
        id: row.owner_id,
        name: row.owner_name,
        code: row.owner_code,
        role: row.owner_role,
        rate: ownRate,
        isWaivedCloserDuplicate: isOwnerSameAsManager,
        paid: row.owner_id ? Number((clearedCash * (ownRate / 100)).toFixed(2)) : 0,
        pending_invoice: row.owner_id ? Number((pendingInvoiceCash * (ownRate / 100)).toFixed(2)) : 0,
        unbilled: row.owner_id ? Number((unbilledCash * (ownRate / 100)).toFixed(2)) : 0,
        pending: row.owner_id ? Number((pendingCash * (ownRate / 100)).toFixed(2)) : 0,
        total: row.owner_id ? Number((contractValue * (ownRate / 100)).toFixed(2)) : 0,
      };

      const managerSplit = {
        id: row.manager_id,
        name: row.manager_name,
        code: row.manager_code,
        rate: mgrRate,
        paid: row.manager_id ? Number((clearedCash * (mgrRate / 100)).toFixed(2)) : 0,
        pending_invoice: row.manager_id ? Number((pendingInvoiceCash * (mgrRate / 100)).toFixed(2)) : 0,
        unbilled: row.manager_id ? Number((unbilledCash * (mgrRate / 100)).toFixed(2)) : 0,
        pending: row.manager_id ? Number((pendingCash * (mgrRate / 100)).toFixed(2)) : 0,
        total: row.manager_id ? Number((contractValue * (mgrRate / 100)).toFixed(2)) : 0,
      };

      const totalRewardsPaid = promoterSplit.paid + ownerSplit.paid + managerSplit.paid;
      const totalRewardsPendingInvoice = promoterSplit.pending_invoice + ownerSplit.pending_invoice + managerSplit.pending_invoice;
      const totalRewardsUnbilled = promoterSplit.unbilled + ownerSplit.unbilled + managerSplit.unbilled;
      const totalRewardsPending = totalRewardsPendingInvoice + totalRewardsUnbilled;
      const totalRewards = promoterSplit.total + ownerSplit.total + managerSplit.total;

      // Determine actor's personal attribution on this deal (if not admin)
      let actorRole: 'promoter' | 'owner' | 'manager' | null = null;
      let actorShareRate = 0;
      let actorPaidReward = 0;
      let actorPendingInvoiceReward = 0;
      let actorUnbilledReward = 0;
      let actorPendingReward = 0;
      let actorTotalReward = 0;

      if (isPersonalView) {
        if (row.manager_id === user.id) {
          actorRole = 'manager';
          actorShareRate = mgrRate;
          actorPaidReward = managerSplit.paid;
          actorPendingInvoiceReward = managerSplit.pending_invoice;
          actorUnbilledReward = managerSplit.unbilled;
          actorPendingReward = managerSplit.pending;
          actorTotalReward = managerSplit.total;
        } else if (row.owner_id === user.id) {
          actorRole = 'owner';
          actorShareRate = ownRate;
          actorPaidReward = ownerSplit.paid;
          actorPendingInvoiceReward = ownerSplit.pending_invoice;
          actorUnbilledReward = ownerSplit.unbilled;
          actorPendingReward = ownerSplit.pending;
          actorTotalReward = ownerSplit.total;
        } else if (row.promoter_id === user.id) {
          actorRole = 'promoter';
          actorShareRate = promRate;
          actorPaidReward = promoterSplit.paid;
          actorPendingInvoiceReward = promoterSplit.pending_invoice;
          actorUnbilledReward = promoterSplit.unbilled;
          actorPendingReward = promoterSplit.pending;
          actorTotalReward = promoterSplit.total;
        }
      }

      return {
        lead_id: row.lead_id,
        lead_code: row.lead_code,
        institute_name: row.institute_name,
        institute_type: row.institute_type,
        city: row.city,
        country: row.country,
        contract_id: row.contract_id,
        contract_value: contractValue,
        duration_months: row.duration_months || 12,
        start_date: row.start_date,
        end_date: row.end_date,
        contract_status: row.contract_status || 'active',
        cleared_cash: clearedCash,
        pending_invoice_cash: pendingInvoiceCash,
        unbilled_cash: unbilledCash,
        pending_cash: pendingCash,
        invoice_count: parseInt(row.invoice_count, 10) || 0,
        promoter: promoterSplit,
        owner: ownerSplit,
        manager: managerSplit,
        total_rewards_paid: totalRewardsPaid,
        total_rewards_pending_invoice: totalRewardsPendingInvoice,
        total_rewards_unbilled: totalRewardsUnbilled,
        total_rewards_pending: totalRewardsPending,
        total_rewards: totalRewards,
        // Actor-specific properties
        actor_role: actorRole,
        actor_rate: actorShareRate,
        actor_paid_reward: actorPaidReward,
        actor_pending_invoice_reward: actorPendingInvoiceReward,
        actor_unbilled_reward: actorUnbilledReward,
        actor_pending_reward: actorPendingReward,
        actor_total_reward: actorTotalReward,
      };
    });

    // Summary KPIs
    let summary: any = {};

    if (!isPersonalView) {
      const totalContractValue = deals.reduce((acc, d) => acc + d.contract_value, 0);
      const totalClearedCash = deals.reduce((acc, d) => acc + d.cleared_cash, 0);
      const totalPendingInvoiceCash = deals.reduce((acc, d) => acc + (d.pending_invoice_cash || 0), 0);
      const totalUnbilledCash = deals.reduce((acc, d) => acc + (d.unbilled_cash || 0), 0);
      const totalPendingCash = totalPendingInvoiceCash + totalUnbilledCash;
      const totalRewardsPaid = deals.reduce((acc, d) => acc + d.total_rewards_paid, 0);
      const totalRewardsPendingInvoice = deals.reduce((acc, d) => acc + (d.total_rewards_pending_invoice || 0), 0);
      const totalRewardsUnbilled = deals.reduce((acc, d) => acc + (d.total_rewards_unbilled || 0), 0);
      const totalRewardsPending = totalRewardsPendingInvoice + totalRewardsUnbilled;
      const netRealizedRevenue = totalClearedCash - totalRewardsPaid;

      summary = {
        totalDeals: deals.length,
        totalContractValue,
        totalClearedCash,
        totalPendingInvoiceCash,
        totalUnbilledCash,
        totalPendingCash,
        totalRewardsPaid,
        totalRewardsPendingInvoice,
        totalRewardsUnbilled,
        totalRewardsPending,
        netRealizedRevenue,
      };
    } else {
      const totalContractValue = deals.reduce((acc, d) => acc + d.contract_value, 0);
      const totalClearedCash = deals.reduce((acc, d) => acc + d.cleared_cash, 0);
      const totalPendingInvoiceCash = deals.reduce((acc, d) => acc + (d.pending_invoice_cash || 0), 0);
      const totalUnbilledCash = deals.reduce((acc, d) => acc + (d.unbilled_cash || 0), 0);
      const totalPendingCash = totalPendingInvoiceCash + totalUnbilledCash;
      const myRewardsPaid = deals.reduce((acc, d) => acc + (d.actor_paid_reward || 0), 0);
      const myRewardsPendingInvoice = deals.reduce((acc, d) => acc + (d.actor_pending_invoice_reward || 0), 0);
      const myRewardsUnbilled = deals.reduce((acc, d) => acc + (d.actor_unbilled_reward || 0), 0);
      const myRewardsPending = myRewardsPendingInvoice + myRewardsUnbilled;
      const myRewardsTotal = deals.reduce((acc, d) => acc + (d.actor_total_reward || 0), 0);

      summary = {
        totalClients: deals.length,
        totalContractValue,
        totalClearedCash,
        totalPendingInvoiceCash,
        totalUnbilledCash,
        totalPendingCash,
        myRewardsPaid,
        myRewardsPendingInvoice,
        myRewardsUnbilled,
        myRewardsPending,
        myRewardsTotal,
      };
    }

    return NextResponse.json({
      role: user.role,
      summary,
      deals,
    });
  } catch (err: any) {
    console.error('Error in GET /api/business:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch business pipeline' }, { status: 500 });
  }
}
