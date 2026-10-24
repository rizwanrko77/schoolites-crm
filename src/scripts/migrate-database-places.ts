import { pool } from '../lib/db';

async function migrateDatabasePlaces() {
  console.log('🔄 Starting Places Database & Outreach Pipeline Migration...');

  try {
    // 1. Add has_database_access to users
    console.log('1. Checking users table for has_database_access...');
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS has_database_access BOOLEAN NOT NULL DEFAULT false;
    `);

    // 2. Upgrade db_businesses table
    console.log('2. Upgrading db_businesses table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS db_businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        place_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        formatted_address TEXT,
        city VARCHAR(100),
        phone VARCHAR(100),
        website TEXT,
        raw_payload JSONB DEFAULT '{}'::jsonb,
        assigned_to_user_id UUID REFERENCES users(id),
        assigned_batch_id UUID,
        status VARCHAR(50) DEFAULT 'fresh',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Drop old status check constraint if it exists so we can support modern outreach statuses
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE db_businesses DROP CONSTRAINT IF EXISTS db_businesses_status_check;
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END $$;
    `);

    // Add all rich columns from Google Places & Apps Script
    await pool.query(`
      ALTER TABLE db_businesses
      ADD COLUMN IF NOT EXISTS primary_phone VARCHAR(100),
      ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(100),
      ADD COLUMN IF NOT EXISTS maps_url TEXT,
      ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2),
      ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS primary_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS type_tags JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS street_address TEXT,
      ADD COLUMN IF NOT EXISTS area VARCHAR(150),
      ADD COLUMN IF NOT EXISTS state VARCHAR(100),
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS business_status VARCHAR(50) DEFAULT 'OPERATIONAL',
      ADD COLUMN IF NOT EXISTS regular_opening_hours JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS search_keyword VARCHAR(255),
      ADD COLUMN IF NOT EXISTS search_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS search_area VARCHAR(150),
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS callback_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS converted_lead_id UUID REFERENCES leads(id);
    `);

    // Ensure phone defaults to primary_phone if primary_phone is null
    await pool.query(`
      UPDATE db_businesses
      SET primary_phone = phone
      WHERE primary_phone IS NULL AND phone IS NOT NULL;
    `);

    // Create helpful indices
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_db_businesses_place_id ON db_businesses(place_id);
      CREATE INDEX IF NOT EXISTS idx_db_businesses_assigned ON db_businesses(assigned_to_user_id);
      CREATE INDEX IF NOT EXISTS idx_db_businesses_status ON db_businesses(status);
      CREATE INDEX IF NOT EXISTS idx_db_businesses_city ON db_businesses(city);
    `);

    // 3. Create db_place_history for complete audit trail
    console.log('3. Creating db_place_history audit trail table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS db_place_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        place_id VARCHAR(255) NOT NULL,
        business_id UUID REFERENCES db_businesses(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_db_history_place_id ON db_place_history(place_id);
      CREATE INDEX IF NOT EXISTS idx_db_history_actor_id ON db_place_history(actor_id);
    `);

    // 4. Upgrade db_pipeline_requests table
    console.log('4. Upgrading db_pipeline_requests table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS db_pipeline_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        remaining_count INT DEFAULT 0,
        requested_count INT DEFAULT 25,
        preferred_city VARCHAR(100),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected')),
        fulfilled_by UUID REFERENCES users(id),
        fulfilled_count INT DEFAULT 0,
        fulfilled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE db_pipeline_requests
      ADD COLUMN IF NOT EXISTS remaining_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS requested_count INT DEFAULT 25,
      ADD COLUMN IF NOT EXISTS preferred_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS fulfilled_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS fulfilled_count INT DEFAULT 0;
    `);

    console.log('✅ Places Database & Outreach Pipeline Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateDatabasePlaces();
