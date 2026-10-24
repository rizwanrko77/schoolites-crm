import { pool } from '../lib/db';

async function migrateActorPayouts() {
  console.log('🔄 Starting Actor Commission Payouts Migration...');

  try {
    // 1. Create actor_commission_payouts table
    console.log('1. Creating actor_commission_payouts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS actor_commission_payouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID NOT NULL REFERENCES contract_invoices(id) ON DELETE CASCADE,
          contract_id UUID NOT NULL REFERENCES lead_contracts(id) ON DELETE CASCADE,
          lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          actor_role VARCHAR(50) NOT NULL, -- 'promoter', 'owner', 'manager'
          commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
          invoice_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          payout_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          invoice_status VARCHAR(50) NOT NULL DEFAULT 'raised',
          payout_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid')),
          paid_at TIMESTAMP WITH TIME ZONE,
          payment_method VARCHAR(100),
          payment_reference VARCHAR(100),
          notes TEXT,
          updated_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT uq_invoice_user_role UNIQUE (invoice_id, user_id, actor_role)
      );

      CREATE INDEX IF NOT EXISTS idx_payouts_user ON actor_commission_payouts(user_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_invoice ON actor_commission_payouts(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_status ON actor_commission_payouts(payout_status);
      CREATE INDEX IF NOT EXISTS idx_payouts_lead ON actor_commission_payouts(lead_id);
    `);

    // 2. Backfill existing invoices
    console.log('2. Backfilling existing invoices into actor_commission_payouts...');
    const existingInvoices = await pool.query(`
      SELECT
        ci.id as invoice_id,
        ci.contract_id,
        ci.lead_id,
        ci.amount as invoice_amount,
        ci.status as invoice_status,
        ci.cleared_at,
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
    `);

    console.log(`Found ${existingInvoices.rows.length} invoices to process.`);

    for (const inv of existingInvoices.rows) {
      const invAmt = parseFloat(inv.invoice_amount || '0');
      const isOwnerSameAsManager = Boolean(inv.owner_id && inv.manager_id && inv.owner_id === inv.manager_id);

      // Promoter
      if (inv.promoter_id) {
        const promRate = inv.promoter_rate !== null
          ? parseFloat(inv.promoter_rate)
          : parseFloat(inv.prom_live_rate || '10.00');
        const payoutAmt = Number((invAmt * (promRate / 100)).toFixed(2));

        await pool.query(`
          INSERT INTO actor_commission_payouts (
            invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
          ) VALUES ($1, $2, $3, $4, 'promoter', $5, $6, $7, $8, 'pending')
          ON CONFLICT (invoice_id, user_id, actor_role)
          DO UPDATE SET
            commission_rate = EXCLUDED.commission_rate,
            invoice_amount = EXCLUDED.invoice_amount,
            payout_amount = EXCLUDED.payout_amount,
            invoice_status = EXCLUDED.invoice_status,
            updated_at = NOW();
        `, [inv.invoice_id, inv.contract_id, inv.lead_id, inv.promoter_id, promRate, invAmt, payoutAmt, inv.invoice_status]);
      }

      // Owner (Lead Originator)
      if (inv.owner_id) {
        const ownRate = isOwnerSameAsManager
          ? 0.00
          : (inv.owner_rate !== null
              ? parseFloat(inv.owner_rate)
              : parseFloat(inv.own_live_rate || '10.00'));
        const payoutAmt = Number((invAmt * (ownRate / 100)).toFixed(2));

        await pool.query(`
          INSERT INTO actor_commission_payouts (
            invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
          ) VALUES ($1, $2, $3, $4, 'owner', $5, $6, $7, $8, 'pending')
          ON CONFLICT (invoice_id, user_id, actor_role)
          DO UPDATE SET
            commission_rate = EXCLUDED.commission_rate,
            invoice_amount = EXCLUDED.invoice_amount,
            payout_amount = EXCLUDED.payout_amount,
            invoice_status = EXCLUDED.invoice_status,
            updated_at = NOW();
        `, [inv.invoice_id, inv.contract_id, inv.lead_id, inv.owner_id, ownRate, invAmt, payoutAmt, inv.invoice_status]);
      }

      // Manager (Lead Closer)
      if (inv.manager_id) {
        const mgrRate = inv.manager_rate !== null
          ? parseFloat(inv.manager_rate)
          : parseFloat(inv.mgr_live_rate || '10.00');
        const payoutAmt = Number((invAmt * (mgrRate / 100)).toFixed(2));

        await pool.query(`
          INSERT INTO actor_commission_payouts (
            invoice_id, contract_id, lead_id, user_id, actor_role, commission_rate, invoice_amount, payout_amount, invoice_status, payout_status
          ) VALUES ($1, $2, $3, $4, 'manager', $5, $6, $7, $8, 'pending')
          ON CONFLICT (invoice_id, user_id, actor_role)
          DO UPDATE SET
            commission_rate = EXCLUDED.commission_rate,
            invoice_amount = EXCLUDED.invoice_amount,
            payout_amount = EXCLUDED.payout_amount,
            invoice_status = EXCLUDED.invoice_status,
            updated_at = NOW();
        `, [inv.invoice_id, inv.contract_id, inv.lead_id, inv.manager_id, mgrRate, invAmt, payoutAmt, inv.invoice_status]);
      }
    }

    console.log('✅ Actor Commission Payouts Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateActorPayouts();
