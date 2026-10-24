'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getStatusMeta } from '@/lib/leadStatuses';

interface AdminEnquiry {
  id: string;
  enquiry_code: string;
  owner_id: string | null;
  promoter_id: string | null;
  spoc_name: string;
  phone: string;
  email: string | null;
  institute_type: string | null;
  institute_name: string | null;
  country: string | null;
  city: string | null;
  student_count: string | null;
  website: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'in_discussion' | 'converted_to_lead' | 'discarded';
  internal_notes?: string | null;
  claimed_at?: string | null;
  converted_lead_id: string | null;
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

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<AdminEnquiry | null>(null);
  const [toastMsg, setToastMsg] = useState('');
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

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/enquiries');
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const handleUpdateStatus = async (enquiryId: string, newStatus: string) => {
    setUpdatingId(enquiryId);
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update enquiry status');
      }
      setToastMsg(`Enquiry status updated to ${newStatus}`);
      setTimeout(() => setToastMsg(''), 3000);
      await fetchEnquiries();
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
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
      if (!matchStatus || !matchLeadStage) return false;

      const q = search.toLowerCase().trim();
      if (!q) return true;

      const matchCode = e.enquiry_code.toLowerCase().includes(q);
      const matchInst = (e.institute_name || '').toLowerCase().includes(q) || (e.institute_type || '').toLowerCase().includes(q);
      const matchCity = (e.city || '').toLowerCase().includes(q);
      const matchSpoc = e.spoc_name.toLowerCase().includes(q);
      const matchPromoter = (e.promoter_name || '').toLowerCase().includes(q) || (e.promoter_code || '').toLowerCase().includes(q);
      const matchOwner = (e.owner_name || '').toLowerCase().includes(q) || (e.owner_code || '').toLowerCase().includes(q);
      const matchLeadCode = (e.lead_code || '').toLowerCase().includes(q);

