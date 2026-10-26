'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStatusMeta } from '@/lib/leadStatuses';

interface UserProfile {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: 'admin' | 'pre_sales' | 'referral' | 'business_relations' | 'promoter';
  commission_rate?: number | string | null;
  date_of_joining: string | null;
  description: string | null;
  is_active: boolean;
  has_database_access?: boolean;
  created_at: string;
}

interface ActorStats {
  totalEnquiries: number;
  newEnquiries: number;
  qualifiedEnquiries: number;
  totalLeads: number;
  activePipeline: number;
  wonLeads: number;
  totalContractValue: number;
  clearedPayments: number;
  pendingInvoices: number;
  conversionRate: number;
}

interface EnquiryItem {
  id: string;
  enquiry_code: string;
  spoc_name: string;
  phone: string;
  email: string | null;
  institute_type: string | null;
  institute_name: string | null;
  city: string | null;
  country: string | null;
  student_count: string | null;
  website?: string | null;
  message?: string | null;
  status: 'new' | 'contacted' | 'in_discussion' | 'converted_to_lead' | 'discarded';
  internal_notes?: string | null;
  claimed_at?: string | null;
  converted_lead_id?: string | null;
  created_at: string;
  owner_name?: string | null;
  owner_code?: string | null;
  promoter_name?: string | null;
  promoter_code?: string | null;
  lead_code?: string | null;
  lead_status?: string | null;
  manager_name?: string | null;
  manager_code?: string | null;
}

interface LeadItem {
  id: string;
  lead_code: string;
  institute_name: string;
  institute_type: string;
  city: string;
  country: string;
  status: string;
  deal_value?: number | null;
  contract_amount?: number | null;
  preferred_slot_date?: string | null;
  preferred_slot_time?: string | null;
  preferred_slot_mode?: string | null;
  manager_name?: string | null;
  manager_code?: string | null;
  owner_name?: string | null;
  owner_code?: string | null;
  promoter_name?: string | null;
  promoter_code?: string | null;
  contract_id?: string | null;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  contract_id: string;
  lead_id: string;
  invoice_number: string;
  amount: number | string;
  raise_date: string;
  due_date: string;
  status: 'raised' | 'pending' | 'cleared' | 'cancelled';
  cleared_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  lead_code: string;
  institute_name: string;
}

export interface ActorPayoutItem {
  id: string;
  invoice_id: string;
  contract_id: string;
  lead_id: string;
  user_id: string;
  actor_role: 'promoter' | 'owner' | 'manager';
  commission_rate: number | string;
  invoice_amount: number | string;
  payout_amount: number | string;
  invoice_status: 'raised' | 'pending' | 'cleared' | 'cancelled';
  payout_status: 'pending' | 'paid';
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  invoice_number: string;
  raise_date: string;
  due_date: string;
  invoice_cleared_at?: string | null;
  lead_code: string;
  institute_name: string;
  city: string;
}

export interface PayoutStats {
  totalCommissionPotential: number;
  totalCommissionEarned: number;
  totalCommissionPaid: number;
  totalCommissionPendingPayout: number;
  totalCommissionPendingInvoice?: number;
  totalCommissionUnbilled: number;
}

type TabType = 'overview' | 'enquiries' | 'leads' | 'business' | 'account';

