# Schoolites CRM - High-Level Developer Guide & Technical Architecture

## 1. Executive Summary & Architecture Overview

**Schoolites** is an enterprise-grade B2B Customer Relationship Management (CRM) and multi-actor business development portal engineered for educational ERP and software sales. The platform coordinates a multi-tiered sales force comprising **Root Administrators**, **Pre-Sales Representatives**, **Referral Partners**, **Affiliate Promoters**, and **Business Relations Closers**.

### Core Architecture Highlights
* **Full-Stack Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript) utilizing Turbopack and React Server Components with selective Client Components for interactive workspaces.
* **Serverless Relational Database**: [Neon Serverless PostgreSQL](https://neon.tech) via HTTP-based stateless connection pooling (`@neondatabase/serverless`), maintaining complete compatibility with Neon's "scale-to-zero" cost optimization.
* **Cloud Object Storage**: S3-compatible Neon Object Storage (`storage-bucket`) for marketing collateral (PDF brochures, high-res carousel images, video assets) with automated garbage collection.
* **Stateless Authentication**: Custom HMAC-signed JWT session cookies with 6-digit numeric One-Time Passwords (OTP) and role-based route/API middleware guards.
* **Zero-Compute Pipeline Synchronization**: Native browser-level tripartite auto-sync (`usePipelineAutoSync`) listening to window focus, document visibility, and adaptive in-view intervals, avoiding continuous WebSocket server costs.
* **Prospecting & Ingestion Engine**: Google Places API (New) integration with field masking, paired with a resilient, format-agnostic CSV/TSV importer.

---

## 2. Directory Structure & Code Organization

```
schoolites/
├── docs/                               # System documentation & manuals
│   ├── DEVELOPER_GUIDE.md              # Technical architecture & engineering reference
│   └── USER_MANUAL.md                 # Role-by-role operational user guide
├── public/                             # Static branding assets, favicons, logos
├── src/
│   ├── app/                            # Next.js App Router endpoints & page layouts
│   │   ├── admin/                      # Admin control center
│   │   │   ├── business/page.tsx       # Executive contract book & revenue splits
│   │   │   ├── database/page.tsx       # Central Places DB, batch allocation & Google API
│   │   │   ├── forms/page.tsx          # Dynamic form field configurator
│   │   │   ├── incentives/page.tsx     # Historical incentive governance
│   │   │   ├── leads/page.tsx          # Master lead pipeline & duplicate resolution
│   │   │   ├── logs/page.tsx           # Immutable audit & compliance logs
│   │   │   ├── marketing/page.tsx      # Marketing collateral upload & storage hub
│   │   │   ├── users/                  # User accounts, commission rates & payout clearances
│   │   │   └── layout.tsx              # Root admin shell layout with Suspense boundaries
│   │   ├── api/                        # Backend REST endpoints
│   │   │   ├── admin/                  # Admin-only operations (users, places, forms, assets)
│   │   │   ├── auth/                   # Session auth, OTP generation & verification
│   │   │   ├── business/               # Revenue metrics & contract queries
│   │   │   ├── database/               # Actor Places DB endpoints & quota requests
│   │   │   ├── enquiries/              # Inbound enquiry capture & qualification
│   │   │   └── leads/                  # Lead CRUD, atomic claiming, notes & contracts
│   │   ├── business/page.tsx           # Business Relations workspace (Pipeline & Sourcing)
│   │   ├── database/page.tsx           # Redirector to role-specific database views
│   │   ├── e/[code]/page.tsx           # Public dynamic enquiry capture landing pages
│   │   ├── presales/page.tsx           # Pre-Sales partner workspace
│   │   ├── promoter/page.tsx           # Affiliate Promoter marketing & enquiry workspace
│   │   ├── referral/page.tsx           # Referral Partner workspace
│   │   ├── login/page.tsx              # OTP login interface
│   │   ├── layout.tsx                  # Root layout & HTML shell
│   │   └── page.tsx                    # Authentication router & role redirector
│   ├── components/                     # Reusable React components & modals
│   │   ├── ActorDatabaseWorkspace.tsx  # Prospect calling engine, caller drawer & convert
│   │   ├── ActorShell.tsx              # Universal desktop & off-canvas mobile layout
│   │   ├── CreateLeadModal.tsx         # Unified Lead Creation & Editing modal (25 fields)
│   │   ├── LeadDetailModal.tsx         # Deep inspection drawer, notes & contract tabs
│   │   ├── LeadTableControls.tsx       # Enterprise table search, multi-status filter & sort
│   │   └── PartnerWorkspace.tsx        # Reusable workspace for Pre-Sales & Referral
│   ├── lib/                            # Shared utilities, database queries & business logic
│   │   ├── auth.ts                     # JWT signing, cookie verification & session guards
│   │   ├── countries.ts                # ISO 3166-1 alpha-2 country dictionary (248 regions)
│   │   ├── db.ts                       # Neon PostgreSQL pooled client
│   │   ├── leadStatuses.ts             # 11-stage canonical lifecycle & color tokens
│   │   ├── payouts.ts                  # 3-tier commission calculations & UTR ledger sync
│   │   ├── storage.ts                  # S3 storage bucket client & cleanup routines
│   │   └── usePipelineAutoSync.ts      # Zero-compute browser auto-sync hook
│   └── scripts/                        # Automated database migrations & test suites
│       ├── migrate-lead-statuses.ts    # Lead status enum migration script
│       ├── test-database-places.ts     # 10-phase Places DB integration test suite
│       └── test-payouts-and-audit.ts   # Payout calculation & audit log test suite
├── PROJECT_SPEC.md                     # Complete living project specification
└── package.json                        # Project dependencies & scripts
```

---

## 3. Database Schema & Entity Relationships

The relational architecture is deployed on Neon PostgreSQL. Below is the relational structure of all core entities:

```mermaid
erDiagram
    users ||--o{ enquiries : "sources (promoter/rep)"
    users ||--o{ leads : "originated (owner)"
    users ||--o{ leads : "manages (manager)"
    users ||--o{ db_businesses : "assigned outreach"
    users ||--o{ db_pipeline_requests : "requests batches"
    users ||--o{ actor_commission_payouts : "earns shares"
    
    leads ||--o| lead_contracts : "has agreement"
    lead_contracts ||--o{ contract_invoices : "installment schedule"
    contract_invoices ||--o{ actor_commission_payouts : "milestone split"
    
    leads ||--o{ lead_notes : "contains remarks"
    db_businesses ||--o{ db_place_history : "tracks transitions"
    leads ||--o| db_businesses : "converted from prospect"
```

### Key Table Definitions & Integrity Constraints

#### 1. `users` Table
Stores authentication credentials, actor roles, commission rates, and module privileges.
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
* `code VARCHAR(20) UNIQUE NOT NULL` (e.g., `ADM-101`, `PS-102`, `REF-103`, `BR-104`, `PM-105`)
* `role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'pre_sales', 'referral', 'business_relations', 'promoter'))`
* `commission_rate NUMERIC(5, 2) DEFAULT 10.00` (Default commission percentage)
* `has_database_access BOOLEAN NOT NULL DEFAULT FALSE` (Places DB access toggle)
* `status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deactivated'))`

#### 2. `leads` Table
Primary B2B pipeline opportunity entity tracking 25 qualification attributes.
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
* `lead_code VARCHAR(50) UNIQUE NOT NULL` (Sequential identifier: `LD-1001`)
* `owner_id UUID NOT NULL REFERENCES users(id)` (The originator across any team)
* `manager_id UUID REFERENCES users(id)` (The assigned BR closer; `NULL` when unassigned)
* `promoter_id UUID REFERENCES users(id)` (Optional affiliate attribution)
* `status VARCHAR(50) NOT NULL DEFAULT 'unassigned'`
  * Valid stages: `'unassigned'`, `'assigned'`, `'demo_scheduled'`, `'demo_completed'`, `'in_discussion'`, `'following_up'`, `'proposal_sent'`, `'onboarding_initiated'`, `'onboarding_completed'`, `'won'`, `'lost'`.
* `institution_name VARCHAR(255) NOT NULL`, `institution_type VARCHAR(100)`, `country VARCHAR(100) DEFAULT 'India'`, `city VARCHAR(100)`
* `student_strength VARCHAR(50)`, `current_erp VARCHAR(100)`, `existing_erp_name VARCHAR(100)`
* `spoc_name VARCHAR(150)`, `spoc_phone VARCHAR(50)`, `spoc_email VARCHAR(150)`, `spoc_role VARCHAR(100)`
* `dm_name VARCHAR(150)`, `dm_phone VARCHAR(50)`, `dm_email VARCHAR(150)`, `dm_role VARCHAR(100)`
* `preferred_slot_date DATE`, `preferred_slot_time VARCHAR(20)`, `preferred_slot_mode VARCHAR(50)`
* `expected_start_date VARCHAR(100)`, `decision_flow TEXT`, `additional_details TEXT`
* `deal_value NUMERIC(14, 2) DEFAULT 0.00`
* `duplicate_flag BOOLEAN DEFAULT FALSE`, `source_enquiry_id UUID REFERENCES enquiries(id)`

#### 3. `lead_contracts` & `contract_invoices` Tables
Financial ledger tracking client contracts and installment invoices.
* `lead_contracts`: `lead_id UUID UNIQUE REFERENCES leads(id)`, `contract_amount NUMERIC(14, 2)`, `start_date DATE`, `end_date DATE`, `status VARCHAR(50)` (`active`, `completed`, `terminated`), **`promoter_rate NUMERIC(5, 2)`**, **`owner_rate NUMERIC(5, 2)`**, **`manager_rate NUMERIC(5, 2)`** (Snapshotted commission rates).
* `contract_invoices`: `contract_id UUID REFERENCES lead_contracts(id)`, `invoice_number VARCHAR(100)`, `amount NUMERIC(14, 2)`, `due_date DATE`, `status VARCHAR(50)` (`raised`, `pending`, `cleared`), `cleared_at TIMESTAMP`, `payment_method VARCHAR(100)`, `payment_reference VARCHAR(100)` (NEFT/UPI UTR).

#### 4. `actor_commission_payouts` Table
Individual member commission shares derived from invoice milestones.
* `invoice_id UUID REFERENCES contract_invoices(id) ON DELETE CASCADE`
* `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
* `actor_role VARCHAR(50)` (`promoter`, `owner`, `manager`)
* `commission_rate NUMERIC(5, 2)`, `invoice_amount NUMERIC(14, 2)`, `payout_amount NUMERIC(14, 2)`
* `invoice_status VARCHAR(50)` (`cleared`, `pending`, `raised`), `payout_status VARCHAR(50) DEFAULT 'pending'` (`pending`, `paid`)
* `paid_at TIMESTAMP`, `payment_reference VARCHAR(100)` (Disbursement UTR)
* `UNIQUE (invoice_id, user_id, actor_role)`

#### 5. `db_businesses` (Places Repository)
Prospects discovered via Google Places API New or CSV/TSV bulk import.
* `place_id VARCHAR(255) UNIQUE NOT NULL` (Google Place ID or unique hash)
* `name VARCHAR(255) NOT NULL`, `primary_phone VARCHAR(100)`, `alternative_phone VARCHAR(100)`
* `website TEXT`, `maps_url TEXT`, `rating NUMERIC(3, 2)`, `rating_count INT`
* `formatted_address TEXT`, `street_address TEXT`, `area VARCHAR(150)`, `city VARCHAR(100)`, `state VARCHAR(100)`, `postal_code VARCHAR(50)`, `country VARCHAR(100) DEFAULT 'India'`
* `business_status VARCHAR(50) DEFAULT 'OPERATIONAL'`, `search_keyword VARCHAR(255)`, `search_city VARCHAR(100)`
* `status VARCHAR(50) DEFAULT 'fresh'` (`fresh`, `new`, `rnr`, `switched_off`, `interested`, `contact_later`, `following_up`, `not_interested`, `converted_to_lead`)
* `assigned_to_user_id UUID REFERENCES users(id)`, `assigned_at TIMESTAMP`, `assigned_by UUID REFERENCES users(id)`
* `last_contacted_at TIMESTAMP`, `callback_at TIMESTAMP`, `notes TEXT`, `converted_lead_id UUID REFERENCES leads(id)`

---

## 4. Core Business Logic & Architectural Algorithms

### 4.1 3-Tier Split Logic & Closer Priority Rule
When a deal closes (`Won`), the platform executes commission calculations defined in [src/lib/payouts.ts](file:///c:/Users/91725/schoolites/src/lib/payouts.ts):
1. **Snapshotted Rates**: The moment a contract is created or updated upon reaching `Won`, the active `commission_rate` values for the Promoter (`promoter_id`), Lead Owner (`owner_id`), and Lead Manager (`manager_id`) are permanently snapshotted into `lead_contracts`. Future profile rate changes never mutate closed deals.
2. **Closer Priority Rule (Anti-Double-Dipping)**:
   $$\text{If } \text{owner\_id} == \text{manager\_id} \implies \text{owner\_rate} = 0.00\% \text{ and } \text{manager\_rate} = \text{snapshotted Closer Rate (10\%)}$$
   If a Business Relations rep self-sources a deal and closes it, their compensation is solely as the Closer. They cannot claim both Owner (10%) and Closer (10%) shares.
3. **Cash Realization Rule**: Commission payouts only advance to `payout_status = 'pending'` (ready for admin disbursement) when the underlying client invoice transitions to `cleared` with verified bank funds. Payouts are never disbursed against uncollected receivables.

### 4.2 Atomic Lead Claiming ("Grab")
To prevent race conditions when multiple Business Relations reps browse the Unassigned Leads Pool:
```sql
UPDATE leads
SET manager_id = $1, status = 'assigned', updated_at = NOW()
WHERE id = $2 AND manager_id IS NULL
RETURNING *;
```
If two representatives click "Grab" concurrently, the database locks the row on the first commit. The second transaction matches 0 rows and returns `HTTP 409 Conflict`, prompting the UI to alert the rep that the lead has already been claimed.

### 4.3 Stage Governance & Lead Manager Synchronization
Lead assignments and status transitions are strictly governed in `PATCH /api/leads/[id]`:
* **Exiting the Unassigned Pool**: Moving a lead from `unassigned` into any active pipeline stage (`assigned`, `demo_scheduled`, etc.) requires a selected Lead Manager. The endpoint updates both `status` and `manager_id` atomically.
* **Returning to Unassigned**: Setting status to `unassigned` automatically nullifies `manager_id = NULL` and returns the lead to the shared pool.
* **Private Notes Handover**: Internal notes written by previous BR managers remain preserved. When a lead is reassigned, the new manager automatically receives read access to historical handover notes with attribution chips. External partners (Pre-Sales/Referral) never receive access to internal BR notes.

### 4.4 Places Database Allocation Engine
Prospect distribution follows a two-tier queue:
* **Threshold Rule**: An outreach actor can submit a batch request (`POST /api/database`) if and only if their unworked queue (`status = 'new'`) has $\le 10$ records remaining.
* **Admin Allocation Modes**:
  1. *1-Click Auto Fulfill*: Automatically assigns top $N$ fresh records matching the actor's requested city.
  2. *Visual Select & Allocate*: Pre-filters the Fresh Pool by the requested city, engages an allocation ribbon with live counter and `Auto-Select Top N`, and confirms allocation via `PATCH /api/admin/places/requests`.
* **Lead Conversion Attribution**: Clicking "Convert to Lead ↗" initializes [CreateLeadModal.tsx](file:///c:/Users/91725/schoolites/src/components/CreateLeadModal.tsx) with school name, city, and phone. Upon submission, the prospect record is marked `converted_to_lead` with `converted_lead_id` linked, and the outreach actor is recorded as the `owner_id`.

---

## 5. Security & Authentication Architecture

* **Stateless Session Cookies**: JWTs signed with `JWT_SECRET` stored in `httpOnly`, `SameSite=Lax`, `secure` (in production) cookies.
* **OTP Verification**: Eliminates password-related vulnerabilities. 6-digit OTPs are generated and validated against short-lived expirations. (In local development, `DEV_AUTO_OTP=123456` enables rapid developer testing).
* **Role-Based Guards**:
  * Every API route verifies the session user and role via `getSessionUser()`.
  * External actors (Promoters) querying `/api/leads` receive masked contact details (`spoc_phone: '987*****21'`) to prevent client disintermediation. Direct requests to `/api/leads/[id]` from unauthorized roles return `403 Forbidden`.
* **API Key Protection**: Server-side consumption only. The Google Places API Key is accessed exclusively within `src/app/api/admin/places/search-api/route.ts` via `process.env.GOOGLE_PLACES_API_KEY`. It is never exposed in client bundles or public endpoints.

---

## 6. Environment Configuration Reference

The application requires the following environment variables (defined in `.env.local` for local execution, or set in production deployment environments):

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL pooled connection URI | **Yes** | `postgresql://user:pass@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | 32+ character cryptographic secret for session JWTs | **Yes** | `f6a8b29c4d1e0...` |
| `GOOGLE_PLACES_API_KEY` | Google Places API (New) enabled Cloud API key | Optional | `AIzaSyAiMVW...` |
| `STORAGE_BUCKET` | Neon S3-compatible bucket name for asset uploads | Optional | `storage-bucket` |
| `STORAGE_REGION` | Object storage region | Optional | `ap-southeast-1` |
| `STORAGE_ENDPOINT` | Object storage custom endpoint URI | Optional | `https://s3.ap-southeast-1.amazonaws.com` |
| `STORAGE_ACCESS_KEY` | S3 API Access Key ID | Optional | `AKIA...` |
| `STORAGE_SECRET_KEY` | S3 API Secret Access Key | Optional | `wJalrXUtnFEMI...` |
| `DEV_AUTO_OTP` | Local development bypass OTP | Dev Only | `123456` |

---

## 7. Build, Verification & Testing Routines

### 1. Build Verification
Execute production bundle compilation:
```bash
npm run build
```
*Next.js 16 Compatibility Note*: All routes utilize dynamic data fetching under `cacheComponents: true`. Ensure route files do not specify incompatible legacy directives like `export const dynamic = 'force-dynamic'`.

### 2. Type Safety Audit
Validate TypeScript types across the complete codebase:
```bash
npx tsc --noEmit
```

### 3. Automated Test Suites
Run standalone integration test scripts using `tsx`:
```bash
# Test Places Database ingestion, allocation & lifecycle
npx tsx src/scripts/test-database-places.ts

# Test 3-tier commission payout calculations & audit logging
npx tsx src/scripts/test-payouts-and-audit.ts
```
