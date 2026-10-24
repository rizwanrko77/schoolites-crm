import { pool } from '../lib/db';

async function migratePromoterRole() {
  console.log('🔄 Starting Promoter Role & Attribution Migration...');

  try {
    // 1. Update users role check constraint
    console.log('1. Updating users_role_check constraint to include promoter...');
    await pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
        role IN ('admin', 'pre_sales', 'referral', 'business_relations', 'promoter')
      );
    `);

    // 2. Add commission_rate column to users
    console.log('2. Adding commission_rate column to users table...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 10.00;
    `);

    // 3. Add promoter_id to enquiries
    console.log('3. Adding promoter_id to enquiries table...');
    await pool.query(`
      ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES users(id);
      CREATE INDEX IF NOT EXISTS idx_enquiries_promoter ON enquiries(promoter_id);
    `);

    // 4. Add promoter_id to leads
    console.log('4. Adding promoter_id to leads table...');
    await pool.query(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES users(id);
      CREATE INDEX IF NOT EXISTS idx_leads_promoter ON leads(promoter_id);
    `);

    console.log('✅ Promoter Role & Attribution Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePromoterRole();
