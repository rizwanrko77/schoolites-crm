'use client';

import React, { useState, useEffect, useMemo } from 'react';
import LeadDetailModal from '@/components/LeadDetailModal';
import CreateLeadModal from '@/components/CreateLeadModal';
import LeadTableControls from '@/components/LeadTableControls';
import { formatSlotDate, formatSlotTime, getSlotModeIcon } from '@/lib/slotFormat';
import { getStatusMeta } from '@/lib/leadStatuses';

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
  const [tabFilter, setTabFilter] = useState<'all' | 'duplicates' | 'unassigned' | 'won' | 'lost'>('all');
  
  // Search, Status Filter & Sorting State with sessionStorage persistence
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('admin_leads_search');
        if (saved) return saved;
      } catch {}
    }
    return '';
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('admin_leads_statuses');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('admin_leads_sort');
        if (saved) return saved;
      } catch {}
    }
    return 'created_desc';
  });

  const [columnSort, setColumnSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

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
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','));
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
      if (column === 'slot') {
        const aSlot = a.preferred_slot_date || '';
        const bSlot = b.preferred_slot_date || '';
        return aSlot.localeCompare(bSlot) * modifier;
      }
      if (column === 'status') {
        return (a.status || '').localeCompare(b.status || '') * modifier;
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
    setSelectedStatuses([]);
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
                  title="Click to sort by Connect Slot"
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
                    Loading all pipeline leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: lead.is_duplicate && !lead.duplicate_flag_cleared ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span className="user-code-pill" style={{ color: '#818cf8' }}>
                          {lead.lead_code}
                        </span>
                        {lead.is_duplicate && !lead.duplicate_flag_cleared && (
                          <span title="Duplicate Warning Flag" style={{ fontSize: '0.85rem' }}>⚠️</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Lead Owner: {lead.owner_code} ({lead.owner_name})
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.institute_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {lead.institute_type} • {lead.city}
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
                        <div>
                          <strong>{lead.manager_name}</strong>
                          <span className="user-code-pill" style={{ marginLeft: '6px', fontSize: '0.75rem' }}>{lead.manager_code}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>Unassigned Pool</span>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
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
