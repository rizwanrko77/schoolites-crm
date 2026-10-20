import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function cleanMockData() {
  console.log('=== CLEANING MOCK DATA & RESETTING FOR MANUAL TESTING ===\n');

  try {
    // 1. Delete all transactional / pipeline data
    console.log('1. Purging test pipeline records...');
    await sql`DELETE FROM audit_logs`;
    console.log('  ✓ Purged audit_logs');

    await sql`DELETE FROM record_notes`;
    console.log('  ✓ Purged record_notes');

    await sql`DELETE FROM leads`;
    console.log('  ✓ Purged leads');

    await sql`DELETE FROM enquiries`;
    console.log('  ✓ Purged enquiries');

    await sql`DELETE FROM payout_records`;
    console.log('  ✓ Purged payout_records');

    await sql`DELETE FROM db_pipeline_requests`;
    console.log('  ✓ Purged db_pipeline_requests');

    await sql`DELETE FROM db_businesses`;
    console.log('  ✓ Purged db_businesses');

    await sql`DELETE FROM otps`;
    console.log('  ✓ Purged otps');

    await sql`DELETE FROM sessions`;
    console.log('  ✓ Purged active sessions');

    // 2. Clean extra users, keep only the 4 standard baseline test actors
    console.log('\n2. Sanitizing users to baseline 4 actors...');
    const baselineEmails = [
      'admin@schoolites.com',
      'rahul.ps@schoolites.com',
      'anita.partner@schoolites.com',
      'vikram.br@schoolites.com',
    ];

    await sql`
      DELETE FROM users 
      WHERE email NOT IN (${baselineEmails[0]}, ${baselineEmails[1]}, ${baselineEmails[2]}, ${baselineEmails[3]})
    `;
    console.log('  ✓ Removed non-baseline test users');

    // Ensure the 4 baseline actors exist with standard codes
    const baselineUsers = [
      { code: 'ADM-101', name: 'Portal Administrator', email: 'admin@schoolites.com', role: 'admin', desc: 'Root system administrator' },
      { code: 'PS-102', name: 'Rahul Sharma', email: 'rahul.ps@schoolites.com', role: 'pre_sales', desc: 'Pre-Sales Representative' },
      { code: 'REF-103', name: 'Anita Desai', email: 'anita.partner@schoolites.com', role: 'referral', desc: 'Institutional Referral Partner' },
      { code: 'BR-104', name: 'Vikram Singh', email: 'vikram.br@schoolites.com', role: 'business_relations', desc: 'Business Relations Manager' },
    ];

    for (const u of baselineUsers) {
      await sql`
        INSERT INTO users (user_code, name, email, role, date_of_joining, description, is_active)
        VALUES (${u.code}, ${u.name}, ${u.email}, ${u.role}, CURRENT_DATE, ${u.desc}, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET user_code = ${u.code}, name = ${u.name}, role = ${u.role}, is_active = TRUE
      `;
      console.log(`  ✓ Verified actor: ${u.name} [${u.code}] - ${u.email} (${u.role})`);
    }

    // 3. Reset Sequences for fresh manual test IDs
    console.log('\n3. Resetting sequence counters...');
    await sql`ALTER SEQUENCE enquiry_code_seq RESTART WITH 1001`;
    console.log('  ✓ Reset enquiry_code_seq -> 1001 (next will be ENQ-1001)');

    await sql`ALTER SEQUENCE lead_code_seq RESTART WITH 1001`;
    console.log('  ✓ Reset lead_code_seq -> 1001 (next will be LD-1001)');

    await sql`ALTER SEQUENCE user_code_seq RESTART WITH 105`;
    console.log('  ✓ Reset user_code_seq -> 105 (next will be USR-105)');

    // 4. Verify counts
    const leadCount = await sql`SELECT count(*) FROM leads`;
    const enqCount = await sql`SELECT count(*) FROM enquiries`;
    const userCount = await sql`SELECT count(*) FROM users`;
    const assetCount = await sql`SELECT count(*) FROM assets`;

    console.log('\n=== DATABASE PURGE SUMMARY ===');
    console.log(`• Active Leads: ${leadCount[0].count} (Cleaned)`);
    console.log(`• Active Enquiries: ${enqCount[0].count} (Cleaned)`);
    console.log(`• Active Actors: ${userCount[0].count} (ADM-101, PS-102, REF-103, BR-104 ready)`);
    console.log(`• Active Assets: ${assetCount[0].count} (Ready for marketing hub)`);
    console.log('✓ SYSTEM IS 100% READY FOR MANUAL TESTING!\n');
  } catch (err) {
    console.error('Error cleaning database:', err);
    process.exit(1);
  }
}

cleanMockData();
