'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CreateLeadModal from '@/components/CreateLeadModal';
import LeadDetailModal from '@/components/LeadDetailModal';

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
  created_at: string;
}

export default function BusinessRelationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unassigned' | 'my' | 'all'>('unassigned');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);

  // Concurrency-safe Grabbing state
  const [grabbingLeadId, setGrabbingLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('view', activeTab);
      if (statusFilter !== 'all') params.append('status', statusFilter);
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
      .then((data) => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, statusFilter, search]);

  // Load available BR team members for reassignment
  useEffect(() => {
    fetch('/api/admin/users?role=business_relations')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAvailableManagers(data.users || []))
      .catch(() => {});
  }, []);

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

      setToastMsg(`Lead ${leadCode} successfully claimed! Moved to 'My Leads'.`);
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
    <div style={{ minHeight: '100vh', padding: '36px 32px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Toast Alert */}
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className="badge-role business_relations">Business Relations Portal</span>
            <span className="user-code-pill" style={{ color: 'var(--role-business-color)' }}>{user?.user_code}</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Welcome, {user?.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Work the unassigned pool, manage active opportunities, and drive institutional closures
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.9rem' }}
          >
            + Create New Lead
          </button>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/login');
            }}
            className="btn-secondary"
            style={{ fontSize: '0.88rem' }}
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('unassigned')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              background: activeTab === 'unassigned' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'unassigned' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'unassigned' ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚡</span>
            <span>Unassigned Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('my')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              background: activeTab === 'my' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'my' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'my' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🎯</span>
            <span>My Active Leads</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              background: activeTab === 'all' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'all' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'all' ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🌐</span>
            <span>All Team Leads</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ width: '100%', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search leads, SPOC, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Stage Sub-filters if in My Leads or All Leads */}
      {activeTab !== 'unassigned' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Stages' },
            { id: 'assigned', label: 'Assigned' },
            { id: 'in_discussion', label: 'In Discussion' },
            { id: 'proposal_sent', label: 'Proposal Sent' },
            { id: 'won', label: 'Won 🏆' },
            { id: 'lost', label: 'Lost' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: statusFilter === st.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                color: statusFilter === st.id ? '#ffffff' : 'var(--text-secondary)',
                border: statusFilter === st.id ? '1px solid #818cf8' : '1px solid transparent',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* Leads Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
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
                  Stage Status
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Assigned Handler
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
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {activeTab === 'unassigned'
                      ? 'No unassigned leads in the pool right now. Check back soon!'
                      : 'No leads found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
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
                        Origin: {lead.owner_code} ({lead.owner_name})
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.institute_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {lead.institute_type} • {lead.city} • {lead.student_strength} students
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600 }}>{lead.spoc_name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>📞 {lead.spoc_phone}</div>
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

      {/* CREATE LEAD MODAL */}
      <CreateLeadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleLeadCreatedSuccess}
      />

      {/* LEAD DETAIL MODAL */}
      <LeadDetailModal
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={fetchLeads}
        currentUser={user}
        availableManagers={availableManagers}
      />
    </div>
  );
}
