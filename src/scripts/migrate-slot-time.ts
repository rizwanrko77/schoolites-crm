import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('Running database migration for preferred_slot_time field_type...');

  await sql`
    UPDATE form_field_configs 
    SET field_type = 'time'
    WHERE field_key = 'preferred_slot_time' AND form_type = 'lead'
  `;
  console.log('✓ Updated form_field_configs for preferred_slot_time to field_type = "time".');

  console.log('Migration completed successfully!');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
