'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CreateLeadModal from '@/components/CreateLeadModal';
import LeadDetailModal from '@/components/LeadDetailModal';
import LeadTableControls from '@/components/LeadTableControls';
import ActorShell, { NavItem } from '@/components/ActorShell';
import { formatSlotDate, formatSlotTime, getSlotModeIcon } from '@/lib/slotFormat';
import { LEAD_STATUSES, getStatusMeta } from '@/lib/leadStatuses';

interface Lead {
  id: string;
  lead_code: string;
  institute_name: string;
  institute_type: string;
  city: string;
  country: string;
  student_strength: string;
  spoc_name: string;
  spoc_phone: string;
  status: string;
  deal_value: number;
  is_duplicate: boolean;
  duplicate_flag_cleared: boolean;
  owner_name: string;
  owner_code: string;
  manager_name: string | null;
  manager_code: string | null;
  preferred_slot_date?: string | null;
  preferred_slot_time?: string | null;
  preferred_slot_mode?: string | null;
  created_at: string;
}

interface Enquiry {
  id: string;
  enquiry_code: string;
  spoc_name: string;
  phone: string;
  email: string | null;
  institute_type: string;
  institute_name: string | null;
  country: string;
  city: string | null;
  student_count: string | null;
  website: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified' | 'converted_to_lead';
  converted_lead_id: string | null;
  created_at: string;
}

interface AssetFile {
  url: string;
  storage_key?: string;
  name: string;
  size: number;
  mime_type: string;
}

interface Asset {
  id: string;
  title: string;
  description?: string;
  file_type: 'image' | 'pdf' | 'video_link' | 'text';
  category: 'Pitch Template' | 'Brochure' | 'Presentation' | 'Social Post';
  content_url?: string;
  body_text?: string;
  files?: AssetFile[];
  created_at: string;
}

type TabType = 'unassigned' | 'my' | 'all' | 'created_by_me' | 'enquiries' | 'assets';

