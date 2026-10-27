'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { COUNTRIES } from '@/lib/countries';

const STUDENT_STRENGTH_OPTIONS = [
  'Below 500',
  '500 - 1000',
  '1000 - 2000',
  '2000 - 3000',
  '3000 - 4000',
  '4000+',
];

interface FormField {
  id: string;
  field_key: string;
  label: string;
  category: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  display_order: number;
}

interface OwnerInfo {
  name: string;
  user_code: string;
  role: string;
}

interface ServiceModule {
  name: string;
  desc: string;
  badge?: string;
}

const ALL_SCHOOLITES_MODULES: ServiceModule[] = [
  {
    name: 'Schoolites Genie [AI Assistant]',
    desc: 'Your intelligent AI assistant that helps answer questions, automate tasks, and provide smart insights for better school management and decision-making.',
    badge: 'Core AI',
  },
  {
    name: 'Transport Management',
    desc: 'Manage school transport routes, track vehicle locations, monitor student pickup/drop-off times, and ensure safe transportation with real-time updates for parents.',
    badge: 'Live GPS',
  },
  {
    name: 'Fee Management',
    desc: 'Easily manage fee collection, receipts, and pending dues. Automate reminders, track payments, and generate detailed reports for transparent financial management.',
  },
  {
    name: 'Admission Management',
    desc: 'Streamline your admission process with online applications, document verification, and automated workflows. Make enrollments faster and hassle-free.',
  },
  {
    name: 'Expense Management',
    desc: 'Track and manage all school expenses efficiently. Monitor budgets, approve expenditures, and generate detailed financial reports for better cost control.',
  },
  {
    name: 'Attendance Management',
    desc: 'Track daily student and staff attendance with accuracy. AI-powered analytics highlight irregularities and help teachers take timely action.',
  },
  {
    name: 'Date Sheet Management',
    desc: 'Design and share exam timetables effortlessly. Ensure conflict-free scheduling so students and teachers stay stress-free during exams.',
  },
  {
    name: 'Dashboard',
    desc: 'A central hub with a quick view of important activities like attendance, fees, and student progress. Get insights at a glance with smart reports.',
  },
  {
    name: 'Employee / Teacher Management',
    desc: 'Manage staff records, schedules, salaries, and responsibilities. Simplify HR-related tasks and ensure smooth workforce management.',
  },
  {
    name: 'User Request Management',
    desc: 'Handle parent, student, or teacher requests in one place. Assign, track, and resolve requests quickly for better communication.',
  },
  {
    name: 'Result Management',
    desc: 'Upload, manage, and share exam results online. Generate grade cards instantly and give parents and students easy access to academic performance.',
  },
  {
    name: 'Homework Management',
    desc: 'Teachers can assign, track, and review homework. Students and parents receive instant notifications and reminders for better discipline.',
  },
  {
    name: 'Notice Board',
    desc: 'Publish important notices, updates, and circulars digitally. Ensure every teacher, student, and parent stays informed.',
  },
  {
    name: 'Time Table / Schedules',
    desc: 'Create and manage class schedules without conflicts. Teachers and students get instant updates on their daily routine.',
  },
  {
    name: 'Holiday Calendar',
    desc: 'Display school holidays and events in advance. Keep parents and students updated with automatic alerts for schedule changes.',
  },
  {
    name: 'Messages',
    desc: 'Send instant messages and notifications to teachers, parents, and students. Ensure quick and smooth communication across the school.',
  },
  {
    name: 'Guardian Management',
    desc: 'Keep parent and guardian details organized. Strengthen communication between school and families for better student support.',
  },
  {
    name: 'Student Management',
    desc: 'Manage student records, personal details, academics, and progress in one place. Access complete information with just one click.',
  },
  {
    name: 'UDISE+ Compliance',
    desc: 'Import students with minimum fields, export in UDISE+ format. Automated validation and error checking for hassle-free government data submission.',
    badge: '1-Click Export',
  },
  {
    name: 'Admin Management',
    desc: 'Provide school administrators with tools to manage staff, students, fees, and reports efficiently from a single platform.',
  },
  {
    name: 'Gallery',
    desc: 'Maintain and share school event photos and videos. Create an engaging digital album for parents, students, and staff.',
  },
  {
    name: 'Feedback / Query',
    desc: 'Collect feedback from parents, students, and teachers. Improve communication and take action based on real suggestions.',
  },
  {
    name: 'Admin Settings',
    desc: "Customize the platform according to your school's needs. Manage permissions, security, and configuration easily.",
  },
  {
    name: 'Online Classes',
    desc: 'Seamlessly conduct virtual classes using Teams, Google Meet, or Zoom integration. Schedule online sessions, share resources, and maintain continuity in education.',
  },
  {
    name: 'Hostel Management',
    desc: 'Room allocation, mess tracking, gate passes, visitor logs, and hostel fee collection — all integrated with student records and the parent app.',
  },
  {
    name: 'Library Management',
    desc: 'Barcode/QR issue-return, online OPAC catalog, overdue WhatsApp reminders, and inventory audit. Fully integrated with student profiles.',
  },
  {
    name: 'Front Office',
    desc: 'Visitor management, enquiry desk, phone call logs, complaint tracking, and reception workflows — digitise your front desk completely.',
  },
  {
    name: 'CRM & Lead Management',
    desc: 'Capture leads from Facebook, Google, website, and walk-ins. AI WhatsApp agent replies in seconds. Convert to student in one click.',
  },
  {
    name: 'Biometric Attendance',
    desc: 'Plug-and-play ZKTeco biometric integration. Auto-sync to cloud. Instant parent SMS/WhatsApp on every punch. Works for students and staff.',
    badge: 'Plug & Play',
  },
  {
    name: 'Inventory Management',
    desc: 'Multi-store inventory for stationery, uniforms, books, lab equipment, and IT assets. Barcode tagging, purchase orders, and audit reports.',
  },
  {
    name: 'Daily Activities',
    desc: 'Record and share daily classroom activities, learning updates, and photos with parents — especially valuable for preschools and primary classes.',
  },
  {
    name: 'Tasks Management',
    desc: 'Assign, track, and close tasks across your school team. Set due dates, priorities, and get reminders — keep everyone accountable.',
  },
  {
    name: 'AI School Management',
    desc: 'AI agents for admissions WhatsApp, fee reminders, timetable substitution, exam analysis, and homework checking — built into every module.',
    badge: 'AI Powered',
  },
  {
    name: 'Timetable Substitution',
    desc: 'When a teacher is absent, AI suggests the best substitute in seconds — balancing subject match, current load, and free slots.',
    badge: 'AI Scheduling',
  },
  {
    name: 'Daybook',
    desc: 'Digital class diary for teachers — record what was taught, set homework, share with students and parents instantly from the app.',
  },
  {
    name: 'Leave Management',
    desc: 'Online leave applications for staff. Approval workflows, leave balance tracking, calendar view, and auto-link to payroll and attendance.',
  },
  {
    name: 'Salary & Payroll',
    desc: 'Attendance-linked salary processing with PF, ESI, PT, and TDS. Bank advice files, pay slips, and Form 16 — fully statutory compliant.',
  },
  {
    name: 'Learning Management (LMS)',
    desc: 'Upload course materials, videos, and quizzes. Students learn at their own pace. Integrated with homework, exams, and the parent app.',
  },
  {
    name: 'Online Admissions Portal',
    desc: 'Branded online application form, document upload, online registration fee payment, and real-time status tracking — all automated.',
    badge: 'Digital Portal',
  },
  {
    name: 'Multi-Institute / Multi-Branch',
    desc: 'Manage all campuses from one dashboard — consolidated financials, cross-branch reports, centralised HR, and branch-level access controls.',
  },
  {
    name: 'Payment Gateways',
    desc: 'Accept UPI, cards, netbanking, and wallets via Razorpay, PhonePe, Easebuzz, Cashfree, HDFC SmartGateway, SabPaisa, Stripe and many more. Auto receipts, auto reconciliation, zero leakage.',
    badge: 'Zero Leakage',
  },
  {
    name: 'Scholarship Management',
    desc: 'Scholarship schemes, awards with two-step approval and award letters. Approved awards reduce unpaid fees automatically.',
  },
  {
    name: 'Fee Refunds',
    desc: 'Security deposit returns and admission cancellation refunds with numbered PDF vouchers and a full audit trail.',
  },
  {
    name: 'Cash Collection Wallet',
    desc: 'See the fee cash every collector is holding. Handovers are confirmed by the accountant and totals match the daybook.',
  },
  {
    name: 'CCTV Live Cameras',
    desc: "Connect your DVR and let parents see their child's classroom camera in the app, with access by class or student.",
  },
  {
    name: 'WhatsApp Business API',
    desc: 'Official Meta WhatsApp Business API — fee reminders, attendance alerts, exam results, AI auto-reply, branded sender. Used by 300+ schools.',
    badge: 'Meta API',
  },
  {
    name: 'Online Quiz',
    desc: 'Schools can create and conduct quizzes across multiple institutions. Students can participate and compete for rewards, making learning more engaging.',
    badge: 'Roadmap',
  },
  {
    name: 'Video Tutorials',
    desc: 'Access high-quality video lessons designed to help students learn anytime, anywhere, and at their own pace.',
    badge: 'Roadmap',
  },
  {
    name: 'Mind Games & Problem Solving',
    desc: 'Interactive puzzles, mathematical challenges, and brain games designed to make learning fun while improving problem-solving and critical thinking.',
    badge: 'Roadmap',
  },
  {
    name: 'Career Guide',
    desc: 'Personalized career suggestions for students based on their strengths, interests, and abilities to guide them toward the right path.',
    badge: 'Roadmap',
  },
];

