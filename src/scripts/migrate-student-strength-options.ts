import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { sql } from '../lib/db';

async function runMigration() {
  console.log('Updating form_field_configs options for student_strength...');
  const res = await sql`
    UPDATE form_field_configs 
    SET options = '["Unsure", "Below 200", "Below 500", "500 - 1000", "1000 - 2000", "2000 - 3000", "3000 - 4000", "4000+"]'::jsonb 
    WHERE field_key = 'student_strength' AND form_type = 'lead'
    RETURNING form_type, field_key, options;
  `;
  console.log('✓ Updated form_field_configs for student_strength successfully:', res);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
