'use client';

import React, { useState, useEffect } from 'react';
import LeadDetailModal from '@/components/LeadDetailModal';
import CreateLeadModal from '@/components/CreateLeadModal';

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
  created_at: string;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tabFilter, setTabFilter] = useState<'all' | 'duplicates' | 'unassigned' | 'won' | 'lost'>('all');
  const [search, setSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());

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
  }, [search]);

  let filteredLeads = leads;
  if (tabFilter === 'duplicates') {
    filteredLeads = leads.filter((l) => l.is_duplicate && !l.duplicate_flag_cleared);
  } else if (tabFilter === 'unassigned') {
    filteredLeads = leads.filter((l) => !l.manager_name || l.status === 'unassigned');
  } else if (tabFilter === 'won') {
    filteredLeads = leads.filter((l) => l.status === 'won');
  } else if (tabFilter === 'lost') {
    filteredLeads = leads.filter((l) => l.status === 'lost');
  }

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

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: '100%', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search by code, institute, SPOC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ padding: '8px 14px', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Lead Code & Origin
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Institution & City
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  SPOC Contact
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Deal Value
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Stage Status
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Assigned Handler
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading all pipeline leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                        Created by: {lead.owner_code} ({lead.owner_name})
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.institute_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {lead.institute_type} • {lead.city}
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600 }}>{lead.spoc_name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>📞 {lead.spoc_phone}</div>
                    </td>

                    <td style={{ padding: '16px 20px', fontWeight: 600, color: '#34d399' }}>
                      ₹ {Number(lead.deal_value || 0).toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: statusColorMap[lead.status] || '#ffffff',
                          background: `${statusColorMap[lead.status] || '#ffffff'}1a`,
                          border: `1px solid ${statusColorMap[lead.status] || '#ffffff'}40`,
                        }}
                      >
                        ● {lead.status.replace('_', ' ')}
                      </span>
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
                        View & Manage
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