export default function BusinessRelationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('unassigned');
  
  // Search, Status Filter & Sorting State with sessionStorage persistence
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('br_leads_search');
        if (saved) return saved;
      } catch {}
    }
    return '';
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('br_leads_statuses');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('br_leads_sort');
        if (saved) return saved;
      } catch {}
    }
    return 'created_desc';
  });

  const [columnSort, setColumnSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Leads Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [myCreatedCount, setMyCreatedCount] = useState(0);

  // Enquiries Data
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [enquiryToConvert, setEnquiryToConvert] = useState<Enquiry | null>(null);

  // Marketing Assets Data
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('All');
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [expandedCardInstructions, setExpandedCardInstructions] = useState<Record<string, boolean>>({});
  const [downloadPromptAsset, setDownloadPromptAsset] = useState<Asset | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);

  // Concurrency-safe Grabbing state
  const [grabbingLeadId, setGrabbingLeadId] = useState<string | null>(null);

  // Persist filter preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('br_leads_search', search);
        sessionStorage.setItem('br_leads_statuses', JSON.stringify(selectedStatuses));
        sessionStorage.setItem('br_leads_sort', sortBy);
      } catch {}
    }
  }, [search, selectedStatuses, sortBy]);

  // 1. Fetch Leads
  const fetchLeads = async () => {
    try {
      const isLeadTab = ['unassigned', 'my', 'all', 'created_by_me'].includes(activeTab);
      if (isLeadTab) setLoading(true);

      const params = new URLSearchParams();
      const viewParam = isLeadTab ? activeTab : 'my';
      params.append('view', viewParam);
      if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','));
      params.append('sort_by', sortBy);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      setLoading(false);
    }
  };

  // Column Header Sorting
  const sortedLeads = useMemo(() => {
    if (!columnSort) return leads;
    const sorted = [...leads];
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
  }, [leads, columnSort]);

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
    setSearch('');
    setSelectedStatuses([]);
    setSortBy('created_desc');
    setColumnSort(null);
  };

  // 2. Fetch Enquiries
  const fetchEnquiries = async () => {
    try {
      const res = await fetch('/api/enquiries');
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.error('Failed to fetch enquiries', err);
    }
  };

  // 3. Fetch Marketing Assets
  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to fetch assets', err);
    }
  };

  // 4. Initial Auth & Parallel Fetching
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
        fetchAssets();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Load available BR team members for reassignment
  useEffect(() => {
    fetch('/api/admin/users?role=business_relations')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAvailableManagers(data.users || []))
      .catch(() => {});
  }, []);

  // Track My Created Leads count in background
  useEffect(() => {
    if (user?.id) {
      fetch('/api/leads?view=created_by_me')
        .then((res) => (res.ok ? res.json() : { leads: [] }))
        .then((data) => setMyCreatedCount((data.leads || []).length))
        .catch(() => {});
    }
  }, [user]);

  // Refetch leads when tab, filter, sort, or search changes
  useEffect(() => {
    if (['unassigned', 'my', 'all', 'created_by_me'].includes(activeTab)) {
      const timer = setTimeout(() => {
        fetchLeads();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, selectedStatuses, sortBy, search]);

  const handleGrabLead = async (leadId: string, leadCode: string) => {
    setGrabbingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/grab`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to grab lead.');
        fetchLeads();
        return;
      }

      setToastMsg(`Lead ${leadCode} successfully claimed! Moved to 'Assigned to Me'.`);
      setTimeout(() => setToastMsg(''), 4000);
      fetchLeads();
    } catch {
      alert('Error claiming lead.');
    } finally {
      setGrabbingLeadId(null);
    }
  };

  const handleLeadCreatedSuccess = (newLead: any, duplicateWarning?: string) => {
    setToastMsg(
      duplicateWarning
        ? `Lead ${newLead.lead_code} created! ⚠️ ${duplicateWarning}`
        : `Lead ${newLead.lead_code} created successfully!`
    );
    setTimeout(() => setToastMsg(''), 5000);
    fetchLeads();
    fetchEnquiries();
    setEnquiryToConvert(null);
  };

  const handleUpdateEnquiryStatus = async (enquiryId: string, newStatus: string) => {
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

  // Nav items organized with section headers
  const navItems: NavItem[] = [
    // Section 1: GLOBAL PIPELINE
    {
      id: 'unassigned',
      section: 'Global Pipeline',
      label: 'Unassigned Pool',
      icon: '⚡',
      badge: leads.filter((l) => l.status === 'unassigned').length || undefined,
      isActive: activeTab === 'unassigned',
      onClick: () => {
        setActiveTab('unassigned');
        setSelectedStatuses([]);
      },
    },
    {
      id: 'my',
      section: 'Global Pipeline',
      label: 'Assigned to Me',
      icon: '🎯',
      badge: leads.filter((l) => l.manager_name && l.manager_name === user?.name).length || undefined,
      isActive: activeTab === 'my',
      onClick: () => {
        setActiveTab('my');
        setSelectedStatuses([]);
      },
    },
    {
      id: 'all',
      section: 'Global Pipeline',
      label: 'All Leads Directory',
      icon: '🌐',
      isActive: activeTab === 'all',
      onClick: () => {
        setActiveTab('all');
        setSelectedStatuses([]);
      },
    },

    // Section 2: MY DIRECT SOURCING & INBOUND
    {
      id: 'created_by_me',
      section: 'My Direct Sourcing',
      label: 'My Generated Leads',
      icon: '📝',
      badge: myCreatedCount || undefined,
      isActive: activeTab === 'created_by_me',
      onClick: () => {
        setActiveTab('created_by_me');
        setSelectedStatuses([]);
      },
    },
    {
      id: 'enquiries',
      section: 'My Direct Sourcing',
      label: 'Inbound Enquiries',
      icon: '📥',
      badge: enquiries.filter((e) => e.status === 'new').length || undefined,
      isActive: activeTab === 'enquiries',
      onClick: () => setActiveTab('enquiries'),
    },
    {
      id: 'assets',
      section: 'My Direct Sourcing',
      label: 'Marketing Assets',
      icon: '📁',
      badge: assets.length || undefined,
      isActive: activeTab === 'assets',
      onClick: () => setActiveTab('assets'),
    },
  ];

  const activeTabLabels: Record<TabType, string> = {
    unassigned: 'Unassigned Opportunity Pool',
    my: 'Assigned to Me (My Active Opportunities)',
    all: 'All Institutional Leads Directory',
    created_by_me: 'My Generated Leads Tracker',
    enquiries: 'Inbound Lead Enquiries',
    assets: 'Marketing Assets Hub',
  };

  const isLeadsView = ['unassigned', 'my', 'all', 'created_by_me'].includes(activeTab);

  return (
    <ActorShell
      user={user}
      roleTitle="Business Relations Portal"
      roleBadgeClass="business_relations"
      roleColor="var(--role-business-color)"
      navItems={navItems}
      activeTabTitle={activeTabLabels[activeTab]}
      headerActions={
        <button
          onClick={() => {
            setEnquiryToConvert(null);
            setIsCreateModalOpen(true);
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

        {/* 1. LEADS PIPELINE VIEWS (Unassigned, Assigned to Me, All Leads, My Generated) */}
        {isLeadsView && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Top Control Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {activeTab === 'unassigned' && '⚡ Unassigned Opportunity Pool'}
                  {activeTab === 'my' && '🎯 Assigned to Me (My Active Opportunities)'}
                  {activeTab === 'all' && '🌐 All Institutional Leads Directory'}
                  {activeTab === 'created_by_me' && '📝 My Generated Leads Tracker'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {activeTab === 'unassigned' && 'Claim qualified leads on first-come-first-served basis to begin sales discussions'}
                  {activeTab === 'my' && 'Track progress through discovery, presentation, and contract closure'}
                  {activeTab === 'all' && 'Complete visibility across all organizational leads'}
                  {activeTab === 'created_by_me' && 'Leads originated directly by you with closing status and incentive tracking'}
                </p>
              </div>

            </div>

            {/* Reusable Lead Table Controls (Search, Status Checkboxes, Sort Dropdown, Clear All) */}
            <LeadTableControls
              search={search}
              onSearchChange={setSearch}
              selectedStatuses={selectedStatuses}
              onStatusesChange={setSelectedStatuses}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onClearAll={handleClearAll}
              placeholder="Search by code, institute, city, SPOC, phone, email, manager..."
              totalCount={leads.length}
              filteredCount={sortedLeads.length}
            />

            {/* Leads Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
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
                        Lead Code & Owner {columnSort?.column === 'lead_code' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
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
                        Institution & City {columnSort?.column === 'institute' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
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
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Loading pipeline...
                        </td>
                      </tr>
                    ) : sortedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {activeTab === 'unassigned'
                            ? 'No unassigned leads in the pool right now. Check back soon!'
                            : activeTab === 'created_by_me'
                            ? 'You have not originated any leads directly yet. Click "+ Create Lead" to add one!'
                            : 'No leads found matching your criteria.'}
                        </td>
                      </tr>
                    ) : (
                      sortedLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span className="user-code-pill" style={{ color: '#818cf8' }}>
                                {lead.lead_code}
                              </span>
                              {lead.is_duplicate && !lead.duplicate_flag_cleared && (
                                <span title="Duplicate detected" style={{ fontSize: '0.85rem' }}>⚠️</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Lead Owner: {lead.owner_code} ({lead.owner_name})
                            </div>
                          </td>

                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.institute_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {lead.institute_type} • {lead.city} • {lead.student_strength} students
                            </div>
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
                              <div style={{ fontSize: '0.88rem' }}>
                                <strong>{lead.manager_name}</strong>
                                <span className="user-code-pill" style={{ marginLeft: '6px', fontSize: '0.75rem' }}>{lead.manager_code}</span>
                              </div>
                            ) : (
                              <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>Available in Pool</span>
                            )}
                          </td>

                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              {activeTab === 'unassigned' && !lead.manager_name && (
                                <button
                                  onClick={() => handleGrabLead(lead.id, lead.lead_code)}
                                  disabled={grabbingLeadId === lead.id}
                                  className="btn-primary"
                                  style={{
                                    padding: '6px 14px',
                                    fontSize: '0.82rem',
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                                  }}
                                >
                                  {grabbingLeadId === lead.id ? 'Claiming...' : 'Grab Lead ⚡'}
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="btn-secondary"
                                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                              >
                                View Details
                              </button>
                            </div>
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

        {/* 2. INBOUND ENQUIRIES VIEW */}
        {activeTab === 'enquiries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Referral Link Header Banner */}
            <div
              className="glass-panel"
              style={{
                padding: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔗</span> Your Direct Public Referral Link
                </h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '650px' }}>
                  Share this link publicly with prospective schools. All inbound enquiries submitted through this page are directly attributed to your account.
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle)',
                    marginTop: '10px',
                    fontSize: '0.86rem',
                    color: '#c7d2fe',
                    fontFamily: 'monospace',
                  }}
                >
                  <span>{publicLink}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => copyToClipboard(publicLink, 'your direct referral link')}
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

            {/* Enquiries Inbox Table */}
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
                          No enquiries received yet. Share your direct referral link to start capturing institutional leads!
                        </td>
                      </tr>
                    ) : (
                      enquiries.map((enq) => (
                        <tr key={enq.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
                                    setIsCreateModalOpen(true);
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
          </div>
        )}

        {/* 3. MARKETING ASSETS HUB VIEW */}
        {activeTab === 'assets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header / Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Marketing & Sales Collateral Hub</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Brochures, pitch templates, presentation decks, and video resources to share with prospective institutions.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['All', 'Pitch Template', 'Brochure', 'Presentation', 'Social Post'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAssetCategoryFilter(cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: assetCategoryFilter === cat ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: assetCategoryFilter === cat ? '#ffffff' : 'var(--text-secondary)',
                      border: assetCategoryFilter === cat ? '1px solid #818cf8' : '1px solid transparent',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Assets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
              {assets
                .filter((a) => assetCategoryFilter === 'All' || a.category === assetCategoryFilter)
                .map((asset) => {
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
                        {/* Category & Type Header */}
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

                        {/* Image Preview / Carousel */}
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
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                onClick={() => setLightboxImage(activeImageUrl || null)}
                              />

                              {hasMultiFiles && asset.files!.length > 1 && (
                                <>
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
                                      background: 'rgba(0,0,0,0.65)',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      color: '#fff',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ‹
                                  </button>
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
                                      background: 'rgba(0,0,0,0.65)',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      color: '#fff',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ›
                                  </button>
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: '8px',
                                      right: '8px',
                                      background: 'rgba(0,0,0,0.7)',
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      fontSize: '0.7rem',
                                      color: '#fff',
                                    }}
                                  >
                                    {activeIndex + 1}/{asset.files!.length}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Title */}
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px', color: '#fff' }}>
                          {asset.title}
                        </h3>

                        {/* Collapsible Rep Instructions */}
                        {asset.description && (
                          <div style={{ marginBottom: '12px' }}>
                            <p
                              style={{
                                fontSize: '0.82rem',
                                color: 'var(--text-muted)',
                                lineHeight: '1.4',
                                display: expandedCardInstructions[asset.id] ? 'block' : '-webkit-box',
                                WebkitLineClamp: expandedCardInstructions[asset.id] ? 'unset' : 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {asset.description}
                            </p>
                            {asset.description.length > 90 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCardInstructions((prev) => ({
                                    ...prev,
                                    [asset.id]: !prev[asset.id],
                                  }))
                                }
                                style={{
                                  fontSize: '0.74rem',
                                  color: '#818cf8',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px 0',
                                  marginTop: '2px',
                                  fontWeight: 600,
                                }}
                              >
                                {expandedCardInstructions[asset.id] ? 'Show less ▲' : 'Show full instructions ▼'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Body Pitch Text */}
                        {bodyCopy && (
                          <div
                            style={{
                              background: '#090d16',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '10px',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              color: '#94a3b8',
                              maxHeight: '140px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              marginBottom: '12px',
                              flex: 1,
                            }}
                          >
                            {bodyCopy}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {bodyCopy && (
                          <button
                            onClick={() => copyToClipboard(bodyCopy, 'outreach pitch message')}
                            className="btn-primary"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                          >
                            📋 Copy Text
                          </button>
                        )}

                        {asset.file_type === 'video_link' && asset.content_url && (
                          <a
                            href={asset.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}
                          >
                            ▶ Watch Video ↗
                          </a>
                        )}

                        {asset.file_type === 'pdf' && asset.content_url && (
                          <a
                            href={`${asset.content_url}&download=true`}
                            download
                            className="btn-secondary"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}
                          >
                            📄 Download PDF
                          </a>
                        )}

                        {asset.file_type === 'image' && hasMultiFiles && asset.files!.length > 1 && (
                          <button
                            onClick={() => setDownloadPromptAsset(asset)}
                            className="btn-secondary"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                          >
                            ⬇ Download ({asset.files!.length})
                          </button>
                        )}

                        {asset.file_type === 'image' && (!hasMultiFiles || asset.files!.length <= 1) && (
                          <a
                            href={`${activeImageUrl}&download=true`}
                            download
                            className="btn-secondary"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}
                          >
                            ⬇ Download Image
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* CREATE LEAD MODAL */}
        <CreateLeadModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEnquiryToConvert(null);
          }}
          onSuccess={handleLeadCreatedSuccess}
          initialEnquiry={enquiryToConvert}
        />

        {/* LEAD DETAIL MODAL */}
        <LeadDetailModal
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onLeadUpdated={fetchLeads}
          currentUser={user}
          availableManagers={availableManagers}
        />

        {/* ENQUIRY DETAILS MODAL */}
        {selectedEnquiry && (
          <div className="modal-backdrop">
            <div className="glass-panel modal-dialog" style={{ maxWidth: '540px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Enquiry {selectedEnquiry.enquiry_code}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Received on {new Date(selectedEnquiry.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <button onClick={() => setSelectedEnquiry(null)} style={{ fontSize: '1.3rem', color: 'var(--text-muted)' }}>
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: '4px' }}>Institution</div>
                  <div>{selectedEnquiry.institute_name || 'N/A'} ({selectedEnquiry.institute_type})</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {selectedEnquiry.city ? `${selectedEnquiry.city}, ` : ''}{selectedEnquiry.country}
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: '4px' }}>SPOC / Contact</div>
                  <div>{selectedEnquiry.spoc_name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📞 {selectedEnquiry.phone}</div>
                  {selectedEnquiry.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>✉️ {selectedEnquiry.email}</div>}
                </div>

                {selectedEnquiry.message && (
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: '4px' }}>Requirements / Note</div>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{selectedEnquiry.message}</div>
                  </div>
                )}

                {/* Status Updater */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Update Qualification Status
                  </label>
                  <select
                    value={selectedEnquiry.status}
                    onChange={(e) => handleUpdateEnquiryStatus(selectedEnquiry.id, e.target.value)}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="disqualified">Disqualified</option>
                    <option value="converted_to_lead" disabled>Converted to Lead</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button onClick={() => setSelectedEnquiry(null)} className="btn-secondary">
                  Close
                </button>
                {selectedEnquiry.status !== 'converted_to_lead' && (
                  <button
                    onClick={() => {
                      const enq = selectedEnquiry;
                      setSelectedEnquiry(null);
                      setEnquiryToConvert(enq);
                      setIsCreateModalOpen(true);
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

        {/* LIGHTBOX MODAL */}
        {lightboxImage && (
          <div
            className="modal-backdrop"
            onClick={() => setLightboxImage(null)}
            style={{ zIndex: 10000, background: 'rgba(0, 0, 0, 0.88)' }}
          >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
              <img
                src={lightboxImage}
                alt="Enlarged"
                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
              />
              <button
                onClick={() => setLightboxImage(null)}
                style={{
                  position: 'absolute',
                  top: '-36px',
                  right: '0',
                  color: '#fff',
                  fontSize: '1.4rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}

        {/* MULTI-FILE DOWNLOAD MODAL */}
        {downloadPromptAsset && (
          <div className="modal-backdrop" onClick={() => setDownloadPromptAsset(null)}>
            <div
              className="glass-panel modal-dialog"
              style={{ maxWidth: '420px', textAlign: 'center', padding: '24px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '8px' }}>
                Download Asset Images
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                This asset contains <strong>{downloadPromptAsset.files?.length}</strong> high-resolution images. How would you like to download them?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => handleDownloadAll(downloadPromptAsset)}
                  className="btn-primary"
                  style={{ padding: '10px', fontSize: '0.88rem' }}
                >
                  ⚡ Download All ({downloadPromptAsset.files?.length}) Files
                </button>
                <a
                  href={`${(downloadPromptAsset.files?.[cardImageIndices[downloadPromptAsset.id] || 0]?.url || downloadPromptAsset.content_url)}&download=true`}
                  download
                  onClick={() => setDownloadPromptAsset(null)}
                  className="btn-secondary"
                  style={{ padding: '10px', fontSize: '0.88rem' }}
                >
                  Download Current Image (#{((cardImageIndices[downloadPromptAsset.id] || 0) + 1)}) Only
                </a>
                <button
                  type="button"
                  onClick={() => setDownloadPromptAsset(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', marginTop: '6px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ActorShell>
  );
}
