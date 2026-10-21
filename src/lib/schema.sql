-- Schoolites CRM Database Schema (Neon PostgreSQL)

-- 1. Sequences for human-readable codes
CREATE SEQUENCE IF NOT EXISTS user_code_seq START WITH 101;
CREATE SEQUENCE IF NOT EXISTS enquiry_code_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS lead_code_seq START WITH 1001;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'pre_sales', 'referral', 'business_relations')),
    date_of_joining DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. One-Time Passwords (OTP) for Passwordless Email Auth
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

-- 4. Active Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 5. Hybrid Form Field Configurations (Admin Configurable)
CREATE TABLE IF NOT EXISTS form_field_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('enquiry', 'lead')),
    field_key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    is_visible BOOLEAN DEFAULT TRUE,
    is_required BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(form_type, field_key)
);

-- 6. Enquiries Table (Attributed to User Code / Owner)
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_code VARCHAR(32) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    spoc_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    institute_type VARCHAR(100),
    institute_name VARCHAR(255),
    country VARCHAR(100) DEFAULT 'India',
    city VARCHAR(100),
    student_count VARCHAR(50),
    website VARCHAR(255),
    message TEXT,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted_to_lead', 'discarded')),
    converted_lead_id UUID,
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enquiries_owner ON enquiries(owner_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_phone ON enquiries(phone);

-- 7. Leads Table (Core Pipeline)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(32) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    manager_id UUID REFERENCES users(id),
    source_enquiry_id UUID REFERENCES enquiries(id),
    
    -- Institute info
    institute_type VARCHAR(100) NOT NULL,
    institute_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    city VARCHAR(100) NOT NULL,
    student_strength VARCHAR(100) NOT NULL,
    current_erp VARCHAR(50) NOT NULL CHECK (current_erp IN ('yes', 'no', 'unsure')),
    current_erp_name VARCHAR(100),
    
    -- SPOC Contact details
    spoc_name VARCHAR(255) NOT NULL,
    spoc_role VARCHAR(100) NOT NULL,
    spoc_phone VARCHAR(50) NOT NULL,
    spoc_email VARCHAR(255),
    
    -- Decision Maker Contact details
    dm_same_as_spoc BOOLEAN DEFAULT FALSE,
    dm_name VARCHAR(255) NOT NULL,
    dm_role VARCHAR(100) NOT NULL,
    dm_phone VARCHAR(50) NOT NULL,
    dm_email VARCHAR(255),
    
    -- Additional Contact
    additional_contact_name VARCHAR(255),
    additional_contact_role VARCHAR(100),
    additional_contact_phone VARCHAR(50),
    additional_contact_email VARCHAR(255),
    
    -- Decision Flow & Connect Slot
    decision_flow TEXT,
    preferred_slot_date DATE,
    preferred_slot_time VARCHAR(50),
    preferred_slot_mode VARCHAR(50) CHECK (preferred_slot_mode IN ('Phone/WhatsApp Call', 'Virtual Meet', 'Unsure', 'Call', 'Meeting', 'Other')),
    additional_details TEXT,
    
    -- Status & Valuation
    status VARCHAR(50) DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'in_discussion', 'proposal_sent', 'won', 'lost')),
    deal_value NUMERIC(14, 2) DEFAULT 0.00,
    
    -- Duplicate Detection Flagging
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of_lead_id UUID REFERENCES leads(id),
    duplicate_flag_cleared BOOLEAN DEFAULT FALSE,
    
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_manager ON leads(manager_id);
CREATE INDEX IF NOT EXISTS idx_leads_spoc_phone ON leads(spoc_phone);
CREATE INDEX IF NOT EXISTS idx_leads_spoc_email ON leads(spoc_email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- 8. Notes & Remarks (Personal vs Global)
CREATE TABLE IF NOT EXISTS record_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('lead', 'db_record')),
    record_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    visibility VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'global')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_record_notes_record ON record_notes(record_type, record_id);

-- 9. Immutable Audit Logs & Event History
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_type, record_id);

-- 10. Incentive & Commission Configurations
CREATE TABLE IF NOT EXISTS incentive_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) UNIQUE NOT NULL CHECK (role IN ('pre_sales', 'referral', 'business_relations')),
    default_rate_percent NUMERIC(5, 2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Payout Ledgers (Incentives & Commissions)
CREATE TABLE IF NOT EXISTS payout_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('pre_sales', 'referral', 'business_relations')),
    payout_type VARCHAR(50) NOT NULL CHECK (payout_type IN ('incentive', 'commission')),
    amount NUMERIC(14, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    utr_reference VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    cleared_by_admin_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payout_records_user ON payout_records(user_id);

-- 12. Marketing Assets & Template Hub
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'text', 'pdf', 'video_link')),
    content_url TEXT NOT NULL,
    body_text TEXT,
    storage_key TEXT,
    files JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Database Pipeline (Places API Search Cache & Quota Tracking)
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
    status VARCHAR(50) DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'contacted', 'interested', 'not_interested', 'invalid', 'converted_to_lead')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_db_businesses_assigned ON db_businesses(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_db_businesses_status ON db_businesses(status);

CREATE TABLE IF NOT EXISTS db_pipeline_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    requested_city VARCHAR(100),
    requested_type VARCHAR(100),
    batch_size INT DEFAULT 25,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fulfilled_at TIMESTAMP WITH TIME ZONE
);
