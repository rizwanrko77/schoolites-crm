import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('Running index migration on leads table...');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
  `;
  console.log('✓ Created index idx_leads_created_at ON leads(created_at DESC).');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_leads_promoter ON leads(promoter_id);
  `;
  console.log('✓ Created index idx_leads_promoter ON leads(promoter_id).');

  console.log('Index migration completed successfully!');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
