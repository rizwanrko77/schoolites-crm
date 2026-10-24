import { pool } from '../lib/db';

async function migrateContractsInvoices() {
  console.log('🔄 Starting Lead Contracts & Invoices Migration...');

  try {
    // 1. Create lead_contracts table
    console.log('1. Creating lead_contracts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_contracts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          contract_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          duration_months INT DEFAULT 12,
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'renewed')),
          notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lead_contracts_lead ON lead_contracts(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_contracts_status ON lead_contracts(status);
    `);

    // 2. Create contract_invoices table
    console.log('2. Creating contract_invoices table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contract_invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contract_id UUID NOT NULL REFERENCES lead_contracts(id) ON DELETE CASCADE,
          lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          invoice_number VARCHAR(100),
          amount NUMERIC(14, 2) NOT NULL,
          raise_date DATE DEFAULT CURRENT_DATE,
          due_date DATE,
          status VARCHAR(50) NOT NULL DEFAULT 'raised' CHECK (status IN ('raised', 'pending', 'cleared', 'cancelled')),
          cleared_at TIMESTAMP WITH TIME ZONE,
          payment_method VARCHAR(100),
          payment_reference VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract ON contract_invoices(contract_id);
      CREATE INDEX IF NOT EXISTS idx_contract_invoices_lead ON contract_invoices(lead_id);
      CREATE INDEX IF NOT EXISTS idx_contract_invoices_status ON contract_invoices(status);
    `);

    console.log('✅ Lead Contracts & Invoices Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateContractsInvoices();
