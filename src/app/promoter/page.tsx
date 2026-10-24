'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActorShell, { NavItem } from '@/components/ActorShell';
import { usePipelineAutoSync } from '@/hooks/usePipelineAutoSync';
import { getStatusMeta } from '@/lib/leadStatuses';
import ActorBusinessLedger from '@/components/ActorBusinessLedger';

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  user_code: string;
}

interface PromoterEnquiry {
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
  converted_lead_id?: string | null;
  claimed_at?: string | null;
  created_at: string;
  owner_name?: string | null;
  owner_code?: string | null;
  owner_role?: string | null;
  promoter_name?: string | null;
  promoter_code?: string | null;
  lead_code?: string | null;
  lead_status?: string | null;
  lead_deal_value?: number | null;
  manager_name?: string | null;
  manager_code?: string | null;
}

interface StoredFile {
  url: string;
  storage_key: string;
  name: string;
  size: number;
  mime_type: string;
}

interface Asset {
  id: string;
  title: string;
  category: string;
  file_type: 'image' | 'text' | 'pdf' | 'video_link';
  content_url: string;
  body_text?: string | null;
  files?: StoredFile[];
  description: string | null;
  created_at: string;
}

type PromoterTabType = 'enquiries' | 'assets' | 'business';

export default function PromoterPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  const [activeTab, setActiveTabState] = useState<PromoterTabType>('enquiries');

  const setActiveTab = (tab: PromoterTabType) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // Hydrate URL tab safely on mount after initial render
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const paramTab = new URLSearchParams(window.location.search).get('tab') as PromoterTabType;
    const validTabs: PromoterTabType[] = ['enquiries', 'assets', 'business'];
    if (paramTab && validTabs.includes(paramTab)) {
      setActiveTabState(paramTab);
    }
  }, []);

  // Data states
  const [enquiries, setEnquiries] = useState<PromoterEnquiry[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [enquiryStageFilter, setEnquiryStageFilter] = useState('all');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<PromoterEnquiry | null>(null);
  const [columnSort, setColumnSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const handleToggleSort = (column: string) => {
    setColumnSort((prev) => {
      if (!prev || prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null;
    });
  };

  // Asset Carousel & Lightbox States
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [lightboxData, setLightboxData] = useState<{ asset: Asset; index: number } | null>(null);
  const [downloadPromptAsset, setDownloadPromptAsset] = useState<Asset | null>(null);
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});

  // 1. Fetch Enquiries
  const fetchEnquiries = async () => {
    try {
      const res = await fetch('/api/enquiries');
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.error('Failed to fetch promoter enquiries:', err);
    }
  };

  // 2. Fetch Marketing Assets
  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to fetch marketing assets:', err);
    }
  };

  // Auth & Initial Load
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        if (data.user.role !== 'promoter') {
          router.replace('/');
          return;
        }
        setUser(data.user);
        fetchEnquiries();
        fetchAssets();
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  // Window Focus & Polling Auto-Sync (zero server compute when idle)
  usePipelineAutoSync(() => {
    if (activeTab === 'enquiries') fetchEnquiries();
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToastMsg(`Copied ${label} to clipboard!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crm.schoolites.com';
  const promoterLink = user?.user_code ? `${origin}/e/${user.user_code}` : '';

  const handlePrevImage = (assetId: string, total: number) => {
    setCardImageIndices((prev) => {
      const current = prev[assetId] || 0;
      return { ...prev, [assetId]: (current - 1 + total) % total };
    });
  };

  const handleNextImage = (assetId: string, total: number) => {
    setCardImageIndices((prev) => {
      const current = prev[assetId] || 0;
      return { ...prev, [assetId]: (current + 1) % total };
    });
  };

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      const matchEnquiryStage = enquiryStageFilter === 'all' || e.status === enquiryStageFilter;
      let matchLeadStage = true;
      if (leadStageFilter !== 'all') {
        const normLeadStatus = (e.lead_status || '').toLowerCase();
        const isConverted = Boolean(e.converted_lead_id || e.status === 'converted_to_lead');

        if (leadStageFilter === 'pending') {
          matchLeadStage = !isConverted;
        } else if (leadStageFilter === 'active') {
          matchLeadStage = isConverted && normLeadStatus !== 'won' && normLeadStatus !== 'lost';
        } else if (leadStageFilter === 'won') {
          matchLeadStage = normLeadStatus === 'won';
        } else if (leadStageFilter === 'lost') {
          matchLeadStage = normLeadStatus === 'lost';
        } else {
          matchLeadStage = normLeadStatus === leadStageFilter.toLowerCase();
        }
      }
      if (!matchEnquiryStage || !matchLeadStage) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchCode = e.enquiry_code.toLowerCase().includes(q);
      const matchInst = (e.institute_name || '').toLowerCase().includes(q) || (e.institute_type || '').toLowerCase().includes(q);
      const matchCity = (e.city || '').toLowerCase().includes(q);
      const matchStatus = (e.status || '').toLowerCase().includes(q);
      const matchLeadCode = (e.lead_code || '').toLowerCase().includes(q);
      const matchLeadStatus = (e.lead_status || '').toLowerCase().includes(q);
      return matchCode || matchInst || matchCity || matchStatus || matchLeadCode || matchLeadStatus;
    });
  }, [enquiries, searchQuery, enquiryStageFilter, leadStageFilter]);

  const sortedEnquiries = useMemo(() => {
    if (!columnSort) return filteredEnquiries;
    const sorted = [...filteredEnquiries];
    sorted.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (columnSort.column === 'code') {
        aVal = a.enquiry_code;
        bVal = b.enquiry_code;
      } else if (columnSort.column === 'institute') {
        aVal = a.institute_name || a.institute_type || '';
        bVal = b.institute_name || b.institute_type || '';
      } else if (columnSort.column === 'team') {
        aVal = a.owner_name || a.manager_name || '';
        bVal = b.owner_name || b.manager_name || '';
      } else if (columnSort.column === 'enquiry_stage') {
        aVal = a.status;
        bVal = b.status;
      } else if (columnSort.column === 'lead_stage') {
        aVal = a.lead_status || '';
        bVal = b.lead_status || '';
      }
      const cmp = aVal.localeCompare(bVal);
      return columnSort.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredEnquiries, columnSort]);

  const handleDownloadAll = async (asset: Asset) => {
    if (!asset.files || asset.files.length === 0) return;
    for (let i = 0; i < asset.files.length; i++) {
      const file = asset.files[i];
      const link = document.createElement('a');
      link.href = `${file.url}&download=true`;
      link.download = file.name || `${asset.title}-${i + 1}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((res) => setTimeout(res, 250));
    }
    setDownloadPromptAsset(null);
    setToastMsg(`Downloading all ${asset.files.length} images...`);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const navItems: NavItem[] = [
    {
      id: 'enquiries',
      label: 'Referrals & Pipeline',
      icon: '📥',
      badge: enquiries.length > 0 ? enquiries.length : undefined,
      isActive: activeTab === 'enquiries',
      onClick: () => setActiveTab('enquiries'),
    },
    {
      id: 'assets',
      label: 'Marketing Assets',
      icon: '📁',
      badge: assets.length > 0 ? assets.length : undefined,
      isActive: activeTab === 'assets',
      onClick: () => setActiveTab('assets'),
    },
    {
      id: 'business',
      label: 'Business & Rewards',
      icon: '💼',
      isActive: activeTab === 'business',
      onClick: () => setActiveTab('business'),
    },
  ];

  const activeTabTitles: Record<string, string> = {
    enquiries: 'Referrals & Live Pipeline',
    assets: 'Marketing Assets Hub',
    business: 'Your Business & Commissions',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          <p style={{ color: 'var(--text-muted)' }}>Loading promoter workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <ActorShell
      user={user}
      roleTitle="Promoter Partner"
      roleBadgeClass="promoter"
      roleColor="var(--role-promoter-color)"
      navItems={navItems}
      activeTabTitle={activeTabTitles[activeTab]}
    >
      <div className="workspace-container">
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
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>✓</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* UNIQUE SHAREABLE REFERRAL LINK BANNER (Shown on Enquiries and Assets tabs) */}
        {(activeTab === 'enquiries' || activeTab === 'assets') && (
          <div
            className="glass-panel"
            style={{
              padding: '24px 28px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              borderLeft: '4px solid var(--role-promoter-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔗</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Your Unique Public Referral Link</h3>
                <span className="user-code-pill" style={{ color: 'var(--role-promoter-color)', fontSize: '0.74rem' }}>
                  {user?.user_code}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.45', marginBottom: '12px' }}>
                Share this link publicly with institutions. All inbound enquiries submitted through this page are directly attributed to your account.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: '#c7d2fe',
                  wordBreak: 'break-all',
                }}
              >
                <span>{promoterLink}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => copyToClipboard(promoterLink, 'your unique referral link')}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.88rem' }}
              >
                📋 Copy Link
              </button>
              <a
                href={`/e/${user?.user_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.88rem' }}
              >
                Preview Page ↗
              </a>
            </div>
          </div>
        )}

        {/* UNIFIED TAB: REFERRALS & LIVE PIPELINE */}
        {activeTab === 'enquiries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quick KPI Overview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid var(--role-promoter-color)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Total Inbound Referrals
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>{enquiries.length}</div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  In Pre-Sales Review
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
                  {enquiries.filter((e) => e.status === 'new' || e.status === 'contacted' || e.status === 'in_discussion').length}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #818cf8' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Active Deals Pipeline
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818cf8' }}>
                  {enquiries.filter((e) => e.status === 'converted_to_lead' && e.lead_status !== 'WON' && e.lead_status !== 'LOST').length}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Deals Won 🎉
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  {enquiries.filter((e) => (e.lead_status || '').toLowerCase() === 'won').length}
                </div>
              </div>
            </div>

            {/* Main Referrals Table Panel */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div
                style={{
                  padding: '20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Referrals & Live Pipeline</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Track all institutional enquiries generated by your link through every stage of qualification, demo, and closing.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '220px', maxWidth: '320px' }}>
                    <input
                      type="text"
                      placeholder="Search by code, institute, city..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Enquiry Stage:
                    </label>
                    <select
                      value={enquiryStageFilter}
                      onChange={(e) => setEnquiryStageFilter(e.target.value)}
                      className="input-field"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="all">All Enquiry Stages</option>
                      <option value="new">✨ New Inbound</option>
                      <option value="contacted">📞 Contacted</option>
                      <option value="in_discussion">💬 In Discussion</option>
                      <option value="converted_to_lead">✅ Converted to Lead</option>
                      <option value="discarded">✕ Discarded</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Lead Stage:
                    </label>
                    <select
                      value={leadStageFilter}
                      onChange={(e) => setLeadStageFilter(e.target.value)}
                      className="input-field"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="all">All Lead Stages</option>
                      <option value="pending">⏳ Pending Conversion</option>
                      <option value="active">🎯 Active Pipeline</option>
                      <option value="assigned">📋 Assigned</option>
                      <option value="demo_scheduled">📅 Demo Scheduled</option>
                      <option value="demo_completed">🎥 Demo Completed</option>
                      <option value="in_discussion">💬 In Discussion</option>
                      <option value="following_up">🔄 Following Up</option>
                      <option value="proposal_sent">📄 Proposal Sent</option>
                      <option value="onboarding_initiated">🚀 Onboarding Initiated</option>
                      <option value="onboarding_completed">🏁 Onboarding Completed</option>
                      <option value="won">🎉 Won / Closed</option>
                      <option value="lost">❌ Lost</option>
                    </select>
                  </div>

                  {(searchQuery || enquiryStageFilter !== 'all' || leadStageFilter !== 'all' || columnSort) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setEnquiryStageFilter('all');
                        setLeadStageFilter('all');
                        setColumnSort(null);
                      }}
                      className="btn-secondary"
                      style={{
                        padding: '7px 12px',
                        fontSize: '0.8rem',
                        color: '#f87171',
                        borderColor: 'rgba(239, 68, 68, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>✕</span>
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('code')}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          <span>Referral Code & Date</span>
                          <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'code' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'code' ? 1 : 0.5 }}>
                            {columnSort?.column === 'code' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('institute')}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          <span>Institution Info</span>
                          <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'institute' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'institute' ? 1 : 0.5 }}>
                            {columnSort?.column === 'institute' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('team')}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          <span>Assigned Team</span>
                          <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'team' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'team' ? 1 : 0.5 }}>
                            {columnSort?.column === 'team' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('enquiry_stage')}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          <span>Enquiry Stage</span>
                          <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'enquiry_stage' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'enquiry_stage' ? 1 : 0.5 }}>
                            {columnSort?.column === 'enquiry_stage' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('lead_stage')}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          <span>Lead Stage</span>
                          <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'lead_stage' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'lead_stage' ? 1 : 0.5 }}>
                            {columnSort?.column === 'lead_stage' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEnquiries.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {searchQuery ? 'No referrals match your search query.' : 'No enquiries received yet. Share your unique referral link to capture institutional leads!'}
                        </td>
                      </tr>
                    ) : (
                      sortedEnquiries.map((enq) => {
                        const isConverted = enq.status === 'converted_to_lead';
                        const isDiscarded = enq.status === 'discarded';
                        const isWon = (enq.lead_status || '').toLowerCase() === 'won';
                        const isLost = (enq.lead_status || '').toLowerCase() === 'lost';
                        const leadMeta = enq.lead_status ? getStatusMeta(enq.lead_status) : null;

                        return (
                          <tr
                            key={enq.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              transition: 'background 0.15s ease',
                              background: isWon ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isWon ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = isWon ? 'rgba(16, 185, 129, 0.03)' : 'transparent')}
                          >
                            {/* 1. Code & Date */}
                            <td style={{ padding: '16px 20px' }}>
                              <div className="user-code-pill" style={{ color: '#38bdf8', marginBottom: '4px' }}>
                                {enq.enquiry_code}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </td>

                            {/* 2. Institution Info */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '3px' }}>
                                {enq.institute_name || enq.institute_type}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {enq.city ? `${enq.city}, ` : ''}{enq.country || ''}
                                {enq.student_count ? ` • ${enq.student_count} Students` : ''}
                              </div>
                            </td>

                            {/* 3. Assigned Team */}
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '70px' }}>Owner:</span>
                                  {enq.owner_name ? (
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                      {enq.owner_name} <span className="user-code-pill" style={{ color: '#818cf8', fontSize: '0.7rem' }}>{enq.owner_code}</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>Pending Qualification</span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '70px' }}>Manager:</span>
                                  {enq.manager_name ? (
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                      {enq.manager_name} <span className="user-code-pill" style={{ color: 'var(--role-business-color)', fontSize: '0.7rem' }}>{enq.manager_code}</span>
                                    </span>
                                  ) : isConverted ? (
                                    <span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Assigning Manager...</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>Pending Conversion</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 4. Enquiry Qualification Stage */}
                            <td style={{ padding: '16px 20px' }}>
                              {enq.status === 'converted_to_lead' ? (
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>✅</span> Converted to Lead
                                </span>
                              ) : enq.status === 'in_discussion' ? (
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    color: '#c084fc',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>💬</span> In Discussion
                                </span>
                              ) : enq.status === 'contacted' ? (
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    background: 'rgba(251, 191, 36, 0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>📞</span> Contacted
                                </span>
                              ) : enq.status === 'discarded' ? (
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>✕</span> Discarded
                                </span>
                              ) : (
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>✨</span> New Inbound
                                </span>
                              )}
                            </td>

                            {/* 5. Lead Pipeline Stage */}
                            <td style={{ padding: '16px 20px' }}>
                              {isWon ? (
                                <div>
                                  <span
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '9999px',
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      background: 'rgba(16, 185, 129, 0.2)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.4)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
                                    }}
                                  >
                                    <span>🎉</span>
                                    <span>Won / Contract Closed</span>
                                  </span>
                                  <div style={{ marginTop: '4px' }}>
                                    <Link
                                      href="/business"
                                      style={{
                                        fontSize: '0.78rem',
                                        color: '#38bdf8',
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      View Commission Split ↗
                                    </Link>
                                  </div>
                                </div>
                              ) : isConverted ? (
                                <div>
                                  <span
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '9999px',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      background: enq.lead_status === 'LOST' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                      color: enq.lead_status === 'LOST' ? '#f87171' : '#c7d2fe',
                                      border: enq.lead_status === 'LOST' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <span>{(enq.lead_status || '').toLowerCase() === 'lost' ? '❌' : '🎯'}</span>
                                    <span>{leadMeta?.label || enq.lead_status?.replace(/_/g, ' ') || 'Active Lead Stage'}</span>
                                  </span>
                                  {enq.lead_code && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      Lead Ref: <span className="user-code-pill" style={{ fontSize: '0.7rem' }}>{enq.lead_code}</span>
                                    </div>
                                  )}
                                </div>
                              ) : isDiscarded ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span>⏳</span> Pending Manager Assignment
                                </span>
                              )}
                            </td>

                            {/* 6. Actions */}
                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                              <button
                                onClick={() => setSelectedEnquiry(enq)}
                                className="btn-secondary"
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '0.82rem',
                                  borderRadius: '6px',
                                }}
                              >
                                View Details
                              </button>
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

        {/* TAB 2: MARKETING ASSETS */}
        {activeTab === 'assets' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
            {assets.map((asset) => {
              const hasMultiFiles = Array.isArray(asset.files) && asset.files.length > 0;
              const activeIndex = cardImageIndices[asset.id] || 0;
              const activeFile = hasMultiFiles ? asset.files![activeIndex] : null;
              const activeImageUrl = activeFile ? activeFile.url : asset.content_url;
              const bodyCopy = asset.body_text || (asset.file_type === 'text' ? asset.content_url : null);

              return (
                <div
                  key={asset.id}
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Category & Type Pills Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#c7d2fe',
                          border: '1px solid var(--border-subtle)',
                          textTransform: 'uppercase',
                        }}
                      >
                        <span>
                          {asset.file_type === 'image' ? '🖼️' : asset.file_type === 'pdf' ? '📄' : asset.file_type === 'video_link' ? '🎥' : '📝'}
                        </span>
                        <span>{asset.file_type.replace('_', ' ')}</span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                      >
                        {asset.category}
                      </span>
                    </div>

                    {/* 1. DIRECT INLINE IMAGE PREVIEW WITH LEFT/RIGHT SCROLLERS (IF IMAGE TYPE) */}
                    {asset.file_type === 'image' && (
                      <div style={{ marginBottom: '14px', position: 'relative' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '190px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: '#090d16',
                            border: '1px solid var(--border-subtle)',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={activeImageUrl}
                            alt={asset.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              cursor: 'zoom-in',
                            }}
                            onClick={() => setLightboxData({ asset, index: activeIndex })}
                          />

                          {/* Floating Left Arrow on Card Image */}
                          {hasMultiFiles && asset.files!.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrevImage(asset.id, asset.files!.length);
                              }}
                              style={{
                                position: 'absolute',
                                left: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#ffffff',
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                              }}
                            >
                              ‹
                            </button>
                          )}

                          {/* Floating Right Arrow on Card Image */}
                          {hasMultiFiles && asset.files!.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNextImage(asset.id, asset.files!.length);
                              }}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#ffffff',
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                              }}
                            >
                              ›
                            </button>
                          )}

                          {/* Zoom button */}
                          <div
                            onClick={() => setLightboxData({ asset, index: activeIndex })}
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(0,0,0,0.65)',
                              backdropFilter: 'blur(4px)',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              color: '#ffffff',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            🔍 Zoom
                          </div>
                        </div>

                        {/* Dots & Indicator */}
                        {hasMultiFiles && asset.files!.length > 1 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              marginTop: '8px',
                            }}
                          >
                            {asset.files!.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCardImageIndices({ ...cardImageIndices, [asset.id]: idx })}
                                style={{
                                  width: idx === activeIndex ? '18px' : '7px',
                                  height: '7px',
                                  borderRadius: '4px',
                                  background: idx === activeIndex ? '#818cf8' : 'rgba(255,255,255,0.2)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                }}
                              />
                            ))}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              {activeIndex + 1}/{asset.files!.length}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {asset.title}
                    </h3>

                    {/* Usage Instructions (Internal note for reps) */}
                    {asset.description && (
                      <div style={{ marginBottom: '10px' }}>
                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                            lineHeight: '1.45',
                            margin: 0,
                            fontStyle: 'italic',
                            ...(expandedInstructions[asset.id]
                              ? { whiteSpace: 'pre-line' }
                              : {
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }),
                          }}
                        >
                          💡 {asset.description}
                        </p>
                        {(asset.description.length > 80 || asset.description.includes('\n')) && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInstructions((prev) => ({
                                ...prev,
                                [asset.id]: !prev[asset.id],
                              }))
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#818cf8',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '3px 0 0 0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            {expandedInstructions[asset.id] ? 'Show less ▲' : 'Show full instructions ▼'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 2. STYLED MONOSPACE BODY TEXT BOX WITH COPY BUTTON (ACROSS ALL TYPES) */}
                    {bodyCopy && (
                      <div
                        style={{
                          position: 'relative',
                          padding: '12px 14px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          border: '1px dashed rgba(99, 102, 241, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          color: '#cbd5e1',
                          flex: asset.file_type === 'text' ? 1 : 'none',
                          minHeight: asset.file_type === 'text' ? '180px' : 'auto',
                          maxHeight: asset.file_type === 'text' ? '300px' : '110px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          lineHeight: '1.5',
                          marginBottom: '6px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => copyToClipboard(bodyCopy, 'outreach copy')}
                          title="Copy message copy"
                          style={{
                            position: 'sticky',
                            top: '0',
                            float: 'right',
                            marginLeft: '8px',
                            background: 'rgba(99, 102, 241, 0.25)',
                            color: '#c7d2fe',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            zIndex: 1,
                          }}
                        >
                          📋 Copy Text
                        </button>
                        {bodyCopy}
                      </div>
                    )}
                  </div>

                  {/* Card Action Buttons Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      {asset.file_type === 'image' ? (
                        <>
                          {hasMultiFiles && asset.files!.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setDownloadPromptAsset(asset)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <span>📥</span>
                              <span>Download ({asset.files!.length})</span>
                            </button>
                          ) : (
                            <a
                              href={`${activeImageUrl}&download=true`}
                              download
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <span>📥</span>
                              <span>Download</span>
                            </a>
                          )}

                          <button
                            onClick={() => setLightboxData({ asset, index: activeIndex })}
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            👁️ View
                          </button>
                        </>
                      ) : asset.file_type === 'pdf' ? (
                        <>
                          <a
                            href={`${asset.content_url}?download=true`}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            download
                          >
                            <span>📥</span>
                            <span>Download PDF</span>
                          </a>
                          <a
                            href={asset.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            👁️ Open ↗
                          </a>
                        </>
                      ) : asset.file_type === 'video_link' ? (
                        <>
                          <button
                            onClick={() => copyToClipboard(asset.content_url, 'video link')}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1 }}
                          >
                            🔗 Copy Link
                          </button>
                          <a
                            href={asset.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            ▶ Watch ↗
                          </a>
                        </>
                      ) : (
                        <button
                          onClick={() => copyToClipboard(bodyCopy || '', 'pitch template')}
                          className="btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.82rem', width: '100%' }}
                        >
                          📋 Copy Pitch Script
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: BUSINESS & COMMISSIONS */}
        {activeTab === 'business' && (
          <ActorBusinessLedger
            roleTitle="Promoter • Business & Commissions"
            roleColor="var(--role-promoter-color)"
          />
        )}

        {/* DOWNLOAD MULTI-IMAGE PROMPT MODAL */}
        {downloadPromptAsset && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5, 8, 16, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1200,
              padding: '20px',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '28px',
                boxShadow: 'var(--shadow-lg)',
                animation: 'slideUp 0.2s ease',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Download Asset Images</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                This asset contains <strong>{downloadPromptAsset.files?.length || 1} images</strong>. Which would you like to download?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href={`${downloadPromptAsset.files?.[cardImageIndices[downloadPromptAsset.id] || 0]?.url || downloadPromptAsset.content_url}&download=true`}
                  download
                  onClick={() => setDownloadPromptAsset(null)}
                  className="btn-primary"
                  style={{ padding: '12px', textAlign: 'center', textDecoration: 'none', fontSize: '0.9rem' }}
                >
                  📥 Download Current Image ({ (cardImageIndices[downloadPromptAsset.id] || 0) + 1 })
                </a>

                <button
                  onClick={() => handleDownloadAll(downloadPromptAsset)}
                  className="btn-secondary"
                  style={{ padding: '12px', fontSize: '0.9rem', color: '#c7d2fe', borderColor: '#818cf8' }}
                >
                  📦 Download All ({downloadPromptAsset.files?.length || 1} Images)
                </button>

                <button
                  type="button"
                  onClick={() => setDownloadPromptAsset(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    padding: '8px',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REFERRAL DETAILS MODAL (PROMOTER VIEW - CONTACT MASKED & TEAM VISIBLE) */}
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
                maxWidth: '620px',
                maxHeight: '90vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                padding: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="user-code-pill" style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
                      {selectedEnquiry.enquiry_code}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Received: {new Date(selectedEnquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Celebration Banner if Won */}
              {(selectedEnquiry.lead_status || '').toLowerCase() === 'won' && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#34d399', fontSize: '1rem' }}>
                    <span>🎉</span>
                    <span>Deal Won & Contract Executed!</span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: '#e2e8f0', margin: 0, lineHeight: 1.45 }}>
                    This institution has signed a contract with Schoolites. Your commission payout is tracked in your Business & Splits dashboard.
                  </p>
                  <div>
                    <Link
                      href="/business"
                      className="btn-primary"
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.82rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        background: '#10b981',
                      }}
                    >
                      <span>View in Business Page</span>
                      <span>↗</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Dual-Stage Status Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Enquiry Stage
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                    {selectedEnquiry.status === 'converted_to_lead' ? (
                      <span style={{ color: '#34d399' }}>✅ Converted to Lead</span>
                    ) : selectedEnquiry.status === 'in_discussion' ? (
                      <span style={{ color: '#c084fc' }}>💬 In Discussion</span>
                    ) : selectedEnquiry.status === 'contacted' ? (
                      <span style={{ color: '#fbbf24' }}>📞 Contacted</span>
                    ) : selectedEnquiry.status === 'discarded' ? (
                      <span style={{ color: '#f87171' }}>✕ Discarded</span>
                    ) : (
                      <span style={{ color: '#38bdf8' }}>✨ New Inbound</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Lead Stage
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                    {(selectedEnquiry.lead_status || '').toLowerCase() === 'won' ? (
                      <span style={{ color: '#34d399' }}>🎉 Won / Closed</span>
                    ) : (selectedEnquiry.lead_status || '').toLowerCase() === 'lost' ? (
                      <span style={{ color: '#f87171' }}>❌ Lost</span>
                    ) : selectedEnquiry.status === 'converted_to_lead' ? (
                      <span style={{ color: '#818cf8' }}>
                        🎯 {selectedEnquiry.lead_status?.replace(/_/g, ' ') || 'Active Lead Pipeline'}
                        {selectedEnquiry.lead_code && ` (${selectedEnquiry.lead_code})`}
                      </span>
                    ) : selectedEnquiry.status === 'discarded' ? (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        ⏳ Pending Manager Assignment
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Institution Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Institution Type</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEnquiry.institute_type || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Location</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedEnquiry.city ? `${selectedEnquiry.city}, ` : ''}{selectedEnquiry.country || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Student Strength</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEnquiry.student_count || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Website</div>
                  <div style={{ fontSize: '0.9rem', color: '#38bdf8' }}>
                    {selectedEnquiry.website ? (
                      <a href={selectedEnquiry.website.startsWith('http') ? selectedEnquiry.website : `https://${selectedEnquiry.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                        Visit Site ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {/* Institution Message / Inbound Requirement */}
              {selectedEnquiry.message && (
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Applicant Notes / Request</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: 1.45 }}>
                    "{selectedEnquiry.message}"
                  </p>
                </div>
              )}

              {/* Contact Governance & Privacy Protection */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Institutional SPOC</div>
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 Qualified by CRM Ops
                  </span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {selectedEnquiry.spoc_name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>📞 Phone: <span style={{ fontFamily: 'monospace' }}>{selectedEnquiry.phone || 'Protected'}</span></span>
                  {selectedEnquiry.email && <span>✉️ Email: <span style={{ fontFamily: 'monospace' }}>{selectedEnquiry.email}</span></span>}
                </div>
              </div>

              {/* Cross-Actor Team Attribution */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Involved Actors</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Promoter (You)</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--role-promoter-color)' }}>
                      {user?.user_code}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Owner</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: selectedEnquiry.owner_name ? '#818cf8' : 'var(--text-muted)' }}>
                      {selectedEnquiry.owner_name ? `${selectedEnquiry.owner_name} (${selectedEnquiry.owner_code})` : 'Pending'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Manager</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: selectedEnquiry.manager_name ? 'var(--role-business-color)' : 'var(--text-muted)' }}>
                      {selectedEnquiry.manager_name ? `${selectedEnquiry.manager_name} (${selectedEnquiry.manager_code})` : 'Pending'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 20px', fontSize: '0.88rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIGHTBOX MODAL */}
        {lightboxData && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(3, 7, 18, 0.94)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '24px',
            }}
            onClick={() => setLightboxData(null)}
          >
            <div
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                  {lightboxData.asset.title}
                  {Array.isArray(lightboxData.asset.files) && lightboxData.asset.files.length > 1 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '10px' }}>
                      ({lightboxData.index + 1} of {lightboxData.asset.files.length})
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setLightboxData(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '1.2rem',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={
                    lightboxData.asset.files && lightboxData.asset.files.length > 0
                      ? lightboxData.asset.files[lightboxData.index]?.url
                      : lightboxData.asset.content_url
                  }
                  alt={lightboxData.asset.title}
                  style={{
                    maxWidth: '85vw',
                    maxHeight: '75vh',
                    borderRadius: '10px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                    objectFit: 'contain',
                  }}
                />

                {Array.isArray(lightboxData.asset.files) && lightboxData.asset.files.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxData({
                          asset: lightboxData.asset,
                          index: (lightboxData.index - 1 + lightboxData.asset.files!.length) % lightboxData.asset.files!.length,
                        });
                      }}
                      style={{
                        position: 'absolute',
                        left: '-48px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '1.8rem',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxData({
                          asset: lightboxData.asset,
                          index: (lightboxData.index + 1) % lightboxData.asset.files!.length,
                        });
                      }}
                      style={{
                        position: 'absolute',
                        right: '-48px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '1.8rem',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ActorShell>
  );
}
