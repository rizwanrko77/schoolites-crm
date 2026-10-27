# Schoolites CRM - Enterprise Educational ERP Sales Engine

Schoolites is a production-grade, multi-actor B2B Customer Relationship Management (CRM) and business development portal engineered for educational ERP software sales targeting schools, colleges, and educational institutions.

---

## 📚 Documentation Directory

Complete system documentation is available in the [`docs/`](docs) directory:

1. **[Deployment (`docs/DEPLOYMENT.md`)](docs/DEPLOYMENT.md)**:
   - Production environment variables, first-time database init, and how to run the Node app beside the PHP ERP.

2. **[Developer Guide (`docs/DEVELOPER_GUIDE.md`)](docs/DEVELOPER_GUIDE.md)**:
   - Full-stack technical architecture (Next.js 16 App Router, React 19, TypeScript, Neon Serverless PostgreSQL, S3 Object Storage).
   - Relational database schema, ER diagram, foreign keys, and integrity constraints.
   - Core algorithmic logic: 3-tier commission split engine, closer priority rule, atomic lead grabbing (`HTTP 409`), stage governance, and zero-compute browser auto-sync.
   - Google Places API (New) integration, CSV/TSV bulk ingestion, and quota allocation engine.
   - Security, stateless OTP authentication, and environment configuration.
   - Build commands and automated test suites.

3. **[User Manual for All Actors (`docs/USER_MANUAL.md`)](docs/USER_MANUAL.md)**:
   - Comprehensive, role-by-role operating instructions.
   - **Root Administrator (`ADM-xxx`)**: User governance, form configurator, central places database, marketing hub, and UTR payout clearances.
   - **Pre-Sales Representative (`PS-xxx`)**: Places calling engine ("New Data" unworked queue, outcome logging, quota requests $\le 10$), promoter pool qualification, and 1-click lead conversion.
   - **Referral Partner (`REF-xxx`)**: Dedicated referral hub, unique public links (`/e/REF-xxx`), and 20% commission tracking.
   - **Business Relations Closer (`BR-xxx`)**: Atomic lead claiming from unassigned pool, 11-stage pipeline management, dual-tier notes & handover history, client contracts, and milestone invoicing.
   - **Affiliate Promoter (`PM-xxx`)**: Marketing links (`/e/PM-xxx`), asset collateral hub (multi-image carousels, videos, pitch text), masked enquiry tracking, and 10% affiliate shares.
   - Role Permission Matrix and Canonical Terminology Glossary.

---

## 🚀 Quick Start for Developers

### Prerequisites
* Node.js 18+ or 20+
* Neon PostgreSQL connection string (`DATABASE_URL`)

### Installation & Local Run
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Set DATABASE_URL. For production email and storage, see docs/DEPLOYMENT.md.

# 3. Start local development server
npm run dev
```

### Verification & Testing
```bash
# Type safety check
npx tsc --noEmit

# Production build
npm run build

# Integration tests
npx tsx src/scripts/test-connection.ts
npx tsx src/scripts/test-database-places.ts
```

---

## 🔗 Repository Upstream & Dual-Sync
- **Bitbucket Remote**: `git@bitbucket.org:TeamFriends/schoolites-leads.git`
- **GitHub Remote**: `https://github.com/rizwanrko77/schoolites-crm.git`
- **Dual-Push Configuration**: Both `bitbucket` and `origin` remotes are configured with dual push URLs. Running `git push` automatically synchronizes changes across both Bitbucket and GitHub simultaneously.

