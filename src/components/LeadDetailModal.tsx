'use client';

import React, { useState, useEffect } from 'react';
import { formatSlotDate, formatSlotTime } from '@/lib/slotFormat';
import { COUNTRIES } from '@/lib/countries';

interface Note {
  id: string;
  author_id: string;
  author_name: string;
  author_code: string;
  author_role: string;
  visibility: 'personal' | 'global';
  content: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  actor_name: string;
  action: string;
  metadata: any;
  created_at: string;
}

interface LeadDetailModalProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
  currentUser: any;
  availableManagers?: any[];
}

export default function LeadDetailModal({
  leadId,
  onClose,
  onLeadUpdated,
  currentUser,
  availableManagers = [],
}: LeadDetailModalProps) {
  const [lead, setLead] = useState<any>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'personal_notes' | 'global_remarks' | 'history'>('details');

  // New Note state
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Status updating state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Reassignment state
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Sensitive Duplicate Action confirmation
  const [confirmDuplicateAction, setConfirmDuplicateAction] = useState<'clear' | 'disqualify' | null>(null);

  // Edit Lead state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Reassignment managers list
  const [managersList, setManagersList] = useState<any[]>(availableManagers);

  useEffect(() => {
    if (showReassignModal) {
      fetch('/api/leads/managers')
        .then((res) => (res.ok ? res.json() : { managers: [] }))
        .then((data) => setManagersList(data.managers || []))
        .catch((err) => console.error(err));
    }
  }, [showReassignModal]);

  const fetchLeadDetails = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to load lead details');
      const data = await res.json();
      setLead(data.lead);
      setNotes(data.notes || []);
      setAuditLogs(data.audit_logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  if (!leadId) return null;

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeadDetails();
        onLeadUpdated();
      }
    } catch {
      alert('Failed to update stage');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async (visibility: 'personal' | 'global') => {
    if (!noteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent.trim(), visibility }),
      });
      if (res.ok) {
        setNoteContent('');
        fetchLeadDetails();
      }
    } catch {
      alert('Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedManagerId) return;
    setIsReassigning(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_manager_id: selectedManagerId }),
      });
      if (res.ok) {
        setShowReassignModal(false);
        fetchLeadDetails();
        onLeadUpdated();
      } else {
        const d = await res.json();
        alert(d.error || 'Reassignment failed');
      }
    } catch {
      alert('Failed to reassign lead');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleDuplicateAction = async (action: 'clear_flag' | 'disqualify') => {
    try {
      const res = await fetch(`/api/leads/${lead.id}/duplicate-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setConfirmDuplicateAction(null);
        fetchLeadDetails();
        onLeadUpdated();
      }
    } catch {
      alert('Action failed');
    }
  };

  const handleStartEdit = () => {
    setEditFormData({
      institute_name: lead?.institute_name || '',
      institute_type: lead?.institute_type || 'School',
      country: lead?.country || 'India',
      city: lead?.city || '',
      student_strength: lead?.student_strength || 'Below 500',
      current_erp: lead?.current_erp || 'unsure',
      current_erp_name: lead?.current_erp_name || '',
      spoc_name: lead?.spoc_name || '',
      spoc_role: lead?.spoc_role || '',
      spoc_phone: lead?.spoc_phone || '',
      spoc_email: lead?.spoc_email || '',
      dm_same_as_spoc: lead?.dm_same_as_spoc || false,
      dm_name: lead?.dm_name || '',
      dm_role: lead?.dm_role || '',
      dm_phone: lead?.dm_phone || '',
      dm_email: lead?.dm_email || '',
      additional_contact_name: lead?.additional_contact_name || '',
      additional_contact_role: lead?.additional_contact_role || '',
      additional_contact_phone: lead?.additional_contact_phone || '',
      additional_contact_email: lead?.additional_contact_email || '',
      decision_flow: lead?.decision_flow || '',
      preferred_slot_date: lead?.preferred_slot_date ? new Date(lead.preferred_slot_date).toISOString().split('T')[0] : '',
      preferred_slot_time: lead?.preferred_slot_time || '',
      preferred_slot_mode: lead?.preferred_slot_mode || 'Phone/WhatsApp Call',
      expected_start_date: lead?.expected_start_date || '',
      additional_details: lead?.additional_details || '',
    });
    setEditError('');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.institute_name?.trim()) {
      setEditError('Institution Name is required.');
      return;
    }
    if (!editFormData.spoc_name?.trim() || !editFormData.spoc_phone?.trim()) {
      setEditError('SPOC Name and Mobile / WhatsApp are required.');
      return;
    }
    setIsSavingEdit(true);
    setEditError('');
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update lead details');
      }
      setIsEditing(false);
      fetchLeadDetails();
      onLeadUpdated();
    } catch (err: any) {
      setEditError(err.message || 'Error updating lead details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const isDealClosed = lead?.status === 'won' || lead?.status === 'lost';
  const canEditLead =
    (currentUser?.role === 'admin' || currentUser?.id === lead?.owner_id || currentUser?.id === lead?.manager_id) &&
    (!isDealClosed || currentUser?.role === 'admin');

  const personalNotes = notes.filter((n) => n.visibility === 'personal');
  const globalRemarks = notes.filter((n) => n.visibility === 'global');

  return (
    <div className="modal-backdrop">
      <div
        className="glass-panel modal-dialog"
        style={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="user-code-pill" style={{ color: '#818cf8', fontSize: '0.9rem' }}>
                {lead?.lead_code}
              </span>

              {lead?.source_enquiry_code && (
                <span className="user-code-pill" style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
                  Converted from {lead.source_enquiry_code}
                </span>
              )}

              {lead?.is_duplicate && !lead?.duplicate_flag_cleared && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⚠️ Duplicate Flag (Matches {lead.duplicate_of_code || 'existing lead'})
                </span>
              )}
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>{lead?.institute_name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {lead?.institute_type} • {lead?.city}, {lead?.country}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Stage Selector */}
            {(() => {
              const isClosed = lead?.status === 'won' || lead?.status === 'lost';
              const canChangeStatus =
                currentUser?.role === 'admin' ||
                (currentUser?.role === 'business_relations' && lead?.manager_id === currentUser?.id);

              if (!canChangeStatus || (isClosed && currentUser?.role !== 'admin')) {
                return (
                  <span
                    title={isClosed && currentUser?.role !== 'admin' ? "Finalized deal (Admin only)" : "Stage status (Lead Manager / Admin only)"}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: lead?.status === 'won' ? '#34d399' : lead?.status === 'lost' ? '#f87171' : lead?.status === 'unassigned' ? '#f59e0b' : '#818cf8',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    ● {lead?.status ? lead.status.replace(/_/g, ' ') : 'Unassigned'}
                  </span>
                );
              }

              return (
                <select
                  value={lead?.status || 'unassigned'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  className="input-field"
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: '#0f172a',
                    color: lead?.status === 'won' ? '#34d399' : lead?.status === 'lost' ? '#f87171' : '#818cf8',
                  }}
                >
                  <option value="unassigned">● Unassigned</option>
                  <option value="assigned">● Assigned</option>
                  <option value="in_discussion">● In Discussion</option>
                  <option value="proposal_sent">● Proposal Sent</option>
                  <option value="won">● Deal Won 🏆</option>
                  <option value="lost">● Closed Lost</option>
                </select>
              );
            })()}

            <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Duplicate Notice Banner for Admin */}
        {lead?.is_duplicate && !lead?.duplicate_flag_cleared && currentUser?.role === 'admin' && (
          <div
            style={{
              padding: '12px 32px',
              background: 'rgba(239, 68, 68, 0.08)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
              <strong>Admin Action Required:</strong> This lead was flagged as duplicate of {lead.duplicate_of_code} ({lead.duplicate_of_institute}).
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmDuplicateAction('clear')}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Clear Flag ✓
              </button>
              <button
                onClick={() => setConfirmDuplicateAction('disqualify')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                Disqualify
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.01)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {[
            { id: 'details', label: 'Lead Details', icon: '📋' },
            { id: 'personal_notes', label: `Personal Notes (${personalNotes.length})`, icon: '🔒' },
            { id: 'global_remarks', label: `Global Remarks (${globalRemarks.length})`, icon: '💬' },
            { id: 'history', label: `Audit Timeline (${auditLogs.length})`, icon: '📜' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                fontWeight: 600,
                lineHeight: 1,
                flexShrink: 0,
                background: activeTab === t.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === t.id ? '#ffffff' : 'var(--text-secondary)',
                border: activeTab === t.id ? '1px solid #818cf8' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '0.95rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
                {t.icon}
              </span>
              <span style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Body Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading lead data...
            </div>
          ) : (
            <>
              {/* TAB 1: DETAILS */}
              {activeTab === 'details' && (
                isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ✏️ Edit Lead Details: <span style={{ color: '#818cf8' }}>{lead?.lead_code}</span>
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          Updates will be saved and recorded in the audit history.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                          disabled={isSavingEdit}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="btn-primary"
                          style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                          disabled={isSavingEdit}
                        >
                          {isSavingEdit ? 'Saving...' : 'Save Changes ✓'}
                        </button>
                      </div>
                    </div>

                    {editError && (
                      <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '0.84rem' }}>
                        ⚠️ {editError}
                      </div>
                    )}

                    {/* Section 1: Institution Details */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '10px' }}>1. Institution Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Institution Name *</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.institute_name}
                            onChange={(e) => setEditFormData({ ...editFormData, institute_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Institution Type</label>
                          <select
                            className="input-field"
                            value={editFormData.institute_type}
                            onChange={(e) => setEditFormData({ ...editFormData, institute_type: e.target.value })}
                          >
                            {['School', 'College', 'University', 'Institution', 'Other'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Country</label>
                          <select
                            className="input-field"
                            value={editFormData.country}
                            onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                          >
                            {COUNTRIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>City *</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.city}
                            onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Student Strength</label>
                          <select
                            className="input-field"
                            value={editFormData.student_strength}
                            onChange={(e) => setEditFormData({ ...editFormData, student_strength: e.target.value })}
                          >
                            {['Below 500', '500 - 1000', '1000 - 2000', '2000 - 3000', '3000 - 4000', '4000+'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Current ERP</label>
                          <select
                            className="input-field"
                            value={editFormData.current_erp}
                            onChange={(e) => setEditFormData({ ...editFormData, current_erp: e.target.value })}
                          >
                            <option value="no">No ERP</option>
                            <option value="yes">Yes (Existing System)</option>
                            <option value="unsure">Unsure / Exploring</option>
                          </select>
                        </div>
                        {editFormData.current_erp === 'yes' && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Existing ERP Name</label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="e.g. Fedena, Tally, Custom"
                              value={editFormData.current_erp_name}
                              onChange={(e) => setEditFormData({ ...editFormData, current_erp_name: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Contact Details */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>2. SPOC & Decision Maker Contacts</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SPOC Name *</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.spoc_name}
                            onChange={(e) => setEditFormData({ ...editFormData, spoc_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SPOC Role / Designation</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.spoc_role}
                            onChange={(e) => setEditFormData({ ...editFormData, spoc_role: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SPOC Mobile / WhatsApp *</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.spoc_phone}
                            onChange={(e) => setEditFormData({ ...editFormData, spoc_phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SPOC Email</label>
                          <input
                            type="email"
                            className="input-field"
                            value={editFormData.spoc_email}
                            onChange={(e) => setEditFormData({ ...editFormData, spoc_email: e.target.value })}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Decision Maker Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.dm_name}
                            onChange={(e) => setEditFormData({ ...editFormData, dm_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>DM Role / Designation</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.dm_role}
                            onChange={(e) => setEditFormData({ ...editFormData, dm_role: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>DM Mobile / WhatsApp</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.dm_phone}
                            onChange={(e) => setEditFormData({ ...editFormData, dm_phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>DM Email</label>
                          <input
                            type="email"
                            className="input-field"
                            value={editFormData.dm_email}
                            onChange={(e) => setEditFormData({ ...editFormData, dm_email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Additional Contact */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c084fc', marginBottom: '10px' }}>3. Additional Contact (Optional)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Contact Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.additional_contact_name}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_contact_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Role / Designation</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.additional_contact_role}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_contact_role: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Mobile / WhatsApp</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editFormData.additional_contact_phone}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_contact_phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Email</label>
                          <input
                            type="email"
                            className="input-field"
                            value={editFormData.additional_contact_email}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_contact_email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Connect Slot & Timeline */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', marginBottom: '10px' }}>4. Connect Slot & Timeline</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Preferred Slot Date</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ colorScheme: 'dark' }}
                            value={editFormData.preferred_slot_date}
                            onChange={(e) => setEditFormData({ ...editFormData, preferred_slot_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Preferred Slot Time</label>
                          <input
                            type="time"
                            className="input-field"
                            style={{ colorScheme: 'dark' }}
                            value={editFormData.preferred_slot_time}
                            onChange={(e) => setEditFormData({ ...editFormData, preferred_slot_time: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Preferred Mode</label>
                          <select
                            className="input-field"
                            value={editFormData.preferred_slot_mode}
                            onChange={(e) => setEditFormData({ ...editFormData, preferred_slot_mode: e.target.value })}
                          >
                            {['Phone/WhatsApp Call', 'Virtual Meet', 'Unsure'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Expected Start</label>
                          <select
                            className="input-field"
                            value={editFormData.expected_start_date}
                            onChange={(e) => setEditFormData({ ...editFormData, expected_start_date: e.target.value })}
                          >
                            <option value="">-- Select Timeline --</option>
                            {['Immediately (Within 1-2 weeks)', 'Within 1 Month', 'Within 2-3 Months', 'Next Academic Session', 'Flexible / Exploring'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Decision Flow Notes</label>
                          <textarea
                            rows={2}
                            className="input-field"
                            value={editFormData.decision_flow}
                            onChange={(e) => setEditFormData({ ...editFormData, decision_flow: e.target.value })}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Additional Requirements</label>
                          <textarea
                            rows={2}
                            className="input-field"
                            value={editFormData.additional_details}
                            onChange={(e) => setEditFormData({ ...editFormData, additional_details: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="btn-secondary"
                        style={{ padding: '8px 16px' }}
                        disabled={isSavingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="btn-primary"
                        style={{ padding: '8px 20px' }}
                        disabled={isSavingEdit}
                      >
                        {isSavingEdit ? 'Saving Changes...' : 'Save Changes ✓'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {canEditLead && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleStartEdit}
                          className="btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>✏️</span> Edit Details
                        </button>
                      </div>
                    )}

                    {/* Attribution Banner */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Lead Owner</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{lead?.owner_name}</strong>
                        <span className="user-code-pill" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>{lead?.owner_code}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Role: {lead?.owner_role}</span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead Manager</span>
                          {(currentUser?.role === 'admin' || lead?.manager_id === currentUser?.id) && (
                            <button
                              onClick={() => setShowReassignModal(true)}
                              style={{ fontSize: '0.75rem', color: '#818cf8', textDecoration: 'underline' }}
                            >
                              Reassign ⇄
                            </button>
                          )}
                        </div>
                        <strong style={{ color: lead?.manager_name ? 'var(--text-primary)' : '#f59e0b' }}>
                          {lead?.manager_name ? lead.manager_name : 'Unassigned (In Pool)'}
                        </strong>
                        {lead?.manager_code && <span className="user-code-pill" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>{lead.manager_code}</span>}
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      <div className="glass-panel" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>SPOC Details</h4>
                        <p><strong>{lead?.spoc_name}</strong> ({lead?.spoc_role})</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📞 {lead?.spoc_phone}</p>
                        {lead?.spoc_email && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>✉️ {lead?.spoc_email}</p>}
                      </div>

                      <div className="glass-panel" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>Decision Maker</h4>
                        <p><strong>{lead?.dm_name}</strong> ({lead?.dm_role})</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📞 {lead?.dm_phone}</p>
                        {lead?.dm_email && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>✉️ {lead?.dm_email}</p>}
                      </div>

                      {/* Additional Contact if present */}
                      {(lead?.additional_contact_name || lead?.additional_contact_phone) && (
                        <div className="glass-panel" style={{ padding: '16px', borderLeft: '3px solid #c084fc' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', marginBottom: '8px' }}>
                            Additional Contact
                          </h4>
                          <p><strong>{lead.additional_contact_name || 'Contact Person'}</strong> {lead.additional_contact_role ? `(${lead.additional_contact_role})` : ''}</p>
                          {lead.additional_contact_phone && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📞 {lead.additional_contact_phone}</p>
                          )}
                          {lead.additional_contact_email && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>✉️ {lead.additional_contact_email}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ERP & Size */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Student Strength</span>
                        <strong>{lead?.student_strength || '—'}</strong>
                      </div>

                      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current ERP</span>
                        <strong>{lead?.current_erp === 'yes' ? `YES (${lead.current_erp_name || 'Generic'})` : lead?.current_erp?.toUpperCase()}</strong>
                      </div>

                      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Expected Start</span>
                        <strong style={{ color: '#38bdf8' }}>{lead?.expected_start_date || 'Within 1 Month'}</strong>
                      </div>
                    </div>

                    {/* Connect Slot */}
                    {(lead?.preferred_slot_date || lead?.preferred_slot_time) && (
                      <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#c7d2fe', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          📅 Preferred Connect Slot:
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>
                          {[formatSlotDate(lead.preferred_slot_date), formatSlotTime(lead.preferred_slot_time)].filter(Boolean).join(' at ') || 'Flexible timing'} ({lead.preferred_slot_mode || 'Phone/WhatsApp Call'})
                        </span>
                      </div>
                    )}

                    {/* Decision Flow */}
                    {lead?.decision_flow && (
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Decision Flow Notes:</span>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap' }}>
                          {lead.decision_flow}
                        </p>
                      </div>
                    )}

                    {/* Additional Notes */}
                    {lead?.additional_details && (
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Additional Notes / Requirements:</span>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap' }}>
                          {lead.additional_details}
                        </p>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* TAB 2: PERSONAL NOTES */}
              {activeTab === 'personal_notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    🔒 <strong>Personal Notes:</strong> Working notes visible to you, previous managers upon transfer, and system administrators.
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Add a confidential personal note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="input-field"
                    />
                    <button
                      onClick={() => handleAddNote('personal')}
                      disabled={isSubmittingNote || !noteContent.trim()}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Add Note
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {personalNotes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No personal notes added yet.</p>
                    ) : (
                      personalNotes.map((note) => {
                        const isOwnNote = note.author_id === currentUser?.id;
                        return (
                          <div
                            key={note.id}
                            style={{
                              padding: '12px 14px',
                              background: isOwnNote ? 'rgba(255, 255, 255, 0.03)' : 'rgba(245, 158, 11, 0.06)',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: isOwnNote ? '3px solid #818cf8' : '3px solid #f59e0b',
                              border: isOwnNote ? '1px solid var(--border-subtle)' : '1px solid rgba(245, 158, 11, 0.25)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                              {isOwnNote ? (
                                <span style={{ color: '#818cf8', fontWeight: 600 }}>🔒 Your Personal Note</span>
                              ) : (
                                <span style={{ color: '#f59e0b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <span>📋 Transferred Note from Previous Manager:</span>
                                  <strong style={{ color: '#ffffff' }}>{note.author_name}</strong>
                                  <span className="user-code-pill" style={{ fontSize: '0.72rem' }}>{note.author_code}</span>
                                </span>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {new Date(note.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(note.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: GLOBAL REMARKS */}
              {activeTab === 'global_remarks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    💬 <strong>Global Remarks:</strong> Visible to all authorized team members working on this pipeline.
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Add a remark for the whole team..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="input-field"
                    />
                    <button
                      onClick={() => handleAddNote('global')}
                      disabled={isSubmittingNote || !noteContent.trim()}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Post Remark
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {globalRemarks.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No global remarks recorded yet.</p>
                    ) : (
                      globalRemarks.map((note) => (
                        <div key={note.id} style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #34d399' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span><strong>{note.author_name}</strong> ({note.author_code})</span>
                            <span>{new Date(note.created_at).toLocaleString('en-IN')}</span>
                          </div>
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT TIMELINE */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {auditLogs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No audit timeline records found.</p>
                  ) : (
                    [...auditLogs]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((log) => {
                        const dateObj = new Date(log.created_at);
                        const formattedDate = dateObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        });
                        const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });

                        return (
                          <div
                            key={log.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '16px',
                              fontSize: '0.86rem',
                              borderBottom: '1px solid var(--border-subtle)',
                              paddingBottom: '12px',
                            }}
                          >
                            <div style={{ minWidth: '95px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600 }}>
                                {formattedDate}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                {formattedTime}
                              </span>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{log.actor_name}</strong>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background:
                                      log.action === 'lead_created'
                                        ? 'rgba(56, 189, 248, 0.15)'
                                        : log.action === 'lead_status_changed'
                                        ? 'rgba(129, 140, 248, 0.15)'
                                        : log.action === 'lead_grabbed'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : log.action === 'lead_reassigned'
                                        ? 'rgba(192, 132, 252, 0.15)'
                                        : 'rgba(52, 211, 153, 0.15)',
                                    color:
                                      log.action === 'lead_created'
                                        ? '#38bdf8'
                                        : log.action === 'lead_status_changed'
                                        ? '#818cf8'
                                        : log.action === 'lead_grabbed'
                                        ? '#f59e0b'
                                        : log.action === 'lead_reassigned'
                                        ? '#c084fc'
                                        : '#34d399',
                                    border: '1px solid currentColor',
                                  }}
                                >
                                  {log.action.replace(/_/g, ' ')}
                                </span>
                              </div>

                              {log.metadata && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                                  {log.action === 'lead_status_changed' && log.metadata.from && log.metadata.to ? (
                                    <span>
                                      Stage updated from <code style={{ color: '#f59e0b' }}>{log.metadata.from}</code> ➔ <code style={{ color: '#34d399' }}>{log.metadata.to}</code>
                                    </span>
                                  ) : log.action === 'lead_created' ? (
                                    <span>
                                      Lead registered for <strong>{log.metadata.institute_name || lead?.institute_name}</strong> by {log.metadata.owner_code || log.actor_name}
                                    </span>
                                  ) : log.action === 'lead_grabbed' ? (
                                    <span>
                                      Claimed by <strong>{log.metadata.manager_code || log.actor_name}</strong>
                                    </span>
                                  ) : log.action === 'lead_reassigned' ? (
                                    <span>
                                      Reassigned to <strong>{log.metadata.to_manager || log.actor_name}</strong>
                                    </span>
                                  ) : log.action === 'lead_updated' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        Lead details modified by {log.actor_name}:
                                      </span>
                                      {log.metadata?.changed_fields && log.metadata?.diffs ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                          {log.metadata.changed_fields.map((f: string) => {
                                            const diff = log.metadata.diffs[f];
                                            return (
                                              <span
                                                key={f}
                                                style={{
                                                  fontSize: '0.74rem',
                                                  padding: '2px 7px',
                                                  background: 'rgba(255, 255, 255, 0.04)',
                                                  borderRadius: '4px',
                                                  border: '1px solid var(--border-subtle)',
                                                }}
                                              >
                                                <strong style={{ color: '#c7d2fe' }}>{f.replace(/_/g, ' ')}</strong>:{' '}
                                                <span style={{ color: '#f87171' }}>{String(diff?.from ?? 'empty')}</span> ➔{' '}
                                                <span style={{ color: '#34d399' }}>{String(diff?.to ?? 'empty')}</span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span>{JSON.stringify(log.metadata)}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span>{JSON.stringify(log.metadata)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* REASSIGNMENT MODAL */}
        {showReassignModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Reassign Lead</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Select a Business Relations team member to manage {lead?.lead_code}:
              </p>

              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="input-field"
                style={{ background: '#0f172a', marginBottom: '18px' }}
              >
                <option value="">Select Representative...</option>
                {managersList
                  .filter((m: any) => m.id !== lead?.manager_id)
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.user_code})
                    </option>
                  ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowReassignModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleReassign} disabled={!selectedManagerId || isReassigning} className="btn-primary">
                  {isReassigning ? 'Reassigning...' : 'Confirm Reassign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION FOR DUPLICATE ACTION */}
        {confirmDuplicateAction && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '8px' }}>
                {confirmDuplicateAction === 'clear' ? 'Clear Duplicate Flag?' : 'Disqualify Lead as Duplicate?'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {confirmDuplicateAction === 'clear'
                  ? `Are you sure you want to verify and clear the duplicate warning on ${lead?.lead_code}? This action will be recorded in the audit history.`
                  : `Are you sure you want to mark ${lead?.lead_code} as Disqualified/Lost due to duplicate conflict?`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setConfirmDuplicateAction(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => handleDuplicateAction(confirmDuplicateAction === 'clear' ? 'clear_flag' : 'disqualify')}
                  className="btn-primary"
                  style={{
                    background: confirmDuplicateAction === 'clear' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  }}
                >
                  {confirmDuplicateAction === 'clear' ? 'Yes, Clear Flag' : 'Yes, Disqualify Lead'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
