'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CreateLeadModal from '@/components/CreateLeadModal';
import LeadDetailModal from '@/components/LeadDetailModal';
import LeadTableControls from '@/components/LeadTableControls';
import ActorShell, { NavItem } from '@/components/ActorShell';
import { formatSlotDate, formatSlotTime, getSlotModeIcon } from '@/lib/slotFormat';
import { LEAD_STATUSES, getStatusMeta } from '@/lib/leadStatuses';

interface Enquiry {
  id: string;
  enquiry_code: string;
  spoc_name: string;
  phone: string;
  email: string | null;
  institute_type: string | null;
  institute_name: string | null;
  country: string | null;
  city: string | null;
  student_count: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'converted_to_lead' | 'discarded';
  created_at: string;
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
  storage_key?: string | null;
  files?: StoredFile[];
  description: string | null;
}

interface PartnerWorkspaceProps {
  roleTitle: string;
  roleBadgeClass: 'pre_sales' | 'referral';
  roleColor: string;
}

export default function PartnerWorkspace({ roleTitle, roleBadgeClass, roleColor }: PartnerWorkspaceProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [myLeads, setMyLeads] = useState<any[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeTab, setActiveTab] = useState<'enquiries' | 'leads' | 'assets'>('enquiries');
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // Leads Filter & Sort State with sessionStorage persistence
  const [leadSearch, setLeadSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('partner_leads_search') || '';
      } catch {}
    }
    return '';
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('partner_leads_statuses');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('partner_leads_sort') || 'created_desc';
      } catch {}
    }
    return 'created_desc';
  });

  const [columnSort, setColumnSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Asset Carousel & Lightbox States
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [lightboxData, setLightboxData] = useState<{ asset: Asset; index: number } | null>(null);
  const [downloadPromptAsset, setDownloadPromptAsset] = useState<Asset | null>(null);
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});

  // Modals
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [enquiryToConvert, setEnquiryToConvert] = useState<Enquiry | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Persist filter preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('partner_leads_search', leadSearch);
        sessionStorage.setItem('partner_leads_statuses', JSON.stringify(selectedStatuses));
        sessionStorage.setItem('partner_leads_sort', sortBy);
      } catch {}
    }
  }, [leadSearch, selectedStatuses, sortBy]);

  const fetchEnquiries = async () => {
    try {
      const res = await fetch('/api/enquiries');
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyLeads = async () => {
    try {
      const params = new URLSearchParams();
      params.append('view', 'created_by_me');
      if (leadSearch.trim()) params.append('search', leadSearch.trim());
      if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','));
      params.append('sort_by', sortBy);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMyLeads(data.leads || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Refetch leads when tab or search/filter changes
  useEffect(() => {
    if (activeTab === 'leads') {
      const timer = setTimeout(() => {
        fetchMyLeads();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, leadSearch, selectedStatuses, sortBy]);

  // Column Header Sorting
  const sortedMyLeads = useMemo(() => {
    if (!columnSort) return myLeads;
    const sorted = [...myLeads];
    const { column, direction } = columnSort;
    const modifier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      if (column === 'lead_code') return a.lead_code.localeCompare(b.lead_code) * modifier;
      if (column === 'institute') return a.institute_name.localeCompare(b.institute_name) * modifier;
      if (column === 'slot') return (a.preferred_slot_date || '').localeCompare(b.preferred_slot_date || '') * modifier;
      if (column === 'status') return (a.status || '').localeCompare(b.status || '') * modifier;
      if (column === 'manager') return (a.manager_name || 'Unassigned').localeCompare(b.manager_name || 'Unassigned') * modifier;
      return 0;
    });
    return sorted;
  }, [myLeads, columnSort]);

  const handleToggleColumnSort = (col: string) => {
    if (columnSort?.column === col) {
      if (columnSort.direction === 'asc') {
        setColumnSort({ column: col, direction: 'desc' });
      } else {
        setColumnSort(null);
      }
    } else {
      setColumnSort({ column: col, direction: 'asc' });
    }
  };

  const handleClearAll = () => {
    setLeadSearch('');
    setSelectedStatuses([]);
    setSortBy('created_desc');
    setColumnSort(null);
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        setUser(data.user);
        fetchEnquiries();
        fetchMyLeads();
        fetchAssets();
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleUpdateStatus = async (enquiryId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setToastMsg(`Enquiry marked as ${newStatus}.`);
        setTimeout(() => setToastMsg(''), 3000);
        fetchEnquiries();
        if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
          setSelectedEnquiry({ ...selectedEnquiry, status: newStatus as any });
        }
      }
    } catch {
      alert('Failed to update status');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToastMsg(`Copied ${label} to clipboard!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleLeadSuccess = (newLead: any, duplicateWarning?: string) => {
    setToastMsg(
      duplicateWarning
        ? `Lead ${newLead.lead_code} created! ⚠️ ${duplicateWarning}`
        : `Lead ${newLead.lead_code} created successfully for Business Relations team!`
    );
    setTimeout(() => setToastMsg(''), 5000);
    fetchEnquiries();
    fetchMyLeads();
    setEnquiryToConvert(null);
  };

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


  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
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
          Loading Workspace...
        </div>
      </div>
    );
  }

  const publicLink = typeof window !== 'undefined'
    ? `${window.location.origin}/e/${user?.user_code}`
    : `http://localhost:3000/e/${user?.user_code}`;

  const statusColorMap: Record<string, string> = {
    unassigned: '#f59e0b',
    assigned: '#38bdf8',
    in_discussion: '#818cf8',
    proposal_sent: '#c084fc',
    won: '#34d399',
    lost: '#f87171',
  };

  const navItems: NavItem[] = [
    {
      id: 'assets',
      label: 'Marketing Assets',
      icon: '📁',
      badge: assets.length > 0 ? assets.length : undefined,
      isActive: activeTab === 'assets',
      onClick: () => setActiveTab('assets'),
    },
    {
      id: 'enquiries',
      label: 'Inbound Enquiries',
      icon: '📥',
      badge: enquiries.length > 0 ? enquiries.length : undefined,
      isActive: activeTab === 'enquiries',
      onClick: () => setActiveTab('enquiries'),
    },
    {
      id: 'leads',
      label: 'My Generated Leads',
      icon: '🎯',
      badge: myLeads.length > 0 ? myLeads.length : undefined,
      isActive: activeTab === 'leads',
      onClick: () => setActiveTab('leads'),
    },
  ];

  const activeTabTitles: Record<string, string> = {
    assets: 'Marketing Assets Hub',
    enquiries: 'Inbound Enquiries',
    leads: 'My Generated Leads',
  };

  return (
    <ActorShell
      user={user}
      roleTitle={roleTitle}
      roleBadgeClass={roleBadgeClass}
      roleColor={roleColor}
      navItems={navItems}
      activeTabTitle={activeTabTitles[activeTab]}
      headerActions={
        <button
          onClick={() => {
            setEnquiryToConvert(null);
            setIsLeadModalOpen(true);
          }}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.86rem' }}
        >
          + Create Lead
        </button>
      }
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
              borderLeft: `4px solid ${roleColor}`,
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
                <span>{publicLink}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => copyToClipboard(publicLink, 'your unique referral link')}
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

      {/* TAB 1: ENQUIRIES INBOX */}
      {activeTab === 'enquiries' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Inbound Lead Enquiries</h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Total Received: <strong>{enquiries.length}</strong>
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
                    SPOC / Contact
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Institution Info
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Status
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
                      No enquiries received yet. Share your unique referral link to start capturing leads!
                    </td>
                  </tr>
                ) : (
                  enquiries.map((enq) => (
                    <tr
                      key={enq.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div className="user-code-pill" style={{ color: '#38bdf8', marginBottom: '4px' }}>
                          {enq.enquiry_code}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{enq.spoc_name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>📞 {enq.phone}</div>
                        {enq.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>✉️ {enq.email}</div>}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{enq.institute_name || enq.institute_type}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {enq.city ? `${enq.city} • ` : ''}{enq.student_count ? `${enq.student_count} Students` : ''}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: enq.status === 'new' ? 'rgba(56, 189, 248, 0.15)' : enq.status === 'contacted' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                            color: enq.status === 'new' ? '#38bdf8' : enq.status === 'contacted' ? '#fbbf24' : '#34d399',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          ● {enq.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedEnquiry(enq)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            Details
                          </button>

                          {enq.status !== 'converted_to_lead' && (
                            <button
                              onClick={() => {
                                setEnquiryToConvert(enq);
                                setIsLeadModalOpen(true);
                              }}
                              className="btn-primary"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              }}
                            >
                              Convert to Lead ➔
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MY CREATED LEADS */}
      {activeTab === 'leads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Lead Table Controls */}
          <LeadTableControls
            search={leadSearch}
            onSearchChange={setLeadSearch}
            selectedStatuses={selectedStatuses}
            onStatusesChange={setSelectedStatuses}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onClearAll={handleClearAll}
            placeholder="Search by code, institute, city, SPOC, phone, email, manager..."
            totalCount={myLeads.length}
            filteredCount={sortedMyLeads.length}
          />

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>My Pipeline Leads Tracker</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Total Created: <strong>{myLeads.length}</strong>
              </span>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th
                      onClick={() => handleToggleColumnSort('lead_code')}
                      style={{
                        padding: '14px 20px',
                        fontWeight: 600,
                        color: columnSort?.column === 'lead_code' ? '#818cf8' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to sort by Lead Code"
                    >
                      Lead Code {columnSort?.column === 'lead_code' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th
                      onClick={() => handleToggleColumnSort('institute')}
                      style={{
                        padding: '14px 20px',
                        fontWeight: 600,
                        color: columnSort?.column === 'institute' ? '#818cf8' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to sort by Institution Name"
                    >
                      Institution {columnSort?.column === 'institute' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th
                      onClick={() => handleToggleColumnSort('slot')}
                      style={{
                        padding: '14px 20px',
                        fontWeight: 600,
                        color: columnSort?.column === 'slot' ? '#818cf8' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to sort by Preferred Connect Slot"
                    >
                      Preferred Connect Slot {columnSort?.column === 'slot' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th
                      onClick={() => handleToggleColumnSort('status')}
                      style={{
                        padding: '14px 20px',
                        fontWeight: 600,
                        color: columnSort?.column === 'status' ? '#818cf8' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to sort by Stage Status"
                    >
                      Stage Status {columnSort?.column === 'status' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th
                      onClick={() => handleToggleColumnSort('manager')}
                      style={{
                        padding: '14px 20px',
                        fontWeight: 600,
                        color: columnSort?.column === 'manager' ? '#818cf8' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to sort by Lead Manager"
                    >
                      Lead Manager {columnSort?.column === 'manager' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMyLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No leads found matching your criteria. Convert an enquiry or click "+ Create Lead" to start!
                      </td>
                    </tr>
                  ) : (
                    sortedMyLeads.map((lead) => (
                      <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <span className="user-code-pill" style={{ color: '#818cf8' }}>{lead.lead_code}</span>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 600 }}>{lead.institute_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.city} • {lead.institute_type}</div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          {lead.preferred_slot_date || lead.preferred_slot_time || lead.preferred_slot_mode ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                                {[formatSlotDate(lead.preferred_slot_date), formatSlotTime(lead.preferred_slot_time)].filter(Boolean).join(' • ') || 'Flexible Timing'}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>{getSlotModeIcon(lead.preferred_slot_mode)}</span>
                                <span>{lead.preferred_slot_mode || 'Phone/WhatsApp Call'}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— Not specified</span>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          {(() => {
                            const meta = getStatusMeta(lead.status);
                            return (
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  color: meta.color,
                                  background: meta.bgColor,
                                  border: `1px solid ${meta.borderColor}`,
                                }}
                              >
                                ● {meta.label}
                              </span>
                            );
                          })()}
                        </td>

                      <td style={{ padding: '16px 20px' }}>
                        {lead.manager_name ? (
                          <div>
                            <strong>{lead.manager_name}</strong>
                            <span className="user-code-pill" style={{ marginLeft: '6px', fontSize: '0.75rem' }}>{lead.manager_code}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600 }}>In Unassigned Pool</span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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
        </div>
      )}

      {/* TAB 3: MARKETING ASSETS */}
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


      {/* CREATE LEAD MODAL */}
      <CreateLeadModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false);
          setEnquiryToConvert(null);
        }}
        onSuccess={handleLeadSuccess}
        initialEnquiry={enquiryToConvert}
      />

      {/* LEAD DETAIL MODAL */}
      <LeadDetailModal
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={fetchMyLeads}
        currentUser={user}
      />

      {/* Multi-Download Choice Modal */}
      {downloadPromptAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
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

      {/* Lightbox Modal */}
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

      {/* ENQUIRY DETAILS MODAL */}
      {selectedEnquiry && (

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="user-code-pill" style={{ color: '#38bdf8' }}>{selectedEnquiry.enquiry_code}</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px' }}>Enquiry Details</h2>
              </div>
              <button onClick={() => setSelectedEnquiry(null)} style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem', marginBottom: '24px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>SPOC / Contact Person</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedEnquiry.spoc_name}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Phone</span>
                  <strong>{selectedEnquiry.phone}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Email</span>
                  <strong>{selectedEnquiry.email || '—'}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Institute Type</span>
                  <strong>{selectedEnquiry.institute_type || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Institute Name</span>
                  <strong>{selectedEnquiry.institute_name || '—'}</strong>
                </div>
              </div>

              {selectedEnquiry.message && (
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Requirements / Message</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedEnquiry.message}</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setSelectedEnquiry(null)} className="btn-secondary">
                Close
              </button>

              {selectedEnquiry.status !== 'converted_to_lead' && (
                <button
                  onClick={() => {
                    const enq = selectedEnquiry;
                    setSelectedEnquiry(null);
                    setEnquiryToConvert(enq);
                    setIsLeadModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  Convert to Pipeline Lead ➔
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </ActorShell>
  );
}
