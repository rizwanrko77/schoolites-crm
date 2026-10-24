import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('Running database migration for preferred_slot_mode and student_strength...');

  // 1. Drop old constraint and add updated check constraint
  await sql`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_preferred_slot_mode_check`;
  await sql`
    ALTER TABLE leads 
    ADD CONSTRAINT leads_preferred_slot_mode_check 
    CHECK (preferred_slot_mode IN ('Phone/WhatsApp Call', 'Virtual Meet', 'Unsure', 'Call', 'Meeting', 'Other'))
  `;
  console.log('✓ Updated leads_preferred_slot_mode_check constraint.');

  // 2. Update form_field_configs table options for admin configurator
  await sql`
    UPDATE form_field_configs 
    SET options = '["Phone/WhatsApp Call", "Virtual Meet", "Unsure"]'::jsonb 
    WHERE field_key = 'preferred_slot_mode' AND form_type = 'lead'
  `;
  console.log('✓ Updated form_field_configs for preferred_slot_mode.');

  await sql`
    UPDATE form_field_configs 
    SET options = '["Below 500", "500 - 1000", "1000 - 2000", "2000 - 3000", "3000 - 4000", "4000+"]'::jsonb 
    WHERE field_key = 'student_strength' AND form_type = 'lead'
  `;
  console.log('✓ Updated form_field_configs for student_strength.');

  console.log('Migration completed successfully!');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
