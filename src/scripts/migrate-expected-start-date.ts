import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('Running database migration for expected_start_date...');

  // 1. Add expected_start_date column to leads table
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_start_date VARCHAR(100)`;
  console.log('✓ Added expected_start_date column to leads table.');

  // 2. Upsert form_field_configs for expected_start_date
  await sql`
    INSERT INTO form_field_configs (form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order)
    VALUES (
      'lead', 
      'expected_start_date', 
      'Expected Start Date', 
      'pipeline', 
      'select', 
      '["Immediately (Within 1-2 weeks)", "Within 1 Month", "Within 2-3 Months", "Next Academic Session", "Flexible / Exploring", "Specific Date..."]'::jsonb, 
      true, 
      false, 
      24
    )
    ON CONFLICT (form_type, field_key) DO UPDATE
    SET label = EXCLUDED.label, options = EXCLUDED.options, is_visible = EXCLUDED.is_visible
  `;
  console.log('✓ Upserted form_field_configs for expected_start_date.');

  console.log('Migration completed successfully!');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
