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
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'pre_sales', 'referral', 'business_relations', 'promoter')),
    commission_rate NUMERIC(5, 2) DEFAULT 10.00,
    date_of_joining DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    has_database_access BOOLEAN NOT NULL DEFAULT FALSE,
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

-- 6. Enquiries Table (Attributed to User Code / Owner / Promoter)
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_code VARCHAR(32) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    promoter_id UUID REFERENCES users(id),
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
CREATE INDEX IF NOT EXISTS idx_enquiries_promoter ON enquiries(promoter_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_phone ON enquiries(phone);

-- 7. Leads Table (Core Pipeline)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(32) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    promoter_id UUID REFERENCES users(id),
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
    expected_start_date VARCHAR(100),
    additional_details TEXT,
    
    -- Status & Valuation
    status VARCHAR(50) DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'demo_scheduled', 'demo_completed', 'in_discussion', 'following_up', 'proposal_sent', 'onboarding_initiated', 'onboarding_completed', 'won', 'lost')),
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
    role VARCHAR(50) UNIQUE NOT NULL CHECK (role IN ('pre_sales', 'referral', 'business_relations', 'promoter')),
    default_rate_percent NUMERIC(5, 2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Payout Ledgers (Incentives & Commissions)
CREATE TABLE IF NOT EXISTS payout_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('pre_sales', 'referral', 'business_relations', 'promoter')),
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

-- 13. Places Database Pipeline & Outreach Tracking
CREATE TABLE IF NOT EXISTS db_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(100),
    alternative_phone VARCHAR(100),
    website TEXT,
    maps_url TEXT,
    rating NUMERIC(3, 2),
    rating_count INT DEFAULT 0,
    primary_type VARCHAR(100),
    type_tags JSONB DEFAULT '[]'::jsonb,
    formatted_address TEXT,
    street_address TEXT,
    area VARCHAR(150),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(100) DEFAULT 'India',
    business_status VARCHAR(50) DEFAULT 'OPERATIONAL',
    regular_opening_hours JSONB DEFAULT '{}'::jsonb,
    search_keyword VARCHAR(255),
    search_city VARCHAR(100),
    search_area VARCHAR(150),
    status VARCHAR(50) DEFAULT 'fresh',
    assigned_to_user_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES users(id),
    assigned_batch_id UUID,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    callback_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    converted_lead_id UUID REFERENCES leads(id),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_db_businesses_place_id ON db_businesses(place_id);
CREATE INDEX IF NOT EXISTS idx_db_businesses_assigned ON db_businesses(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_db_businesses_status ON db_businesses(status);
CREATE INDEX IF NOT EXISTS idx_db_businesses_city ON db_businesses(city);

-- Full Audit Trail per Place
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

-- Data Quota Requests from Actors (triggered when unworked <= 10)
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

-- 14. Lead Contracts (Client Accounts)
CREATE TABLE IF NOT EXISTS lead_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    contract_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    duration_months INT DEFAULT 12,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'renewed')),
    notes TEXT,
    promoter_rate NUMERIC(5, 2),
    owner_rate NUMERIC(5, 2),
    manager_rate NUMERIC(5, 2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_contracts_lead ON lead_contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_contracts_status ON lead_contracts(status);

-- 15. Contract Invoices (Milestone & Partial Payments)
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

