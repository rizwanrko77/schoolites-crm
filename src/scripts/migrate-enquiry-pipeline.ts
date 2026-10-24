import { pool } from '../lib/db';

async function migrateEnquiryPipeline() {
  console.log('🔄 Starting Enquiry Pipeline & Grab Migration...');

  try {
    // 1. Update enquiries status check constraint to include 'in_discussion'
    console.log('1. Updating enquiries_status_check constraint to include in_discussion...');
    await pool.query(`
      ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
      ALTER TABLE enquiries ADD CONSTRAINT enquiries_status_check CHECK (
        status IN ('new', 'contacted', 'in_discussion', 'converted_to_lead', 'discarded')
      );
    `);

    // 2. Add internal_notes column to enquiries
    console.log('2. Adding internal_notes column to enquiries table...');
    await pool.query(`
      ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS internal_notes TEXT;
    `);

    // 3. Add claimed_at column to enquiries
    console.log('3. Adding claimed_at column to enquiries table...');
    await pool.query(`
      ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log('✅ Enquiry Pipeline & Grab Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateEnquiryPipeline();