export default function UserPerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: userId } = use(params);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ActorStats | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [payouts, setPayouts] = useState<ActorPayoutItem[]>([]);
  const [payoutStats, setPayoutStats] = useState<PayoutStats | null>(null);
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending_payout' | 'paid' | 'awaiting_school'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [toastMsg, setToastMsg] = useState('');

  // Selected enquiry for inspection modal
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryItem | null>(null);

  // Status toggle state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Payout action modal state
  const [selectedPayout, setSelectedPayout] = useState<ActorPayoutItem | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutFormData, setPayoutFormData] = useState({
    payout_status: 'paid' as 'paid' | 'pending',
    payment_method: 'Bank Transfer / NEFT / RTGS',
    payment_reference: '',
    paid_at: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Profile Edit & Commission Settings State
  const ROLE_DEFAULT_RATES: Record<string, number> = {
    promoter: 10,
    pre_sales: 10,
    referral: 20,
    business_relations: 10,
    admin: 0,
  };
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editRateMode, setEditRateMode] = useState<'default' | 'custom'>('default');
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    commission_rate: '10',
    has_database_access: false,
  });

  const handleOpenEditModal = () => {
    if (!user) return;
    const currentRate = user.commission_rate !== undefined && user.commission_rate !== null ? String(parseFloat(String(user.commission_rate))) : '10';
    const defaultRate = String(ROLE_DEFAULT_RATES[user.role] ?? 10);
    setEditRateMode(currentRate === defaultRate ? 'default' : 'custom');
    setEditFormData({
      name: user.name || '',
      description: user.description || '',
      commission_rate: currentRate,
      has_database_access: !!user.has_database_access,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user profile');

      setUser({ ...user, ...data.user });
      setIsEditModalOpen(false);
      setToastMsg('Member profile & commission settings updated successfully!');
      setTimeout(() => setToastMsg(''), 4000);
      fetchUserData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        throw new Error('Failed to fetch user performance');
      }
      const data = await res.json();
      setUser(data.user);
      setStats(data.stats);
      setEnquiries(data.enquiries || []);
      setLeads(data.leads || []);
      setInvoices(data.invoices || []);
      setPayouts(data.payouts || []);
      setPayoutStats(data.payoutStats || null);
    } catch (err: any) {
      setError(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const handleOpenPayoutModal = (payout: ActorPayoutItem) => {
    setSelectedPayout(payout);
    setPayoutFormData({
      payout_status: 'paid',
      payment_method: payout.payment_method || 'Bank Transfer / NEFT / RTGS',
      payment_reference: payout.payment_reference || '',
      paid_at: payout.paid_at ? payout.paid_at.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: payout.notes || '',
    });
    setPayoutModalOpen(true);
  };

  const handleUpdatePayoutStatus = async (payoutId: string, status: 'paid' | 'pending', extraData?: any) => {
    try {
      setIsSubmittingPayout(true);
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payout_status: status,
          ...extraData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payout status');

      setToastMsg(status === 'paid' ? 'Commission marked as Disbursed / Paid ✓' : 'Commission marked as Pending ⏳');
      setTimeout(() => setToastMsg(''), 4000);
      setPayoutModalOpen(false);
      fetchUserData();
    } catch (err: any) {
      alert(err.message || 'Error updating payout');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p: ActorPayoutItem) => {
      if (payoutFilter === 'pending_payout') {
        return p.invoice_status === 'cleared' && p.payout_status !== 'paid';
      }
      if (payoutFilter === 'paid') {
        return p.payout_status === 'paid';
      }
      if (payoutFilter === 'awaiting_school') {
        return p.invoice_status !== 'cleared';
      }
      return true;
    });
  }, [payouts, payoutFilter]);

  const handleToggleStatus = async () => {
    if (!user) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status');

      setUser({ ...user, is_active: !user.is_active });
      setToastMsg(`User account marked as ${!user.is_active ? 'Active' : 'Inactive'}`);
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
        <p>Loading member profile and performance metrics...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>User Not Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          {error || 'The requested team member does not exist or has been removed.'}
        </p>
        <Link href="/admin/users" className="btn-primary" style={{ padding: '8px 18px' }}>
          ← Back to All Users
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Breadcrumb & Navigation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/admin/users"
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Users Directory
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.92rem' }}>{user.name}</span>
          <span className="user-code-pill" style={{ color: '#818cf8', fontSize: '0.78rem' }}>{user.user_code}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: user.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: user.is_active ? '#34d399' : '#f87171',
              border: user.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <span>●</span>
            <span>{user.is_active ? 'Account Active' : 'Account Suspended'}</span>
          </button>
        </div>
      </div>

      {/* Main Profile Summary Card */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
          borderLeft: `4px solid ${
            user.role === 'promoter'
              ? 'var(--role-promoter-color)'
              : user.role === 'business_relations'
              ? 'var(--role-business-color)'
              : user.role === 'pre_sales'
              ? 'var(--role-presales-color)'
              : '#818cf8'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{user.name}</h1>
              <span className={`badge-role ${user.role}`}>{user.role.replace(/_/g, ' ')}</span>
              {user.has_database_access && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  <span>🏢</span> Places DB Access
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>✉️ {user.email}</span>
              <span>📅 Joined: {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
              {user.commission_rate && <span>💰 Commission: <strong>{user.commission_rate}%</strong></span>}
            </div>
          </div>
        </div>

        {user.role === 'promoter' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={`/e/${user.user_code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Preview Public Link ↗
            </a>
          </div>
        )}
      </div>

      {/* KPI Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Enquiries (Referred/Owned)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
            {stats?.totalEnquiries || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
            {stats?.qualifiedEnquiries || 0} Qualified & Converted
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Leads Pipeline
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
            {stats?.totalLeads || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '4px' }}>
            {stats?.activePipeline || 0} Active In-Progress
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Deals Closed Won 🎉
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
            {stats?.wonLeads || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats?.conversionRate || 0}% Conversion Rate
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '3px solid #fbbf24' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Earned Commission Share
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
            ₹{(payoutStats?.totalCommissionEarned || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ₹{(payoutStats?.totalCommissionPaid || 0).toLocaleString('en-IN')} Paid • ₹{(payoutStats?.totalCommissionPendingPayout || 0).toLocaleString('en-IN')} Pending Transfer
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '8px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: 'Performance Overview', icon: '📊' },
          { id: 'enquiries', label: `Inbound Enquiries (${enquiries.length})`, icon: '📥' },
          { id: 'leads', label: `Pipeline Leads (${leads.length})`, icon: '🎯' },
          { id: 'business', label: `Commission Payouts (${payouts.length})`, icon: '💰' },
          { id: 'account', label: 'Profile & Settings', icon: '⚙️' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid #818cf8' : '1px solid transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Funnel Distribution */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Actor Pipeline Funnel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Inbound Attributed</span>
                  <span style={{ fontWeight: 700 }}>{stats?.totalEnquiries}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#38bdf8' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Converted to Active Lead</span>
                  <span style={{ fontWeight: 700 }}>{stats?.qualifiedEnquiries}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stats?.totalEnquiries ? Math.min(100, Math.round(((stats.qualifiedEnquiries || 0) / stats.totalEnquiries) * 100)) : 0}%`,
                      height: '100%',
                      background: '#818cf8',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Closed Deals Won</span>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>{stats?.wonLeads}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stats?.totalEnquiries ? Math.min(100, Math.round(((stats.wonLeads || 0) / stats.totalEnquiries) * 100)) : 0}%`,
                      height: '100%',
                      background: '#10b981',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Member Profile Details Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Role & Responsibility</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department / Scope</div>
                <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{user.description || 'General Staff'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Code Identifier</div>
                <div style={{ fontFamily: 'monospace', color: '#818cf8', marginTop: '2px' }}>{user.user_code}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contract Revenue Volume</div>
                <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                  ₹{(stats?.totalContractValue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENQUIRIES */}
      {activeTab === 'enquiries' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Inbound Institutional Enquiries</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Total: <strong>{enquiries.length}</strong>
            </span>
          </div>

          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Code & Date
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Institution Info
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    SPOC / Contact
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Status & Stage
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No enquiries associated with this team member yet.
                    </td>
                  </tr>
                ) : (
                  enquiries.map((enq) => (
                    <tr key={enq.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div className="user-code-pill" style={{ color: '#38bdf8', marginBottom: '4px' }}>
                          {enq.enquiry_code}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{enq.institute_name || enq.institute_type}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {enq.city ? `${enq.city}, ` : ''}{enq.country || ''} {enq.student_count ? `• ${enq.student_count} Students` : ''}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{enq.spoc_name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <a href={`tel:${enq.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>📞 {enq.phone}</a>
                        </div>
                        {enq.email && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <a href={`mailto:${enq.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>✉️ {enq.email}</a>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              enq.status === 'new'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : enq.status === 'contacted'
                                ? 'rgba(251, 191, 36, 0.15)'
                                : enq.status === 'converted_to_lead'
                                ? 'rgba(52, 211, 153, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              enq.status === 'new'
                                ? '#38bdf8'
                                : enq.status === 'contacted'
                                ? '#fbbf24'
                                : enq.status === 'converted_to_lead'
                                ? '#34d399'
                                : '#f87171',
                            border: '1px solid var(--border-subtle)',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                          }}
                        >
                          {enq.status.replace(/_/g, ' ')}
                        </span>
                        {enq.lead_code && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Lead: <span className="user-code-pill" style={{ fontSize: '0.7rem' }}>{enq.lead_code}</span>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedEnquiry(enq)}
                          className="btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px' }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LEADS PIPELINE */}
      {activeTab === 'leads' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Associated Leads Pipeline</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Total in Pipeline: <strong>{leads.length}</strong>
            </span>
          </div>

          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Lead Code
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Institution
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Pipeline Stage
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Manager
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Contract Value
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leads currently attributed to this actor.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const meta = getStatusMeta(lead.status);
                    return (
                      <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <span className="user-code-pill" style={{ color: '#ffffff' }}>{lead.lead_code}</span>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 600 }}>{lead.institute_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.city}, {lead.country}</div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: meta.bgColor,
                              color: meta.color,
                              border: `1px solid ${meta.borderColor}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <span>●</span>
                            <span>{meta.label}</span>
                          </span>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          {lead.manager_name ? (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{lead.manager_name}</div>
                              <span className="user-code-pill" style={{ color: '#38bdf8', fontSize: '0.7rem' }}>{lead.manager_code}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>Unassigned</span>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px', fontWeight: 700, color: lead.contract_amount ? '#34d399' : '#ffffff' }}>
                          {lead.contract_amount ? `₹${parseFloat(String(lead.contract_amount)).toLocaleString('en-IN')}` : lead.deal_value ? `₹${parseFloat(String(lead.deal_value)).toLocaleString('en-IN')}` : '—'}
                        </td>

                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <Link
                            href={`/admin/leads?id=${lead.id}`}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            Open Lead ↗
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMMISSION SPLITS & PAYOUT CLEARANCE */}
      {activeTab === 'business' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Payout KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            <div className="glass-panel" style={{ padding: '16px 18px', borderLeft: '3px solid #6366f1' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Contract Potential
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                ₹{(payoutStats?.totalCommissionPotential || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {(payoutStats?.totalCommissionUnbilled || 0) > 0
                  ? `₹${(payoutStats?.totalCommissionUnbilled || 0).toLocaleString('en-IN')} unbilled contract scope`
                  : `Across ${payouts.length} deal invoice splits`}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 18px', borderLeft: '3px solid #34d399' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399', textTransform: 'uppercase' }}>
                Eligible Earned (Cleared)
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
                ₹{(payoutStats?.totalCommissionEarned || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                From verified client bank receipts
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 18px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
                Disbursed to Member (Paid)
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                ₹{(payoutStats?.totalCommissionPaid || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Transfers executed & verified
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 18px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                Pending Admin Transfer
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
                ₹{(payoutStats?.totalCommissionPendingPayout || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Client cash cleared • Ready for payout
              </div>
            </div>
          </div>

          {/* Table Panel */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '18px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Actor Commission Splits & Payout Clearance</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                  Individual invoice shares attributed to this member. Clear payments once company funds are cleared.
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All Splits (${payouts.length})` },
                  { id: 'pending_payout', label: `Pending Transfer (${payouts.filter((p: ActorPayoutItem) => p.invoice_status === 'cleared' && p.payout_status !== 'paid').length})` },
                  { id: 'paid', label: `Disbursed (${payouts.filter((p: ActorPayoutItem) => p.payout_status === 'paid').length})` },
                  { id: 'awaiting_school', label: `Awaiting Client (${payouts.filter((p: ActorPayoutItem) => p.invoice_status !== 'cleared').length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setPayoutFilter(f.id as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: payoutFilter === f.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: payoutFilter === f.id ? '#ffffff' : 'var(--text-muted)',
                      border: payoutFilter === f.id ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Invoice & Deal
                    </th>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Client Inflow
                    </th>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Attribution
                    </th>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Member Share
                    </th>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Payout Status
                    </th>
                    <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No commission split records matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((p) => {
                      const isClientCleared = p.invoice_status === 'cleared';
                      const isPaid = p.payout_status === 'paid';
                      const roleDisplayMap: Record<string, string> = {
                        promoter: 'Affiliate Promoter',
                        owner: 'Lead Originator',
                        manager: 'Lead Manager (Closer)',
                      };

                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {/* Invoice & Deal */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>{p.invoice_number}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="user-code-pill" style={{ fontSize: '0.7rem', color: '#818cf8' }}>
                                {p.lead_code}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {p.institute_name}
                              </span>
                            </div>
                          </td>

                          {/* Client Inflow */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 600 }}>₹{parseFloat(String(p.invoice_amount)).toLocaleString('en-IN')}</div>
                            <div style={{ marginTop: '3px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: isClientCleared ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                  color: isClientCleared ? '#34d399' : '#fbbf24',
                                  border: `1px solid ${isClientCleared ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                                  display: 'inline-flex',
                                }}
                              >
                                {isClientCleared ? 'Client Cleared ✓' : 'Payment Due'}
                              </span>
                            </div>
                          </td>

                          {/* Role & Rate */}
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#e2e8f0',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              {roleDisplayMap[p.actor_role] || p.actor_role}
                            </span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Rate: <strong>{parseFloat(String(p.commission_rate))}%</strong>
                            </div>
                          </td>

                          {/* Calculated Share */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isPaid ? '#34d399' : isClientCleared ? '#fbbf24' : '#94a3b8' }}>
                              ₹{parseFloat(String(p.payout_amount)).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {p.commission_rate}% of ₹{parseFloat(String(p.invoice_amount)).toLocaleString('en-IN')}
                            </div>
                          </td>

                          {/* Payout Status */}
                          <td style={{ padding: '14px 18px' }}>
                            {isPaid ? (
                              <div>
                                <span
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>✓</span>
                                  <span>Disbursed / Paid</span>
                                </span>
                                {p.paid_at && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Paid: {new Date(p.paid_at).toLocaleDateString('en-IN')}
                                    {p.payment_reference && <span> • {p.payment_reference}</span>}
                                  </div>
                                )}
                              </div>
                            ) : isClientCleared ? (
                              <div>
                                <span
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>⏳</span>
                                  <span>Ready for Payout</span>
                                </span>
                                <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '4px' }}>
                                  Client cash cleared
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'inline-flex',
                                  }}
                                >
                                  🔒 Awaiting Client Payment
                                </span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  Unlockable once school clears invoice
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Action Button */}
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            {!isPaid ? (
                              <button
                                onClick={() => handleOpenPayoutModal(p)}
                                className="btn-primary"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.78rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  background: isClientCleared ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
                                }}
                              >
                                <span>💰</span>
                                <span>Mark as Paid</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (confirm('Revert this commission payment back to Pending status?')) {
                                    handleUpdatePayoutStatus(p.id, 'pending');
                                  }
                                }}
                                className="btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.74rem', color: 'var(--text-muted)' }}
                              >
                                ↺ Revert to Pending
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNT & SETTINGS */}
      {activeTab === 'account' && (
        <div className="glass-panel" style={{ padding: '24px', maxWidth: '680px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Member Account Specifications</h3>
            <button
              onClick={handleOpenEditModal}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>✏️</span> Edit Profile & Incentive Settings
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 600 }}>
                  {user.name}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 600 }}>
                  {user.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 600 }}>
                  {user.role.replace(/_/g, ' ')}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Code Identifier</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 600, fontFamily: 'monospace', color: '#818cf8' }}>
                  {user.user_code}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incentive / Commission Rate</label>
                <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 700, color: '#34d399', fontSize: '1rem' }}>
                  {user.commission_rate !== undefined && user.commission_rate !== null ? `${parseFloat(String(user.commission_rate))}%` : '10.00%'}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                    (on cleared collections)
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date of Joining</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontWeight: 600 }}>
                  {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bio / Scope Description</label>
              <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginTop: '4px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {user.description || 'No additional bio provided.'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account State</label>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={handleToggleStatus}
                  disabled={isUpdatingStatus}
                  className={user.is_active ? 'btn-secondary' : 'btn-primary'}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  {user.is_active ? 'Deactivate Member Account' : 'Reactivate Member Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MEMBER PROFILE & INCENTIVE SETTINGS MODAL */}
      {isEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>✏️ Edit Member & Incentive Settings</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Incentive / Commission Rate */}
              {user.role !== 'admin' && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                      Commission Rate (%)
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditRateMode('default');
                          setEditFormData({
                            ...editFormData,
                            commission_rate: String(ROLE_DEFAULT_RATES[user.role] ?? 10),
                          });
                        }}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: editRateMode === 'default' ? '#6366f1' : 'var(--border-subtle)',
                          background: editRateMode === 'default' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: editRateMode === 'default' ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Default ({ROLE_DEFAULT_RATES[user.role]}%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRateMode('custom')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: editRateMode === 'custom' ? '#6366f1' : 'var(--border-subtle)',
                          background: editRateMode === 'custom' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: editRateMode === 'custom' ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Custom %
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      disabled={editRateMode === 'default'}
                      value={editFormData.commission_rate}
                      onChange={(e) => setEditFormData({ ...editFormData, commission_rate: e.target.value })}
                      className="input-field"
                      style={{
                        maxWidth: '120px',
                        fontWeight: 700,
                        color: '#34d399',
                        opacity: editRateMode === 'default' ? 0.8 : 1,
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      % payout on cash collected from future deals
                    </span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    💡 Note: Changing this rate applies to new signed contracts. Existing historical contracts preserve their locked snapshotted rate.
                  </p>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Bio / Scope Description
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="input-field"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Places Database Access Toggle (Pre-Sales & Referral only) */}
              {(user?.role === 'pre_sales' || user?.role === 'referral') && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: editFormData.has_database_access ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: editFormData.has_database_access ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setEditFormData((f) => ({ ...f, has_database_access: !f.has_database_access }))}
                >
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏢</span>
                      <span>Grant Places Database Access</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Gives member access to the discovery queue & Google Places outreach pipeline.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editFormData.has_database_access}
                    onChange={(e) => setEditFormData({ ...editFormData, has_database_access: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary"
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Save Settings ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD COMMISSION PAYOUT MODAL */}
      {payoutModalOpen && selectedPayout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setPayoutModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: '26px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💰</span> Record Commission Disbursement
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Mark partner share as paid once bank transfer / payout is executed.
                </p>
              </div>
              <button
                onClick={() => setPayoutModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Payout Summary Box */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Beneficiary Member:</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{user?.name} [{user?.user_code}]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Client & Invoice:</span>
                <span style={{ fontWeight: 600, color: '#818cf8' }}>{selectedPayout.institute_name} ({selectedPayout.invoice_number})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Attribution Rate:</span>
                <span>{selectedPayout.commission_rate}% of ₹{parseFloat(String(selectedPayout.invoice_amount)).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>Payout Share Amount:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                  ₹{parseFloat(String(selectedPayout.payout_amount)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdatePayoutStatus(selectedPayout.id, 'paid', payoutFormData);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Payment Method *
                </label>
                <select
                  value={payoutFormData.payment_method}
                  onChange={(e) => setPayoutFormData({ ...payoutFormData, payment_method: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="Bank Transfer / NEFT / RTGS">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="IMPS">IMPS Immediate Transfer</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Cash">Cash Disbursement</option>
                  <option value="Other">Other Gateway / Ledger Transfer</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Payment Reference / UTR
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-9821893821"
                    value={payoutFormData.payment_reference}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, payment_reference: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Disbursement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutFormData.paid_at}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, paid_at: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Internal Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Disbursed via Corporate Banking"
                  value={payoutFormData.notes}
                  onChange={(e) => setPayoutFormData({ ...payoutFormData, notes: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="btn-secondary"
                  disabled={isSubmittingPayout}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingPayout}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  {isSubmittingPayout ? 'Recording Transfer...' : 'Confirm & Mark as Paid ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT ENQUIRY DETAILS MODAL */}
      {selectedEnquiry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSelectedEnquiry(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div>
                <span className="user-code-pill" style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
                  {selectedEnquiry.enquiry_code}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '6px' }}>
                  {selectedEnquiry.institute_name || selectedEnquiry.institute_type}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEnquiry(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact Person</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedEnquiry.spoc_name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</div>
                <div style={{ fontSize: '0.9rem', color: '#38bdf8', marginTop: '2px' }}>
                  <a href={`tel:${selectedEnquiry.phone}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>📞 {selectedEnquiry.phone}</a>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedEnquiry.email ? <a href={`mailto:${selectedEnquiry.email}`} style={{ color: '#818cf8', textDecoration: 'none' }}>✉️ {selectedEnquiry.email}</a> : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedEnquiry.city ? `${selectedEnquiry.city}, ` : ''}{selectedEnquiry.country || '—'}
                </div>
              </div>
            </div>

            {selectedEnquiry.message && (
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Inbound Message</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>"{selectedEnquiry.message}"</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setSelectedEnquiry(null)} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.88rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
