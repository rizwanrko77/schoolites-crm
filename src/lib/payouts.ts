import { sql } from './db';

/**
 * Synchronizes actor commission payouts for a given invoice.
 * Respects snapshotted contract rates and closer priority rules (owner_id === manager_id => owner_rate = 0).
 */
export async function syncInvoicePayouts(invoiceId: string) {
  try {
    const invoiceRows = await sql`
      SELECT
        ci.id as invoice_id,
        ci.contract_id,
        ci.lead_id,
        ci.amount as invoice_amount,
        ci.status as invoice_status,
        l.promoter_id,
        l.owner_id,
        l.manager_id,
        lc.promoter_rate,
        lc.owner_rate,
        lc.manager_rate,
        u_p.commission_rate as prom_live_rate,
        u_o.commission_rate as own_live_rate,
        u_m.commission_rate as mgr_live_rate
      FROM contract_invoices ci
      JOIN lead_contracts lc ON ci.contract_id = lc.id
      JOIN leads l ON ci.lead_id = l.id
      LEFT JOIN users u_p ON l.promoter_id = u_p.id
      LEFT JOIN users u_o ON l.owner_id = u_o.id
      LEFT JOIN users u_m ON l.manager_id = u_m.id
      WHERE ci.id = ${invoiceId}
      LIMIT 1
    `;

    if (invoiceRows.length === 0) return;
    const inv = invoiceRows[0];
    const invAmt = parseFloat(inv.invoice_amount || '0');
    const isOwnerSameAsManager = Boolean(inv.owner_id && inv.manager_id && inv.owner_id === inv.manager_id);

    // 1. Promoter
    if (inv.promoter_id) {
      const promRate = inv.promoter_rate !== null
        ? parseFloat(inv.promoter_rate)
        : parseFloat(inv.prom_live_rate || '10.00');
      const payoutAmt = Number((invAmt * (promRate / 100)).toFixed(2));

      await sql`
        INSERT INTO actor_commission_payouts (
          invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
        ) VALUES (${inv.invoice_id}, ${inv.contract_id}, ${inv.lead_id}, ${inv.promoter_id}, 'promoter', ${promRate}, ${invAmt}, ${payoutAmt}, ${inv.invoice_status}, 'pending')
        ON CONFLICT (invoice_id, user_id, actor_role)
        DO UPDATE SET
          commission_rate = EXCLUDED.commission_rate,
          invoice_amount = EXCLUDED.invoice_amount,
          payout_amount = EXCLUDED.payout_amount,
          invoice_status = EXCLUDED.invoice_status,
          updated_at = NOW();
      `;
    }

    // 2. Owner (Lead Originator)
    if (inv.owner_id) {
      const ownRate = isOwnerSameAsManager
        ? 0.00
        : (inv.owner_rate !== null
            ? parseFloat(inv.owner_rate)
            : parseFloat(inv.own_live_rate || '10.00'));
      const payoutAmt = Number((invAmt * (ownRate / 100)).toFixed(2));

      await sql`
        INSERT INTO actor_commission_payouts (
          invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
        ) VALUES (${inv.invoice_id}, ${inv.contract_id}, ${inv.lead_id}, ${inv.owner_id}, 'owner', ${ownRate}, ${invAmt}, ${payoutAmt}, ${inv.invoice_status}, 'pending')
        ON CONFLICT (invoice_id, user_id, actor_role)
        DO UPDATE SET
          commission_rate = EXCLUDED.commission_rate,
          invoice_amount = EXCLUDED.invoice_amount,
          payout_amount = EXCLUDED.payout_amount,
          invoice_status = EXCLUDED.invoice_status,
          updated_at = NOW();
      `;
    }

    // 3. Manager (Lead Closer)
    if (inv.manager_id) {
      const mgrRate = inv.manager_rate !== null
        ? parseFloat(inv.manager_rate)
        : parseFloat(inv.mgr_live_rate || '10.00');
      const payoutAmt = Number((invAmt * (mgrRate / 100)).toFixed(2));

      await sql`
        INSERT INTO actor_commission_payouts (
          invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
        ) VALUES (${inv.invoice_id}, ${inv.contract_id}, ${inv.lead_id}, ${inv.manager_id}, 'manager', ${mgrRate}, ${invAmt}, ${payoutAmt}, ${inv.invoice_status}, 'pending')
        ON CONFLICT (invoice_id, user_id, actor_role)
        DO UPDATE SET
          commission_rate = EXCLUDED.commission_rate,
          invoice_amount = EXCLUDED.invoice_amount,
          payout_amount = EXCLUDED.payout_amount,
          invoice_status = EXCLUDED.invoice_status,
          updated_at = NOW();
      `;
    }
  } catch (err) {
    console.error('Error syncing invoice payouts:', err);
  }
}
