import { pool } from '../lib/db';

async function migrateContractSplits() {
  console.log('🔄 Starting Lead Contracts Split Snapshots Migration...');

  try {
    console.log('1. Adding snapshot commission rate columns to lead_contracts...');
    await pool.query(`
      ALTER TABLE lead_contracts
      ADD COLUMN IF NOT EXISTS promoter_rate NUMERIC(5, 2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS owner_rate NUMERIC(5, 2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS manager_rate NUMERIC(5, 2) DEFAULT NULL;
    `);

    console.log('2. Backfilling existing contracts with historical rates...');
    await pool.query(`
      UPDATE lead_contracts lc
      SET
        promoter_rate = COALESCE(lc.promoter_rate, (
          SELECT u.commission_rate FROM leads l JOIN users u ON l.promoter_id = u.id WHERE l.id = lc.lead_id
        )),
        owner_rate = COALESCE(lc.owner_rate, (
          SELECT CASE
            WHEN l.owner_id = l.manager_id THEN 0.00
            ELSE COALESCE(u.commission_rate, 10.00)
          END
          FROM leads l JOIN users u ON l.owner_id = u.id WHERE l.id = lc.lead_id
        )),
        manager_rate = COALESCE(lc.manager_rate, (
          SELECT COALESCE(u.commission_rate, 10.00)
          FROM leads l JOIN users u ON l.manager_id = u.id WHERE l.id = lc.lead_id
        ))
      WHERE lc.manager_rate IS NULL OR lc.owner_rate IS NULL;
    `);

    console.log('✅ Lead Contracts Split Snapshots Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateContractSplits();
