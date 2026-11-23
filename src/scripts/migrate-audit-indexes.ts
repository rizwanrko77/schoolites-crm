import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { pool } from '../lib/db';

async function run() {
  console.log('Ensuring indexes for audit_logs and db_place_history...');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_record_type ON audit_logs(record_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_db_place_history_created_at ON db_place_history(created_at DESC);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_db_pipeline_requests_created_at ON db_pipeline_requests(created_at DESC);');
  console.log('✅ Audit and history indexes created successfully!');
  await pool.end();
}

run().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
