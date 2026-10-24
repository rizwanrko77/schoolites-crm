'use client';

import React, { useState, useEffect, useMemo } from 'react';
import LeadDetailModal from '@/components/LeadDetailModal';
import CreateLeadModal from '@/components/CreateLeadModal';
import LeadTableControls from '@/components/LeadTableControls';
import { formatSlotDate, formatSlotTime, getSlotModeIcon } from '@/lib/slotFormat';
import { getStatusMeta, ALL_STATUS_IDS } from '@/lib/leadStatuses';
import { usePipelineAutoSync } from '@/hooks/usePipelineAutoSync';

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
  contract_amount?: number | string | null;
  contract_status?: string | null;
  is_duplicate: boolean;
  duplicate_flag_cleared: boolean;
  duplicate_of_lead_id: string | null;
  owner_name: string;
  owner_code: string;
  owner_role: string;
  manager_name: string | null;
  manager_code: string | null;
  preferred_slot_date?: string | null;
  preferred_slot_time?: string | null;
  preferred_slot_mode?: string | null;
  created_at: string;
  updated_at?: string;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  type AdminTabType = 'all' | 'duplicates' | 'unassigned' | 'won' | 'lost';
  const [tabFilter, setTabFilterState] = useState<AdminTabType>('all');

  const setTabFilter = (tab: AdminTabType) => {
    setTabFilterState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };
  
  // Search, Status Filter & Sorting State with sessionStorage persistence
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(ALL_STATUS_IDS);
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [columnSort, setColumnSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Hydrate URL tab and saved filters safely on mount after initial render
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const paramTab = new URLSearchParams(window.location.search).get('tab') as AdminTabType;
    const validTabs: AdminTabType[] = ['all', 'duplicates', 'unassigned', 'won', 'lost'];
    if (paramTab && validTabs.includes(paramTab)) {
      setTabFilterState(paramTab);
    }

    try {
      const savedSearch = sessionStorage.getItem('admin_leads_search');
      if (savedSearch) setSearch(savedSearch);

      const savedStatuses = sessionStorage.getItem('admin_leads_statuses');
      if (savedStatuses) {
        const parsed = JSON.parse(savedStatuses);
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedStatuses(parsed);
      }

      const savedSort = sessionStorage.getItem('admin_leads_sort');
      if (savedSort) setSortBy(savedSort);
    } catch {}
  }, []);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  // Persist filter preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('admin_leads_search', search);
        sessionStorage.setItem('admin_leads_statuses', JSON.stringify(selectedStatuses));
        sessionStorage.setItem('admin_leads_sort', sortBy);
      } catch {}
    }
  }, [search, selectedStatuses, sortBy]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      if (selectedStatuses.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedStatuses.length < ALL_STATUS_IDS.length) {
        params.append('statuses', selectedStatuses.join(','));
      }
      params.append('sort_by', sortBy);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  usePipelineAutoSync(fetchLeads);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user));

    fetch('/api/admin/users?role=business_relations')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAvailableManagers(data.users || []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedStatuses, sortBy]);

  // Tab Filtering
  let tabFilteredLeads = leads;
  if (tabFilter === 'duplicates') {
    tabFilteredLeads = leads.filter((l) => l.is_duplicate && !l.duplicate_flag_cleared);
  } else if (tabFilter === 'unassigned') {
    tabFilteredLeads = leads.filter((l) => !l.manager_name || l.status === 'unassigned');
  } else if (tabFilter === 'won') {
    tabFilteredLeads = leads.filter((l) => l.status === 'won');
  } else if (tabFilter === 'lost') {
    tabFilteredLeads = leads.filter((l) => l.status === 'lost');
  }

  // Column Header Sorting
  const filteredLeads = useMemo(() => {
    if (!columnSort) return tabFilteredLeads;
    const sorted = [...tabFilteredLeads];
    const { column, direction } = columnSort;
    const modifier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      if (column === 'lead_code') {
        return a.lead_code.localeCompare(b.lead_code) * modifier;
      }
      if (column === 'institute') {
        return a.institute_name.localeCompare(b.institute_name) * modifier;
      }
      if (column === 'deal_value') {
        const aVal = parseFloat(String(a.contract_amount || a.deal_value || '0'));
        const bVal = parseFloat(String(b.contract_amount || b.deal_value || '0'));
        return (aVal - bVal) * modifier;
      }
      if (column === 'slot') {
        const aSlot = a.preferred_slot_date || '';
        const bSlot = b.preferred_slot_date || '';
        return aSlot.localeCompare(bSlot) * modifier;
      }
      if (column === 'status') {
        return (a.status || '').localeCompare(b.status || '') * modifier;
      }
      if (column === 'owner') {
        return (a.owner_name || '').localeCompare(b.owner_name || '') * modifier;
      }
      if (column === 'manager') {
        const aMgr = a.manager_name || 'Unassigned';
        const bMgr = b.manager_name || 'Unassigned';
        return aMgr.localeCompare(bMgr) * modifier;
      }
      return 0;
    });
    return sorted;
  }, [tabFilteredLeads, columnSort]);

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
    setSelectedStatuses(ALL_STATUS_IDS);
    setSortBy('created_desc');
    setColumnSort(null);
    setTabFilter('all');
  };

  const counts = {
    total: leads.length,
    duplicates: leads.filter((l) => l.is_duplicate && !l.duplicate_flag_cleared).length,
    unassigned: leads.filter((l) => !l.manager_name || l.status === 'unassigned').length,
    won: leads.filter((l) => l.status === 'won').length,
    lost: leads.filter((l) => l.status === 'lost').length,
  };

  const statusColorMap: Record<string, string> = {
    unassigned: '#f59e0b',
    assigned: '#38bdf8',
    in_discussion: '#818cf8',
    proposal_sent: '#c084fc',
    won: '#34d399',
    lost: '#f87171',
  };

  return (
    <div className="workspace-container">
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            fontWeight: 600,
          }}
        >
          ✓ {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            All Institutional Leads & Pipeline
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Monitor organizational pipeline progress, resolve duplicate credit conflicts, and oversee deals across all teams
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary"
          style={{ padding: '12px 22px', fontSize: '0.95rem' }}
        >
          + Create Lead
        </button>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Total Pipeline Leads
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{counts.total}</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>
            Unassigned in Pool
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{counts.unassigned}</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #f87171' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171', textTransform: 'uppercase', marginBottom: '6px' }}>
            Flagged Duplicates
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171' }}>{counts.duplicates}</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #34d399' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
            Won Institutional Deals
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>{counts.won}</div>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Leads (${counts.total})` },
            { id: 'duplicates', label: `⚠️ Duplicates (${counts.duplicates})` },
            { id: 'unassigned', label: `⚡ Pool (${counts.unassigned})` },
            { id: 'won', label: `🏆 Won (${counts.won})` },
            { id: 'lost', label: `Lost (${counts.lost})` },
          ].map((tab) => {
            const isSelected = tabFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabFilter(tab.id as any)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  border: isSelected ? '1px solid #818cf8' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
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
        filteredCount={filteredLeads.length}
      />

      {/* Leads Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="enterprise-table">
            <thead className="enterprise-thead">
              <tr>
                <th
                  onClick={() => handleToggleColumnSort('lead_code')}
                  className="enterprise-th sortable"
                  title="Click to sort by Lead Code"
                >
                  Lead Code {columnSort?.column === 'lead_code' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('institute')}
                  className="enterprise-th sortable"
                  title="Click to sort by Institution Name"
                >
                  Institution & City {columnSort?.column === 'institute' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('deal_value')}
                  className="enterprise-th sortable"
                  title="Click to sort by Deal / Contract Value"
                >
                  Deal Value {columnSort?.column === 'deal_value' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('status')}
                  className="enterprise-th sortable"
                  title="Click to sort by Stage Status"
                >
                  Stage Status {columnSort?.column === 'status' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('slot')}
                  className="enterprise-th sortable"
                  title="Click to sort by Connect Slot"
                >
                  Connect Slot {columnSort?.column === 'slot' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('owner')}
                  className="enterprise-th sortable"
                  title="Click to sort by Lead Owner"
                >
                  Lead Owner {columnSort?.column === 'owner' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th
                  onClick={() => handleToggleColumnSort('manager')}
                  className="enterprise-th sortable"
                  title="Click to sort by Lead Manager"
                >
                  Lead Manager {columnSort?.column === 'manager' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th className="enterprise-th" style={{ textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading all pipeline leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {selectedStatuses.length === 0
                      ? 'No stages selected in filter. Please check one or more stages in the Stage dropdown above.'
                      : 'No leads found matching this filter.'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const dealVal = parseFloat(String(lead.contract_amount || lead.deal_value || '0'));
                  const hasContract = Boolean(lead.contract_amount);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="enterprise-tr"
                      style={{
                        background: lead.is_duplicate && !lead.duplicate_flag_cleared ? 'rgba(239, 68, 68, 0.04)' : undefined,
                      }}
                    >
                      {/* 1. Lead Code */}
                      <td className="enterprise-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="enterprise-code-pill">
                            {lead.lead_code}
                          </span>
                          {lead.is_duplicate && !lead.duplicate_flag_cleared && (
                            <span title="Duplicate Warning Flag" style={{ fontSize: '0.85rem' }}>⚠️</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </td>

                      {/* 2. Institution */}
                      <td className="enterprise-td">
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                          {lead.institute_name}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {lead.city}{lead.country ? `, ${lead.country}` : ''} • {lead.institute_type}
                        </div>
                      </td>

                      {/* 3. Deal Value */}
                      <td className="enterprise-td">
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.94rem' }}>
                          {dealVal > 0 ? `₹${dealVal.toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: hasContract ? '#34d399' : 'var(--text-muted)', marginTop: '2px', fontWeight: hasContract ? 600 : 400 }}>
                          {hasContract ? '✓ Contracted' : dealVal > 0 ? 'Estimated' : 'Not set'}
                        </div>
                      </td>

                      {/* 4. Stage Status */}
                      <td className="enterprise-td">
                        {(() => {
                          const meta = getStatusMeta(lead.status);
                          return (
                            <span
                              className="enterprise-status-pill"
                              style={{
                                color: meta.color,
                                background: meta.bgColor,
                                border: `1px solid ${meta.borderColor}`,
                              }}
                            >
                              <span className="enterprise-status-dot" style={{ background: meta.color }} />
                              {meta.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 5. Connect Slot */}
                      <td className="enterprise-td">
                        {lead.preferred_slot_date || lead.preferred_slot_time || lead.preferred_slot_mode ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              {[formatSlotDate(lead.preferred_slot_date), formatSlotTime(lead.preferred_slot_time)].filter(Boolean).join(' • ') || 'Flexible'}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>{getSlotModeIcon(lead.preferred_slot_mode)}</span>
                              <span>{lead.preferred_slot_mode || 'Phone Call'}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>— Not specified</span>
                        )}
                      </td>

                      {/* 6. Lead Owner */}
                      <td className="enterprise-td">
                        {lead.owner_name ? (
                          <div className="enterprise-user-chip">
                            <div
                              className="enterprise-avatar"
                              style={{
                                border: `1.5px solid ${
                                  lead.owner_role === 'referral' || lead.owner_role === 'promoter'
                                    ? '#f43f5e'
                                    : lead.owner_role === 'business_relations'
                                    ? '#fbbf24'
                                    : '#38bdf8'
                                }`,
                              }}
                            >
                              {lead.owner_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.84rem' }}>
                                {lead.owner_name}
                              </div>
                              <span className="user-code-pill" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                {lead.owner_code}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct</span>
                        )}
                      </td>

                      {/* 7. Lead Manager */}
                      <td className="enterprise-td">
                        {lead.manager_name ? (
                          <div className="enterprise-user-chip">
                            <div
                              className="enterprise-avatar"
                              style={{ border: '1.5px solid var(--role-business-color, #fbbf24)' }}
                            >
                              {lead.manager_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.84rem' }}>
                                {lead.manager_name}
                              </div>
                              <span
                                className="user-code-pill"
                                style={{ fontSize: '0.68rem', padding: '1px 5px', color: 'var(--role-business-color)' }}
                              >
                                {lead.manager_code}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>⚡</span> Unassigned Pool
                          </span>
                        )}
                      </td>

                      {/* 8. Action */}
                      <td className="enterprise-td" style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px' }}
                        >
                          View Details ↗
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

      <CreateLeadModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newLead, dup) => {
          setToastMsg(dup ? `Lead ${newLead.lead_code} created! ⚠️ ${dup}` : `Lead ${newLead.lead_code} created!`);
          setTimeout(() => setToastMsg(''), 4000);
          fetchLeads();
        }}
      />

      <LeadDetailModal
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={fetchLeads}
        currentUser={currentUser}
        availableManagers={availableManagers}
      />
    </div>
  );
}