      return matchCode || matchInst || matchCity || matchSpoc || matchPromoter || matchOwner || matchLeadCode;
    });
  }, [enquiries, statusFilter, leadStageFilter, search]);

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
      } else if (columnSort.column === 'spoc') {
        aVal = a.spoc_name || '';
        bVal = b.spoc_name || '';
      } else if (columnSort.column === 'team') {
        aVal = a.owner_name || a.promoter_name || '';
        bVal = b.owner_name || b.promoter_name || '';
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

  const counts = {
    total: enquiries.length,
    new: enquiries.filter((e) => e.status === 'new').length,
    contacted: enquiries.filter((e) => e.status === 'contacted').length,
    converted: enquiries.filter((e) => e.status === 'converted_to_lead').length,
    won: enquiries.filter((e) => (e.lead_status || '').toLowerCase() === 'won').length,
    discarded: enquiries.filter((e) => e.status === 'discarded').length,
  };

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

      {/* Header and KPI Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            Inbound Enquiries Center
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Centralized pipeline of all public form submissions, promoter referrals, and inbound institution enquiries.
          </p>
        </div>

        <button
          onClick={fetchEnquiries}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Quick KPI Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Inbound
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>{counts.total}</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            New (Uncontacted)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>{counts.new}</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #fbbf24' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Contacted / Discovery
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>{counts.contacted}</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #34d399' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Converted to Leads
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>{counts.converted}</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Deals Won 🎉
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{counts.won}</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search by code, institute, SPOC, promoter, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ padding: '9px 14px', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Enquiry Stage:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="active">🎯 Active Lead Pipeline</option>
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

          {(search || statusFilter !== 'all' || leadStageFilter !== 'all' || columnSort) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
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

      {/* Enquiries Master Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
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
                    <span>Code & Date</span>
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
                    onClick={() => handleToggleSort('spoc')}
                    style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                  >
                    <span>SPOC Contact</span>
                    <span style={{ fontSize: '0.7rem', color: columnSort?.column === 'spoc' ? '#818cf8' : 'var(--text-muted)', opacity: columnSort?.column === 'spoc' ? 1 : 0.5 }}>
                      {columnSort?.column === 'spoc' ? (columnSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleSort('team')}
                    style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                  >
                    <span>Team Attribution</span>
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
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading inbound enquiries...
                  </td>
                </tr>
              ) : sortedEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No enquiries match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                sortedEnquiries.map((enq) => {
                  const isWon = (enq.lead_status || '').toLowerCase() === 'won';
                  const isConverted = enq.status === 'converted_to_lead';
                  const leadMeta = enq.lead_status ? getStatusMeta(enq.lead_status) : null;

                  return (
                    <tr
                      key={enq.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div className="user-code-pill" style={{ color: '#38bdf8', marginBottom: '4px' }}>
                          {enq.enquiry_code}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                          {enq.institute_name || enq.institute_type}
                        </div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                          {enq.promoter_name && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Promoter: </span>
                              <Link
                                href={`/admin/users/${enq.promoter_id}`}
                                style={{ color: 'var(--role-promoter-color)', textDecoration: 'none', fontWeight: 500 }}
                              >
                                {enq.promoter_name} ({enq.promoter_code})
                              </Link>
                            </div>
                          )}

                          {enq.owner_name && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Owner: </span>
                              <Link
                                href={`/admin/users/${enq.owner_id}`}
                                style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}
                              >
                                {enq.owner_name} ({enq.owner_code})
                              </Link>
                            </div>
                          )}

                          {enq.manager_name && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Manager: </span>
                              <span style={{ color: 'var(--role-business-color)', fontWeight: 500 }}>
                                {enq.manager_name} ({enq.manager_code})
                              </span>
                            </div>
                          )}

                          {!enq.promoter_name && !enq.owner_name && (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Direct Inbound Pool</span>
                          )}
                        </div>
                      </td>

                      {/* Enquiry Stage Column */}
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
                                : enq.status === 'in_discussion'
                                ? 'rgba(168, 85, 247, 0.15)'
                                : enq.status === 'contacted'
                                ? 'rgba(251, 191, 36, 0.15)'
                                : enq.status === 'discarded'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(52, 211, 153, 0.15)',
                            color:
                              enq.status === 'new'
                                ? '#38bdf8'
                                : enq.status === 'in_discussion'
                                ? '#c084fc'
                                : enq.status === 'contacted'
                                ? '#fbbf24'
                                : enq.status === 'discarded'
                                ? '#f87171'
                                : '#34d399',
                            border: '1px solid var(--border-subtle)',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <span>
                            {enq.status === 'new'
                              ? '✨'
                              : enq.status === 'in_discussion'
                              ? '💬'
                              : enq.status === 'contacted'
                              ? '📞'
                              : enq.status === 'discarded'
                              ? '✕'
                              : '✅'}
                          </span>
                          <span>{enq.status === 'converted_to_lead' ? 'Converted to Lead' : enq.status.replace(/_/g, ' ')}</span>
                        </span>
                      </td>

                      {/* Lead Pipeline Stage Column */}
                      <td style={{ padding: '16px 20px' }}>
                        {enq.lead_status ? (
                          <div>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: isWon ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                                color: isWon ? '#34d399' : '#818cf8',
                                border: isWon ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(99, 102, 241, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{isWon ? '🎉' : '🎯'}</span>
                              <span>{leadMeta?.label || enq.lead_status.replace(/_/g, ' ')}</span>
                            </span>
                            {enq.lead_code && (
                              <div style={{ marginTop: '3px' }}>
                                <Link
                                  href={`/admin/leads?id=${enq.converted_lead_id}`}
                                  style={{ fontSize: '0.74rem', color: '#38bdf8', textDecoration: 'none' }}
                                >
                                  {enq.lead_code} ↗
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : isConverted ? (
                          <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontStyle: 'italic' }}>
                            Assigning Manager...
                          </span>
                        ) : enq.status === 'discarded' ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            N/A (Discarded)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Pending Conversion
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedEnquiry(enq)}
                          className="btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px' }}
                        >
                          Details & Actions
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

      {/* INSPECT ENQUIRY MODAL (ADMIN GLOBAL VIEW) */}
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
              maxWidth: '680px',
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

            {/* SPOC Contact Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact Person</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedEnquiry.spoc_name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone Number</div>
                <div style={{ fontSize: '0.95rem', color: '#38bdf8', marginTop: '2px' }}>
                  <a href={`tel:${selectedEnquiry.phone}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>📞 {selectedEnquiry.phone}</a>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedEnquiry.email ? <a href={`mailto:${selectedEnquiry.email}`} style={{ color: '#818cf8', textDecoration: 'none' }}>✉️ {selectedEnquiry.email}</a> : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location & Size</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedEnquiry.city ? `${selectedEnquiry.city}, ` : ''}{selectedEnquiry.country || ''} {selectedEnquiry.student_count ? `• ${selectedEnquiry.student_count} Students` : ''}
                </div>
              </div>
            </div>

            {/* Inbound Message */}
            {selectedEnquiry.message && (
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Inbound Message</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>"{selectedEnquiry.message}"</p>
              </div>
            )}

            {/* Internal Notes Display */}
            {selectedEnquiry.internal_notes && (
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
                  🔒 Representative Internal Notes
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>
                  {selectedEnquiry.internal_notes}
                </p>
              </div>
            )}

            {/* Status Governance Actions */}
            <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#c7d2fe', textTransform: 'uppercase', marginBottom: '10px' }}>
                Admin Governance Status Update
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['new', 'contacted', 'in_discussion', 'discarded'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, st)}
                    disabled={updatingId === selectedEnquiry.id || selectedEnquiry.status === st}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: selectedEnquiry.status === st ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedEnquiry.status === st ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    Mark {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

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
