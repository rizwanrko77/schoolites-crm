import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  console.log('--- NEON POSTGRESQL END-TO-END VERIFICATION ---');

  // 1. Connection check
  const nowRes = await sql`SELECT NOW() as current_time, current_database() as db_name, version() as pg_version`;
  console.log('✓ Database Connected:', nowRes[0].db_name);
  console.log('  Server Time:', nowRes[0].current_time);
  console.log('  Engine:', nowRes[0].pg_version.split(',')[0]);

  // 2. Users & Sequences check
  const users = await sql`SELECT id, user_code, name, email, role, is_active FROM users`;
  console.log(`✓ Users in database (${users.length}):`);
  for (const u of users) {
    console.log(`   - [${u.user_code}] ${u.name} (${u.role}) - ${u.email}`);
  }

  // 3. Incentive configurations check
  const incentives = await sql`SELECT role, default_rate_percent, description FROM incentive_configs ORDER BY role`;
  console.log(`✓ Incentive Configurations (${incentives.length}):`);
  for (const inc of incentives) {
    console.log(`   - ${inc.role}: ${inc.default_rate_percent}% (${inc.description})`);
  }

  // 4. Form Field Configurations check
  const enquiryFields = await sql`SELECT count(*)::int as count FROM form_field_configs WHERE form_type = 'enquiry'`;
  const leadFields = await sql`SELECT count(*)::int as count FROM form_field_configs WHERE form_type = 'lead'`;
  console.log(`✓ Form Fields Configured:`);
  console.log(`   - Enquiry Form Fields: ${enquiryFields[0].count} fields`);
  console.log(`   - Lead Form Fields: ${leadFields[0].count} fields`);

  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
