'use client';

import React, { useState, useEffect } from 'react';

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
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                fontWeight: 600,
                flexShrink: 0,
                background: activeTab === t.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === t.id ? '#ffffff' : 'var(--text-secondary)',
                border: activeTab === t.id ? '1px solid #818cf8' : '1px solid transparent',
              }}
            >
              {t.icon} {t.label}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                        {lead.preferred_slot_date ? new Date(lead.preferred_slot_date).toLocaleDateString('en-IN') : ''} at {lead.preferred_slot_time || 'Anytime'} ({lead.preferred_slot_mode})
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
              )}

              {/* TAB 2: PERSONAL NOTES */}
              {activeTab === 'personal_notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    🔒 <strong>Personal Notes:</strong> Visible exclusively to you and system administrators.
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
                      personalNotes.map((note) => (
                        <div key={note.id} style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #818cf8' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {auditLogs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{log.actor_name}</strong>: <span style={{ color: '#818cf8', fontWeight: 600 }}>{log.action}</span>
                        {log.metadata && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>{JSON.stringify(log.metadata)}</div>}
                      </div>
                    </div>
                  ))}
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
                {availableManagers.map((m: any) => (
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
