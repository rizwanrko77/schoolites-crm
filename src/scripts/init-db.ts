import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from '@neondatabase/serverless';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  console.log('Connected to Neon PostgreSQL successfully!');

  try {
    // 1. Run Schema Migrations
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/schema.sql'), 'utf-8');
    console.log('Applying schema to database...');
    await client.query(schemaSql);
    console.log('✓ Schema applied successfully.');

    // 2. Seed Default Incentive / Commission Configurations
    console.log('Seeding default incentive configurations...');
    const incentives = [
      { role: 'pre_sales', rate: 10.00, desc: 'Pre-Sales team default incentive rate (10%)' },
      { role: 'referral', rate: 20.00, desc: 'Referral partner default commission rate (20%)' },
      { role: 'business_relations', rate: 10.00, desc: 'Business Relations team closing incentive rate (10%)' },
    ];

    for (const inc of incentives) {
      await client.query(
        `INSERT INTO incentive_configs (role, default_rate_percent, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (role) DO UPDATE 
         SET default_rate_percent = EXCLUDED.default_rate_percent, description = EXCLUDED.description`,
        [inc.role, inc.rate, inc.desc]
      );
    }
    console.log('✓ Incentive configurations seeded.');

    // 3. Seed Default Form Field Configurations for Enquiry Form
    console.log('Seeding Enquiry Form default field configurations...');
    const enquiryFields = [
      { key: 'name', label: 'SPOC / Contact Name', category: 'spoc', type: 'text', options: [], visible: true, required: true, order: 1 },
      { key: 'phone', label: 'Phone Number', category: 'spoc', type: 'number', options: [], visible: true, required: true, order: 2 },
      { key: 'email', label: 'Email Address', category: 'spoc', type: 'text', options: [], visible: true, required: false, order: 3 },
      { key: 'institute_type', label: 'Institute / Org Type', category: 'institute', type: 'select', options: ['School', 'College', 'Institution', 'University', 'Other'], visible: true, required: true, order: 4 },
      { key: 'institute_name', label: 'Name of Organization', category: 'institute', type: 'text', options: [], visible: true, required: false, order: 5 },
      { key: 'country', label: 'Country', category: 'institute', type: 'text', options: [], visible: true, required: true, order: 6 },
      { key: 'city', label: 'City', category: 'institute', type: 'text', options: [], visible: true, required: false, order: 7 },
      { key: 'student_count', label: 'Student Count / Capacity', category: 'institute', type: 'text', options: [], visible: true, required: false, order: 8 },
      { key: 'website', label: 'Website URL', category: 'institute', type: 'text', options: [], visible: true, required: false, order: 9 },
      { key: 'message', label: 'Message / Requirements', category: 'general', type: 'textarea', options: [], visible: true, required: false, order: 10 },
    ];

    for (const f of enquiryFields) {
      await client.query(
        `INSERT INTO form_field_configs (form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order)
         VALUES ('enquiry', $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (form_type, field_key) DO UPDATE
         SET label = EXCLUDED.label, category = EXCLUDED.category, field_type = EXCLUDED.field_type,
             options = EXCLUDED.options, is_visible = EXCLUDED.is_visible, is_required = EXCLUDED.is_required, display_order = EXCLUDED.display_order`,
        [f.key, f.label, f.category, f.type, JSON.stringify(f.options), f.visible, f.required, f.order]
      );
    }
    console.log('✓ Enquiry Form fields seeded.');

    // 4. Seed Default Form Field Configurations for Lead Form
    console.log('Seeding Lead Form default field configurations...');
    const leadFields = [
      { key: 'institute_type', label: 'Institute Type', category: 'institute', type: 'select', options: ['School', 'College', 'Institution', 'University', 'Other'], visible: true, required: true, order: 1 },
      { key: 'institute_name', label: 'Institute Name', category: 'institute', type: 'text', options: [], visible: true, required: true, order: 2 },
      { key: 'country', label: 'Country', category: 'institute', type: 'text', options: [], visible: true, required: true, order: 3 },
      { key: 'city', label: 'City', category: 'institute', type: 'text', options: [], visible: true, required: true, order: 4 },
      { key: 'student_strength', label: 'Student Strength', category: 'institute', type: 'text', options: [], visible: true, required: true, order: 5 },
      { key: 'current_erp', label: 'Current ERP System', category: 'institute', type: 'select', options: ['yes', 'no', 'unsure'], visible: true, required: true, order: 6 },
      
      { key: 'spoc_name', label: 'SPOC Name', category: 'spoc', type: 'text', options: [], visible: true, required: true, order: 7 },
      { key: 'spoc_role', label: 'SPOC Role / Designation', category: 'spoc', type: 'text', options: [], visible: true, required: true, order: 8 },
      { key: 'spoc_phone', label: 'SPOC Mobile / WhatsApp', category: 'spoc', type: 'number', options: [], visible: true, required: true, order: 9 },
      { key: 'spoc_email', label: 'SPOC Email', category: 'spoc', type: 'text', options: [], visible: true, required: false, order: 10 },
      
      { key: 'dm_same_as_spoc', label: 'Decision Maker same as SPOC', category: 'decision_maker', type: 'checkbox', options: [], visible: true, required: false, order: 11 },
      { key: 'dm_name', label: 'Decision Maker Name', category: 'decision_maker', type: 'text', options: [], visible: true, required: true, order: 12 },
      { key: 'dm_role', label: 'Decision Maker Role / Designation', category: 'decision_maker', type: 'text', options: [], visible: true, required: true, order: 13 },
      { key: 'dm_phone', label: 'Decision Maker Mobile / WhatsApp', category: 'decision_maker', type: 'number', options: [], visible: true, required: true, order: 14 },
      { key: 'dm_email', label: 'Decision Maker Email', category: 'decision_maker', type: 'text', options: [], visible: true, required: false, order: 15 },
      
      { key: 'additional_contact_name', label: 'Additional Contact Person Name', category: 'additional_contact', type: 'text', options: [], visible: true, required: false, order: 16 },
      { key: 'additional_contact_role', label: 'Additional Contact Designation / Role', category: 'additional_contact', type: 'text', options: [], visible: true, required: false, order: 17 },
      { key: 'additional_contact_phone', label: 'Additional Contact Mobile / WhatsApp', category: 'additional_contact', type: 'number', options: [], visible: true, required: false, order: 18 },
      { key: 'additional_contact_email', label: 'Additional Contact Email', category: 'additional_contact', type: 'text', options: [], visible: true, required: false, order: 19 },
      
      { key: 'decision_flow', label: 'Decision Flow', category: 'pipeline', type: 'textarea', options: [], visible: true, required: false, order: 20 },
      { key: 'preferred_slot_date', label: 'Preferred Connect Date', category: 'pipeline', type: 'date', options: [], visible: true, required: false, order: 21 },
      { key: 'preferred_slot_time', label: 'Preferred Connect Time', category: 'pipeline', type: 'text', options: [], visible: true, required: false, order: 22 },
      { key: 'preferred_slot_mode', label: 'Preferred Connect Mode', category: 'pipeline', type: 'select', options: ['Phone/WhatsApp Call', 'Virtual Meet', 'Unsure'], visible: true, required: false, order: 23 },
      { key: 'expected_start_date', label: 'Expected Implementation Start', category: 'pipeline', type: 'select', options: ['Immediately (Within 1-2 weeks)', 'Within 1 Month', 'Within 2-3 Months', 'Next Academic Session', 'Flexible / Exploring', 'Specific Date...'], visible: true, required: false, order: 24 },
      { key: 'additional_details', label: 'Additional Details', category: 'pipeline', type: 'textarea', options: [], visible: true, required: false, order: 25 },
    ];

    for (const f of leadFields) {
      await client.query(
        `INSERT INTO form_field_configs (form_type, field_key, label, category, field_type, options, is_visible, is_required, display_order)
         VALUES ('lead', $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (form_type, field_key) DO UPDATE
         SET label = EXCLUDED.label, category = EXCLUDED.category, field_type = EXCLUDED.field_type,
             options = EXCLUDED.options, is_visible = EXCLUDED.is_visible, is_required = EXCLUDED.is_required, display_order = EXCLUDED.display_order`,
        [f.key, f.label, f.category, f.type, JSON.stringify(f.options), f.visible, f.required, f.order]
      );
    }
    console.log('✓ Lead Form fields seeded.');

    // 5. Check and seed initial Root Admin User if not exists
    const adminCheck = await client.query(`SELECT id, user_code, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminCheck.rows.length === 0) {
      const codeSeqRes = await client.query(`SELECT nextval('user_code_seq') as next_val`);
      const userCode = `ADM-${codeSeqRes.rows[0].next_val}`;
      const defaultAdminEmail = 'admin@schoolites.com';
      await client.query(
        `INSERT INTO users (user_code, name, email, role, date_of_joining, description, is_active)
         VALUES ($1, 'Portal Administrator', $2, 'admin', CURRENT_DATE, 'Initial system administrator account', TRUE)`,
        [userCode, defaultAdminEmail]
      );
      console.log(`✓ Seeded Root Admin user: ${userCode} (${defaultAdminEmail})`);
    } else {
      console.log(`✓ Existing Admin user detected: ${adminCheck.rows[0].user_code} (${adminCheck.rows[0].email})`);
    }

    console.log('\nAll Neon database schema migrations and seedings completed successfully!');
  } catch (err) {
    console.error('Database migration/seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
