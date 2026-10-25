# Schoolites CRM - Comprehensive User Manual for All Actors

Welcome to **Schoolites**, the enterprise sales coordination portal for educational software and ERP solutions. This manual provides detailed, step-by-step operating instructions tailored for every actor role across the platform.

---

## Quick Navigation by Role

1. [Common Platform Mechanics & Interface Basics](#1-common-platform-mechanics--interface-basics)
2. [Actor 1: Root Administrator (`ADM-xxx`)](#actor-1-root-administrator-adm-xxx)
3. [Actor 2: Pre-Sales Representative (`PS-xxx`)](#actor-2-pre-sales-representative-ps-xxx)
4. [Actor 3: Referral Partner (`REF-xxx`)](#actor-3-referral-partner-ref-xxx)
5. [Actor 4: Business Relations Closer (`BR-xxx`)](#actor-4-business-relations-closer-br-xxx)
6. [Actor 5: Affiliate Promoter (`PM-xxx`)](#actor-5-affiliate-promoter-pm-xxx)
7. [Glossary & Role Permission Matrix](#7-glossary--role-permission-matrix)

---

## 1. Common Platform Mechanics & Interface Basics

### 1.1 Secure Login via OTP
* Navigate to the login portal (e.g. `http://localhost:3000/login` or your deployment domain).
* Enter your registered corporate email address and click **Send Verification Code**.
* Check your email for the 6-digit One-Time Password (OTP). Enter the code across the 6 input boxes. The system verifies your code and routes you directly to your role's specialized workspace. On a developer machine with no email configured, the code is shown on the login screen instead.

### 1.2 Enterprise Navigation Shell
* **Collapsible Desktop Rail**: Click the toggle arrow at the top-right of the sidebar to collapse the navigation into a sleek 72px icon rail, giving your tables and forms maximum horizontal canvas. Click again to expand back to the full 260px view.
* **Mobile Off-Canvas Drawer**: On mobile or tablet devices ($\le 768px$), tap the hamburger menu (`☰`) in the header to open the slide-out navigation. Tapping any link or the dark backdrop automatically closes the drawer.
* **My Account Profile**: Click your avatar or code badge in the top-right header to view your active role, commission rate, database access status, or to securely log out.
* **Zero-Compute Auto-Sync**: The platform keeps your data live without battery drain. Whenever you switch back to the CRM browser tab or un-minimize your window, the system automatically refreshes your pipeline.

---

## Actor 1: Root Administrator (`ADM-xxx`)

The Root Administrator exercises complete operational oversight over company users, lead pipelines, form configurations, marketing collateral, places data pools, and financial settlements.

### 2.1 User Management (`/admin/users`)
* **Creating a New User**:
  1. Click **+ Add User** in the top-right corner.
  2. Enter the member's full name, corporate email address, and select their role (`Pre-Sales`, `Referral Partner`, `Business Relations`, `Promoter`, or `Admin`).
  3. **Commission Setting**: Choose **Role Default %** (e.g., 10% for PS/BR, 20% for Referral) or select **Custom %** to specify an agreed rate.
  4. **Database Access Toggle**: Turn on `Enable Places Database Access` if this team member is participating in cold outreach prospecting.
  5. Click **Create User**. The system automatically generates their sequential identifier (e.g., `PS-108`).
* **Editing Profiles & Commission Adjustments**:
  1. Click the member row or **View Profile**.
  2. Click **✏️ Edit Profile & Incentive Settings** to modify their name, status (`active` vs `deactivated`), commission percentage, or database access.
  3. All rate adjustments are immutably logged in the audit trail.
* **Commission Payout Clearances (`/admin/users/[id]`)**:
  1. Open the member's profile and switch to the **Commission Payouts** tab.
  2. Review the 4 metric cards: *Total Contract Potential*, *Eligible Earned (Cleared)*, *Disbursed (Paid)*, and *Pending Admin Transfer*.
  3. When an invoice has cleared and you have disbursed funds via NEFT/UPI, click **Mark Paid** on the milestone share.
  4. Enter the Payment Method, Payment Date, and Bank UTR Reference Number, then confirm.

### 2.2 Central Places Database & Batch Allocation (`/admin/database`)
The Places Database module allows administrators to stage millions of potential educational institutions and distribute curated batches to calling representatives.

* **Method 1: Search via Google Places API (New)**:
  1. In the **Google Places API** tab, choose the target **Country** from the searchable dropdown (defaults to India).
  2. Enter the Search City (e.g., `Pune`) and Search Keyword (e.g., `CBSE High School`).
  3. Click **Execute Search**. The system queries Google Places with strict field masking and automatically filters out permanently closed schools and entries lacking telephone numbers.
* **Method 2: Google Apps Script / CSV Import**:
  1. Switch to the **Import Data** tab.
  2. Either upload a `.csv` / `.tsv` file or copy-paste raw rows directly into the textarea.
  3. The importer supports any column order and automatically parses the 24 standard headers (`place_id`, `institution_name`, `primary_phone`, `city`, `state`, `website`, etc.). Duplicate `place_id` records are safely ignored without overwriting ongoing rep outreach.
* **Fulfilling Quota Requests from Calling Reps**:
  * In the **Requests Queue** tab, review incoming requests from reps who have worked down their uncalled records ($\le 10$ remaining).
  * **Option A (1-Click Auto Fulfill)**: Click **⚡ 1-Click Fulfill (N)**. The system automatically assigns $N$ fresh records matching the rep's preferred city.
  * **Option B (Visual Select & Allocate)**:
    1. Click **🎯 Select & Allocate**. The platform redirects you to the **Fresh Pool** with the requested city pre-filtered and opens a sticky allocation ribbon.
    2. Click **Auto-Select Top N** to quickly grab the requested count, or manually tick individual school checkboxes.
    3. Click **Confirm Allocation (N)**. The selected records are instantly transferred into the representative's "New Data" queue.
  * **Declining a Request**: Click the `✕` button to reject an invalid request with confirmation.

### 2.3 Master Lead Pipeline & Governance (`/admin/leads`)
* View all company leads across all stages.
* **Full-Field Search & Multi-Status Filtering**: Filter by any keyword across 25 fields (school name, city, ERP brand, contact name) or select stage combinations using the multi-stage popover.
* **Duplicate Detection**: Leads sharing duplicate phone or email contacts are automatically flagged with an amber badge (`⚠️ DUPLICATE`). Click **Resolve Duplicate** to inspect colliding leads and merge or clear flags.
* **Lead Inspection & Reassignment**: Click any row to open the complete lead drawer. Admins can edit details, change stages (with governance confirmation), or reassign the Lead Manager.

### 2.4 Contracts, Invoices & Pipeline Revenue (`/admin/business`)
* View company-wide executive KPIs: *Total Contract Value*, *Total Invoiced*, *Cleared Cash Collected*, *Pending Receivables*, and *Unbilled Pipeline Scope*.
* Inspect deals won by Business Relations and verify client installment schedules and 3-tier commission allocations.

### 2.5 Dynamic Form Configurator (`/admin/forms`)
* Modify which fields are **Required**, **Optional**, or **Hidden** on public enquiry forms (`/e/[code]`) and lead qualification forms without requiring code deployments or server restarts.

### 2.6 Marketing Asset Hub (`/admin/marketing`)
* Upload promotional collateral for the sales force:
  * **Images & Multi-Image Carousels**: Upload up to 10 images per asset card.
  * **PDF Brochures**: Upload presentation decks or feature overviews.
  * **Video Links**: Paste YouTube/Vimeo links.
  * **Pitch Copy Scripts**: Provide WhatsApp templates and phone call scripts.

### 2.7 Audit Logs (`/admin/logs`)
* Inspect an immutable, reverse-chronological ledger of every login, status transition, lead assignment, and administrative action with actor attribution and field-level diffs (`old_value ➔ new_value`).

---

## Actor 2: Pre-Sales Representative (`PS-xxx`)

Pre-Sales representatives drive outbound prospect qualification, work cold data batches, handle inbound marketing enquiries, and convert qualified institutions into active pipeline leads.

### 3.1 Your Unique Marketing Link
* At the top of your workspace, find your personalized referral link:
  `https://yourdomain.com/e/PS-xxx`
* Click **📋 Copy Link** to share via WhatsApp, email, or social campaigns. Any school submitting an enquiry through this link will appear directly in your **Inbound Enquiries** queue with full attribution.

### 3.2 Places Database Calling Engine (`?tab=database`)
*(Visible if your account has been granted Database Access by Admin).*
* **Tab 1: "New Data" (Unworked Queue)**:
  * Contains fresh institutional prospects allocated to you by Admin.
  * For each prospect card, review the school name, phone number, city, rating, and address.
  * Click the telephone icon to initiate your call.
  * **Logging Call Outcomes**: Immediately update the status dropdown:
    * `RNR`: Ringing No Response.
    * `Switched Off`: Unreachable network.
    * `Interested`: High potential prospect.
    * `Contact Later`: Schedule a specific callback date and time.
    * `Following Up`: Ongoing dialogue.
    * `Not Interested`: Institution rejected outreach.
  * Any status update automatically moves the prospect into your **Assigned Database** pipeline tab, keeping your "New Data" queue focused on uncalled schools.
  * **Requesting New Batches**: When your remaining uncalled records reach **10 or fewer**, a prominent alert activates: **⚡ Request More Data**. Click the button, specify your preferred city and requested batch size, and submit.
* **Tab 2: "Assigned Database" (Outreach Pipeline)**:
  * Tracks every school you have contacted, filtered by outcome.
  * Use the search bar to locate specific schools or callback dates.
* **Inspecting Prospects & Converting to Lead**:
  * Click **🔍 Inspect** on any card to slide out the metadata drawer (full address, rating count, website, Google Maps link, and chronological notes history).
  * When a school expresses genuine interest in adopting Schoolites ERP, click **Convert to Lead ↗**.
  * The system opens the Lead Creation modal with the school name, phone, and city pre-filled. Enter the SPOC and Decision Maker info, then click **Submit Lead to Pipeline**.
  * The prospect is tagged `converted_to_lead` with your new Lead Code (`[LD-xxxx]`), and you are permanently attributed as the **Lead Owner** (eligible for your 10% commission upon closure).

### 3.3 Inbound Enquiries & Shared Promoter Pool
* **Direct Inbound**: Enquiries submitted on your `/e/PS-xxx` link appear in your queue. Call the contact person, qualify their requirements, and click **Convert to Lead**.
* **Promoter Enquiries Pool**: Browse unassigned enquiries generated by Affiliate Promoters. Click **Claim & Convert** to verify the school and originate a company lead.

### 3.4 Direct Lead Creation
* Click **+ Create Lead** in the header to enter an opportunity directly.
* Complete the 3-section form: *Institution Info*, *Contact Information* (SPOC, Decision Maker, ERP Head), and *Decision Flow & Preferred Connect Slot*.
* *Draft Persistence*: In-progress form entries are automatically saved to your browser. If you close the modal accidentally, reopening it restores your draft. Click **Clear Form** if you wish to reset.

### 3.5 Tracking Earnings (`?tab=business`)
* View all your self-created leads that have been closed as `Won` by the Business Relations team.
* Track your earned 10% originator rewards across cleared client cash collections and pending invoice installments.

---

## Actor 3: Referral Partner (`REF-xxx`)

Referral Partners are external trusted advisors, education consultants, or partners who introduce client schools to Schoolites.

### 4.1 Partner Workspace & Outreach
* **Personal Referral Link**: Share your unique link (`/e/REF-xxx`) with school trustees, directors, and principals.
* **Submitting a Direct Referral**: Click **+ Submit Referral Lead** to pass qualified school contacts directly to our Business Relations team.

### 4.2 Inbound Enquiries Tracking
* Monitor inbound submissions received through your link. Once qualified, click **Convert to Lead** to submit them into the pipeline.

### 4.3 Commission Ledger & Rewards (`?tab=business`)
* Referral Partners earn an agreed **20% commission** on closed business.
* Switch to the **Business** tab to track:
  * **Total Potential Rewards**: 20% share of agreed contract values.
  * **Earned Cleared Cash**: Commission funds unlocked as schools clear their invoice payments to Schoolites.
  * **Pending Invoice Commissions**: Commissions that will unlock once the school clears pending installment payments.

---

## Actor 4: Business Relations Closer (`BR-xxx`)

Business Relations representatives are full-cycle closers responsible for claiming leads, conducting product demonstrations, commercial negotiations, signing client contracts, and closing deals.

### 5.1 Section 1: Global Pipeline
* **⚡ Unassigned Pool**:
  * Displays company leads originated by Pre-Sales, Referral Partners, and Inbound Marketing that have not yet been assigned a manager.
  * Review the school size, current ERP brand, and preferred connect slot.
  * Click **⚡ Grab Lead** to claim the opportunity. The system executes an atomic database lock to prevent race conditions. Once claimed, the lead transfers exclusively into your active portfolio.
* **🎯 Assigned to Me**:
  * Your active closing portfolio. Progress deals through the 11-stage sales lifecycle:
    `Assigned ➔ Demo Scheduled ➔ Demo Completed ➔ In Discussion ➔ Following Up ➔ Proposal Sent ➔ Onboarding Initiated ➔ Onboarding Completed ➔ Won 🏆 / Lost ❌`.
  * **Stage Transition Confirmation**: Changing the stage triggers a confirmation modal displaying before-and-after stage chips.
  * **Dual-Tier Notes Architecture**:
    * **Private Notes**: Confidential internal notes only readable by you and system Admins.
    * **Global Remarks**: Public updates visible to the originating Pre-Sales rep or Referral Partner to keep them informed on deal progress.
    * **Handover Notes**: If you take over a lead previously worked by another BR rep, their historical notes appear highlighted with an amber handover badge for seamless continuity.
  * **Safe Reassignment**: Need to transfer a lead to another closer? Click **Reassign ⇄**, select an active BR colleague, and confirm. All your historical notes are preserved for their review.
* **🌐 All Leads Directory**: Company-wide view for visibility across all organizational opportunities.

### 5.2 Winning a Deal, Contracts & Milestone Invoicing
* When an institution agrees to purchase Schoolites ERP:
  1. Open the lead details and transition stage to **Won 🏆**.
  2. The **📄 Contract & Invoices** tab activates in the lead drawer.
  3. **Create Client Contract**: Enter the total contract value, contract duration, start date, and end date. Saving automatically snapshots the active commission rates for the Promoter, Lead Owner, and yourself as Lead Manager.
  4. **Raise Milestone Invoices**: Add scheduled installments (e.g. 50% advance upon contract signing, 50% upon deployment completion) with invoice numbers, amounts, and due dates.
  5. As schools pay their invoices, administrators verify bank receipts, mark invoices `cleared`, and record the UTR reference number, unlocking your commission.

### 5.3 Section 2: My Direct Sourcing & Inbound
* **📝 My Generated Leads**: Leads you have personally sourced. Under the **Closer Priority Rule**, if you source and close your own deal, you receive the full 10% closer commission.
* **📥 Inbound Enquiries**: Captures inbound enquiries from your `/e/BR-xxx` referral link.
* **📁 Marketing Assets**: Access corporate pitch decks, WhatsApp copy, and brochures to share during school negotiations.

---

## Actor 5: Affiliate Promoter (`PM-xxx`)

Affiliate Promoters are traffic generators and community advocates who promote Schoolites across educational networks, WhatsApp groups, and social platforms.

### 6.1 Promoter Workspace & Marketing Assets Hub
* **Your Dedicated Marketing Link**:
  `https://yourdomain.com/e/PM-xxx`
  Share this link across your promotional channels.
* **Marketing Collateral Hub**:
  * **Image Carousels**: Swipe through high-resolution banners and flyers. Click **🔍 Zoom** to inspect full-screen or **📥 Download** to save images.
  * **PDF Brochures**: Download official product brochures to attach to your email or social outreach.
  * **Video Links**: Click **▶ Watch** to preview promotional videos or **🔗 Copy Link** to share them.
  * **Pre-Written Pitch Scripts**: Click **📋 Copy Text** on pre-formatted outreach copy and paste directly into WhatsApp or messaging groups.

### 6.2 Tracking Inbound Enquiries
* Switch to the **Inbound Enquiries** tab to see every prospective school that entered through your link.
* To protect client confidentiality and prevent disintermediation, phone numbers and emails are masked (e.g. `987*****21`).
* You can monitor the qualification status as our Pre-Sales team engages them.

### 6.3 Tracking Generated Leads & Commissions (`?tab=business`)
* Once our team qualifies your enquiry into an active lead, it appears in your **Generated Leads** tab with its active pipeline stage.
* **10% Affiliate Commission**: When a lead sourced by your link is closed as `Won`, you earn **10%** of all cleared invoice payments.
* Monitor your earned cleared cash and pending invoice rewards under the **Business** tab.

---

## 7. Glossary & Role Permission Matrix

| Feature / Capability | Admin (`ADM`) | Business Relations (`BR`) | Pre-Sales (`PS`) | Referral Partner (`REF`) | Promoter (`PM`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **User & Commission Governance** | ✅ Full | ❌ None | ❌ None | ❌ None | ❌ None |
| **Dynamic Form Configurator** | ✅ Full | ❌ None | ❌ None | ❌ None | ❌ None |
| **Places DB: Search & CSV Ingestion**| ✅ Full | ❌ None | ❌ None | ❌ None | ❌ None |
| **Places DB: Calling & Outreach** | ✅ Full | ❌ None | ✅ (If enabled)| ✅ (If enabled)| ❌ None |
| **Claim Leads from Unassigned Pool** | ✅ Full | ✅ Full (Atomic Grab)| ❌ None | ❌ None | ❌ None |
| **Progress Pipeline Stages (11 Stages)**| ✅ Full | ✅ (Assigned leads) | ❌ Read Only | ❌ Read Only | ❌ Read Only |
| **Client Contracts & Invoicing** | ✅ Full | ✅ Full | ❌ None | ❌ None | ❌ None |
| **Commission Payout Clearances (UTR)** | ✅ Full | ❌ None | ❌ None | ❌ None | ❌ None |
| **Inbound Enquiries & Link Sharing** | ❌ N/A | ✅ `/e/BR-xxx` | ✅ `/e/PS-xxx` | ✅ `/e/REF-xxx` | ✅ `/e/PM-xxx` |
| **Default Commission Share** | 0% | 10% (Closer) | 10% (Originator)| 20% (Partner) | 10% (Affiliate) |
| **Lead Contact Data Visibility** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 🔒 Masked |