export default function PublicEnquiryPage() {
  return (
    <React.Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            Loading Partner Enquiry Form...
          </div>
        </main>
      }
    >
      <EnquiryContent />
    </React.Suspense>
  );
}

function EnquiryContent() {
  const params = useParams();
  const rawCode = Array.isArray(params?.code) ? params.code[0] : params?.code || '';
  const code = decodeURIComponent(rawCode).toUpperCase();

  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({
    country: 'India',
    institute_type: 'School',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(true);

  // Modules Explorer Modal state
  const [showModulesModal, setShowModulesModal] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showModulesModal) {
        setShowModulesModal(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModulesModal]);

  // Selectable Country state
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!code) return;

    async function loadConfig() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/enquiry-config?code=${code}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Invalid referral link.');
        }

        setOwner(data.owner);
        setFields(data.fields || []);

        // Pre-fill default select fields (keep student capacity unselected so applicant chooses explicitly)
        const initialData: Record<string, any> = { country: 'India', institute_type: 'School' };
        data.fields.forEach((f: FormField) => {
          if (
            f.field_type === 'select' &&
            f.field_key !== 'student_count' &&
            f.field_key !== 'student_strength' &&
            f.options &&
            f.options.length > 0
          ) {
            initialData[f.field_key] = f.options[0];
          }
          if (f.field_key === 'student_count' || f.field_key === 'student_strength') {
            initialData[f.field_key] = '';
          }
        });
        setFormData(initialData);
      } catch (err: any) {
        setLoadError(err.message || 'Unable to load referral page.');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [code]);

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validate phone number if present
    if (formData.phone) {
      const cleanPhone = String(formData.phone).replace(/[^0-9]/g, '');
      if (cleanPhone.length < 7) {
        setSubmitError('Please enter a valid numeric phone number (minimum 7 digits).');
        return;
      }
    }

    if (!consentGiven) {
      setSubmitError('Please agree to allow our team to contact you regarding this enquiry.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_code: code,
          form_data: formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit enquiry.');
      }

      setSubmittedCode(data.enquiry_code);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Loading Partner Enquiry Form...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
          padding: '24px',
        }}
      >
        <div className="glass-panel" style={{ maxWidth: '480px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Referral Link Not Found
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '20px' }}>
            {loadError}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Please check the link provided by your Schoolites partner or representative.
          </p>
        </div>
      </main>
    );
  }

  // Success Confirmation Screen
  if (submittedCode) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #064e3b 0%, #0a0d16 70%)',
          padding: '24px',
        }}
      >
        <div
          className="glass-panel"
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: '48px 36px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideUp 0.3s ease',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            }}
          >
            ✓
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
            Thank You for Connecting!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
            Your request has been successfully registered and routed to our dedicated institutional team.
          </p>

          <div
            style={{
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '28px',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Your Reference Code
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em' }}>
              {submittedCode}
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Our institutional relationship team has received your enquiry and will connect with you shortly.
            </div>
          </div>

          <button
            onClick={() => {
              setSubmittedCode(null);
              setFormData({ country: 'India', institute_type: 'School' });
            }}
            className="btn-secondary"
            style={{ fontSize: '0.88rem' }}
          >
            Submit Another Enquiry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 12%, #1e1b4b 0%, #0a0d16 80%)',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        .enquiry-split-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          align-items: start;
        }
        @media (min-width: 960px) {
          .enquiry-split-layout {
            grid-template-columns: 1.05fr 1.15fr;
            gap: 36px;
          }
        }
        .schoolites-metric-card {
          padding: 14px 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          text-align: center;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .schoolites-metric-card:hover {
          transform: translateY(-2px);
          border-color: rgba(99, 102, 241, 0.35);
        }
        .schoolites-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s ease;
        }
        .schoolites-feature-item:hover {
          background: rgba(99, 102, 241, 0.06);
          border-color: rgba(99, 102, 241, 0.25);
        }
      `}</style>

      <div className="enquiry-split-layout">
        {/* LEFT SECTION: Schoolites Value, Scale & Capabilities (Rendered directly on canvas ground) */}
        <div
          style={{
            padding: '12px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {/* Logo & Platform Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <img
                src="/schoolites-logo.png"
                alt="Schoolites Logo"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  background: '#ffffff',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
                }}
              />
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Schoolites
                </div>
                <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  AI School Management & ERP
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.78rem',
                color: '#34d399',
                fontWeight: 600,
                marginBottom: '14px',
              }}
            >
              <span>🎉</span>
              <span>1 Month FREE + Small One-Time Registration Fee (Includes Setup &amp; Training)</span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25, marginBottom: '10px' }}>
              AI Powered School Management System
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              Simplify your school operations with Schoolites. Manage fees on WhatsApp, biometric attendance, exams, timetables, live transport tracking &amp; more — all in one unified, cloud-native platform.
            </p>
          </div>

          {/* Scale & Proof Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div className="schoolites-metric-card">
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                1,000+
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                Schools Trust Us
              </div>
            </div>
            <div className="schoolites-metric-card">
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>
                500,000+
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                Students Managed
              </div>
            </div>
            <div className="schoolites-metric-card">
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc', letterSpacing: '-0.02em' }}>
                99.9%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                Cloud Uptime
              </div>
            </div>
            <div
              className="schoolites-metric-card"
              onClick={() => setShowModulesModal(true)}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to explore all 100+ modules"
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em' }}>
                100+
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span>Features &amp; Modules</span>
                <span style={{ fontSize: '0.72rem' }}>↗</span>
              </div>
            </div>
          </div>

          {/* Core Feature Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Why Leading Schools Choose Schoolites
            </div>

            <div className="schoolites-feature-item">
              <div style={{ fontSize: '1.25rem', padding: '6px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)' }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                  Schoolites Genie [AI Assistant]
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                  Automate teacher substitutions, enquiry responses, fee reminders, and executive reporting.
                </div>
              </div>
            </div>

            <div className="schoolites-feature-item">
              <div style={{ fontSize: '1.25rem', padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)' }}>
                💳
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                  Online Fees & WhatsApp Automation
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                  Integrated UPI/Cards/Netbanking with instant WhatsApp receipts and zero revenue leakage.
                </div>
              </div>
            </div>

            <div className="schoolites-feature-item">
              <div style={{ fontSize: '1.25rem', padding: '6px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)' }}>
                ⏱️
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                  Biometric Attendance & Live Bus Tracking
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                  Plug-and-play biometric sync, GPS vehicle tracking, and automated parent arrival alerts.
                </div>
              </div>
            </div>

            <div className="schoolites-feature-item">
              <div style={{ fontSize: '1.25rem', padding: '6px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.15)' }}>
                📱
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                  Native Mobile Apps & UDISE+ Compliance
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                  Dedicated iOS & Android apps for Parents, Teachers, and 1-click government UDISE+ export.
                </div>
              </div>
            </div>

            {/* Explore Modules Trigger Button */}
            <button
              type="button"
              onClick={() => setShowModulesModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 16px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#c7d2fe',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                marginTop: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.22)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.55)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                e.currentTarget.style.color = '#c7d2fe';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>✨</span>
              <span>Explore All 100+ Modules & Features</span>
              <span style={{ fontSize: '0.9rem' }}>→</span>
            </button>
          </div>

          {/* Trust Guarantees */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              🛡️ 100% Secure
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              ☁️ Cloud Based
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              📱 Mobile Apps (Android &amp; iOS)
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              🎧 24/7 Dedicated Support
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              ⚡ Free Training &amp; Setup
            </span>
          </div>
        </div>

        {/* RIGHT SECTION: Institutional Partnership Enquiry Form */}
        <div
          className="glass-panel enquiry-card"
          style={{
            padding: '36px 32px',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.25s ease',
            height: 'fit-content',
          }}
        >
          {/* Form Header */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Enquiry Form
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
              Connect with our business relation team to receive a tailored product walkthrough, custom pricing, and trial access for your campus.
            </p>
          </div>

          {submitError && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span>
              <span>{submitError}</span>
            </div>
          )}

          {/* Dynamic Form generated from Admin Form Config */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              {fields.map((field) => {
                const isFullWidth = field.field_type === 'textarea' || field.field_key === 'institute_name' || field.field_key === 'message';

                return (
                  <div
                    key={field.id}
                    style={{
                      gridColumn: isFullWidth ? '1 / -1' : 'span 1',
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '6px',
                      }}
                    >
                      {field.label} {field.is_required && <span style={{ color: '#f87171' }}>*</span>}
                    </label>

                    {field.field_key === 'country' ? (
                      <div ref={countryDropdownRef} style={{ position: 'relative' }}>
                        <div
                          onClick={() => setIsCountryOpen(!isCountryOpen)}
                          className="input-field"
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#0f172a',
                            userSelect: 'none',
                          }}
                        >
                          <span style={{ color: formData.country ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {formData.country || 'Select Country...'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                        </div>

                        {isCountryOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 100,
                              background: '#090d16',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                              padding: '8px',
                              marginTop: '4px',
                              animation: 'fadeIn 0.15s ease',
                            }}
                          >
                            <div style={{ marginBottom: '6px' }}>
                              <input
                                type="text"
                                autoFocus
                                placeholder="🔍 Search country..."
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                className="input-field"
                                style={{ padding: '8px 12px', fontSize: '0.84rem', width: '100%', background: '#0f172a' }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                              {COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 ? (
                                <div style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                  No matching country
                                </div>
                              ) : (
                                COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
                                  <div
                                    key={c}
                                    onClick={() => {
                                      handleInputChange('country', c);
                                      setIsCountryOpen(false);
                                      setCountrySearch('');
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '0.84rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      background: formData.country === c ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                      color: formData.country === c ? '#c7d2fe' : 'var(--text-primary)',
                                      fontWeight: formData.country === c ? 600 : 400,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (formData.country !== c) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (formData.country !== c) e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    <span>{c}</span>
                                    {formData.country === c && <span style={{ color: '#818cf8', fontSize: '0.8rem' }}>✓</span>}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : field.field_key === 'student_count' || field.field_key === 'student_strength' ? (
                      <select
                        value={formData[field.field_key] || ''}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        className="input-field"
                        style={{ background: '#0f172a' }}
                        required={field.is_required}
                      >
                        <option value="">Select Student Count / Capacity</option>
                        {STUDENT_STRENGTH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.field_type === 'select' ? (
                      <select
                        value={formData[field.field_key] || ''}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        className="input-field"
                        style={{ background: '#0f172a' }}
                        required={field.is_required}
                      >
                        {(field.options || ['School', 'College', 'Institution', 'University', 'Other']).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.field_type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        value={formData[field.field_key] || ''}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        className="input-field"
                        style={{ resize: 'vertical' }}
                        required={field.is_required}
                      />
                    ) : field.field_type === 'number' || field.field_key === 'phone' ? (
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g. 9876543210"
                        value={formData[field.field_key] || ''}
                        onChange={(e) => {
                          // Allow only numeric digits
                          const numericVal = e.target.value.replace(/[^0-9]/g, '');
                          handleInputChange(field.field_key, numericVal);
                        }}
                        className="input-field"
                        required={field.is_required}
                      />
                    ) : field.field_key === 'email' ? (
                      <input
                        type="email"
                        placeholder="contact@school.edu"
                        value={formData[field.field_key] || ''}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        className="input-field"
                        required={field.is_required}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        value={formData[field.field_key] || ''}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        className="input-field"
                        required={field.is_required}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  required
                  style={{
                    marginTop: '2px',
                    width: '16px',
                    height: '16px',
                    accentColor: '#6366f1',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <span>I agree to be contacted by the Schoolites team regarding this enquiry.</span>
              </label>

              <button
                id="submit-public-enquiry-btn"
                type="submit"
                className="btn-primary"
                disabled={submitting}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
              >
                {submitting ? 'Submitting Enquiry...' : 'Submit Enquiry'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Your details are confidential and will only be used to facilitate your institution connect.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* 100+ MODULES EXPLORER MODAL */}
      {showModulesModal && (
        <div
          onClick={() => setShowModulesModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(5, 8, 16, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '820px',
              width: '100%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#090d16',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
            }}
          >
            {/* Top Bar with Close Button (No Headings / Sub-headings) */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowModulesModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="Close (Esc)"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modules List: One Card in a Row */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {ALL_SCHOOLITES_MODULES.map((module) => (
                <div
                  key={module.name}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#38bdf8', fontSize: '0.88rem', fontWeight: 800 }}>✓</span>
                      <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>
                        {module.name}
                      </span>
                    </div>
                    {module.badge && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '9999px',
                          background: module.badge === 'Roadmap' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: module.badge === 'Roadmap' ? '#f472b6' : '#a5b4fc',
                          border: `1px solid ${module.badge === 'Roadmap' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {module.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {module.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer with Close Button */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowModulesModal(false)}
                className="btn-primary"
                style={{ fontSize: '0.88rem', padding: '10px 24px' }}
              >
                Close & Return to Form
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
