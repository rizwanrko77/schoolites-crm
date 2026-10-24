import { pool } from '../lib/db';

async function migrateLeadStatuses() {
  console.log('🔄 Starting Lead Statuses Migration...');

  try {
    // 1. Drop existing check constraint if present
    console.log('Dropping old leads_status_check constraint...');
    await pool.query(`
      ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
    `);

    // 2. Add expanded check constraint with all 11 lifecycle statuses
    console.log('Adding new leads_status_check with 11 lifecycle statuses...');
    await pool.query(`
      ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (
        status IN (
          'unassigned',
          'assigned',
          'demo_scheduled',
          'demo_completed',
          'in_discussion',
          'following_up',
          'proposal_sent',
          'onboarding_initiated',
          'onboarding_completed',
          'won',
          'lost'
        )
      );
    `);

    console.log('✅ Lead Statuses Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateLeadStatuses();
