import { pool } from '../lib/db';

async function migratePricingModule() {
  console.log('🔄 Starting Pricing Module Migration...');

  try {
    // 1. Create pricing_variables table
    console.log('1. Creating pricing_variables table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_variables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(64) UNIQUE NOT NULL,
        label VARCHAR(128) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_variables_key ON pricing_variables(key);
    `);

    // 2. Create pricing_templates table
    console.log('2. Creating pricing_templates table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(128) DEFAULT 'Standard Pricing Template',
        content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Create pricing_country_rates table
    console.log('3. Creating pricing_country_rates table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_country_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        country VARCHAR(128) UNIQUE NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_country_rates_country ON pricing_country_rates(country);
    `);

    // 4. Seed default variables if table is empty
    console.log('4. Seeding default variables if empty...');
    const defaultVars = [
      { key: 'country', label: 'Country', sort_order: 1 },
      { key: 'currency', label: 'Currency', sort_order: 2 },
      { key: 'min_rate', label: 'Minimum Rate (Per Student)', sort_order: 3 },
      { key: 'max_rates', label: 'Maximum Rate (Per Student)', sort_order: 4 },
      { key: 'min_contract_duration', label: 'Minimum Contract Duration', sort_order: 5 },
      { key: 'min_contract_amount', label: 'Minimum Total Contract Amount (Whole Institution)', sort_order: 6 },
    ];

    for (const v of defaultVars) {
      await pool.query(
        `INSERT INTO pricing_variables (key, label, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order`,
        [v.key, v.label, v.sort_order]
      );
    }

    // 5. Seed / Update default template with commercial terms
    console.log('5. Updating template with per-student & institutional contract floor terms...');
    const defaultContent = `### Commercial Pricing & Terms - {{country}}

* **Contract Currency:** {{currency}}
* **Approved Rate Range (Per Student):** {{min_rate}} to {{max_rates}} / active student
* **Minimum Contract Duration:** {{min_contract_duration}}
* **Minimum Total Contract Commitment:** {{min_contract_amount}} (whole institution floor, irrespective of student count)

---
#### Commercial Guidance & Proposal Baseline:
1. All client proposals for educational institutions in **{{country}}** must strictly meet both the approved per-student baseline ({{min_rate}} - {{max_rates}}) AND satisfy the whole-institution minimum commitment floor of **{{min_contract_amount}}**.
2. Contractual invoices and payment milestones must be settled strictly in **{{currency}}**.
3. Custom volume discounts below **{{min_rate}}** or deviations from the institutional floor require prior authorization from the Business Relations Directorate.`;

    const checkTemplate = await pool.query(`SELECT id FROM pricing_templates LIMIT 1`);
    if (checkTemplate.rowCount === 0) {
      await pool.query(
        `INSERT INTO pricing_templates (title, content, is_active)
         VALUES ('Standard Enterprise Pricing', $1, TRUE)`,
        [defaultContent]
      );
    } else {
      await pool.query(
        `UPDATE pricing_templates SET content = $1 WHERE id = $2`,
        [defaultContent, checkTemplate.rows[0].id]
      );
    }

    // 6. Seed demo country rows if empty
    console.log('6. Seeding initial country rates if empty...');
    const checkRates = await pool.query(`SELECT id FROM pricing_country_rates LIMIT 1`);
    if (checkRates.rowCount === 0) {
      const demoData = [
        {
          country: 'India',
          data: {
            country: 'India',
            currency: 'INR (₹)',
            min_rate: '₹450',
            max_rates: '₹850',
            min_contract_duration: '12 Months',
            min_contract_amount: '₹1,50,000',
          },
        },
        {
          country: 'United States',
          data: {
            country: 'United States',
            currency: 'USD ($)',
            min_rate: '$8.00',
            max_rates: '$15.00',
            min_contract_duration: '12 Months',
            min_contract_amount: '$5,000',
          },
        },
        {
          country: 'United Arab Emirates',
          data: {
            country: 'United Arab Emirates',
            currency: 'AED',
            min_rate: '30 AED',
            max_rates: '55 AED',
            min_contract_duration: '12 Months',
            min_contract_amount: '18,000 AED',
          },
        },
      ];

      for (const row of demoData) {
        await pool.query(
          `INSERT INTO pricing_country_rates (country, data)
           VALUES ($1, $2)
           ON CONFLICT (country) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [row.country, JSON.stringify(row.data)]
        );
      }
    }

    console.log('✅ Pricing Module Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePricingModule();
