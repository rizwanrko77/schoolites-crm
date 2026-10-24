'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatSlotDate, formatSlotTime } from '@/lib/slotFormat';
import CreateLeadModal from '@/components/CreateLeadModal';
import { LEAD_STATUSES, getStatusMeta } from '@/lib/leadStatuses';

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
  const [activeTab, setActiveTab] = useState<'details' | 'personal_notes' | 'global_remarks' | 'history' | 'contract'>('details');

  // Contract & Invoices state
  const [contract, setContract] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Contract form modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractFormData, setContractFormData] = useState({
    contract_amount: '',
    duration_months: 12,
    start_date: '',
    end_date: '',
    status: 'active',
    notes: '',
  });
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [contractError, setContractError] = useState('');

  // Invoice form modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState({
    invoice_number: '',
    amount: '',
    raise_date: '',
    due_date: '',
    status: 'raised',
    notes: '',
  });
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  // Mark Cleared modal
  const [clearingInvoice, setClearingInvoice] = useState<any | null>(null);
  const [clearFormData, setClearFormData] = useState({
    payment_method: 'Bank Transfer / NEFT / RTGS',
    payment_reference: '',
    cleared_at: '',
  });
  const [isClearingInvoice, setIsClearingInvoice] = useState(false);

  // New Note state
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Status updating state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ from: string; to: string } | null>(null);
  const [pendingManagerId, setPendingManagerId] = useState<string>('');

  // Reassignment state
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Sensitive Duplicate Action confirmation
  const [confirmDuplicateAction, setConfirmDuplicateAction] = useState<'clear' | 'disqualify' | null>(null);

  // Edit Lead modal state
  const [isEditing, setIsEditing] = useState(false);

  // Reassignment managers list
  const [managersList, setManagersList] = useState<any[]>(availableManagers);

  // Computed values
  const totalInvoiced = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  }, [invoices]);

  const totalCleared = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'cleared')
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  }, [invoices]);

  const contractAmountNum = parseFloat(contract?.contract_amount) || 0;
  const pendingBalance = Math.max(0, contractAmountNum - totalCleared);

  const isAdmin = currentUser?.role === 'admin';
  const isContractEligibleRole = isAdmin || currentUser?.role === 'business_relations';
  const showContractTab = isContractEligibleRole && (lead?.status === 'won' || Boolean(contract));

  useEffect(() => {
    if (availableManagers && availableManagers.length > 0) {
      setManagersList(availableManagers);
    } else if (currentUser?.role === 'admin' || currentUser?.role === 'business_relations') {
      fetch('/api/leads/managers')
        .then((res) => (res.ok ? res.json() : { managers: [] }))
        .then((data) => setManagersList(data.managers || []))
        .catch((err) => console.error(err));
    }
  }, [availableManagers, currentUser, showReassignModal, pendingStatusChange]);

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
      setContract(data.contract || null);
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const handleStatusChange = async (newStatus: string, managerId?: string | null) => {
    setIsUpdatingStatus(true);
    try {
      const payload: any = { status: newStatus };
      if (newStatus === 'unassigned') {
        payload.manager_id = null;
      } else if (managerId) {
        payload.manager_id = managerId;
      }

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        fetchLeadDetails();
        onLeadUpdated();
        setPendingStatusChange(null);
        setPendingManagerId('');
      } else {
        alert(data.error || 'Failed to update stage');
      }
    } catch {
      alert('Failed to update stage');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenContractModal = (existingContract?: any) => {
    if (existingContract) {
      setContractFormData({
        contract_amount: existingContract.contract_amount || '',
        duration_months: existingContract.duration_months || 12,
        start_date: existingContract.start_date ? existingContract.start_date.split('T')[0] : '',
        end_date: existingContract.end_date ? existingContract.end_date.split('T')[0] : '',
        status: existingContract.status || 'active',
        notes: existingContract.notes || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setContractFormData({
        contract_amount: lead?.deal_value ? String(lead.deal_value) : '',
        duration_months: 12,
        start_date: today,
        end_date: nextYear.toISOString().split('T')[0],
        status: 'active',
        notes: '',
      });
    }
    setContractError('');
    setShowContractModal(true);
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setContractError('');
    setIsSavingContract(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save contract');
      setShowContractModal(false);
      fetchLeadDetails();
      onLeadUpdated();
    } catch (err: any) {
      setContractError(err.message || 'Error saving contract');
    } finally {
      setIsSavingContract(false);
    }
  };

  const handleOpenInvoiceModal = (inv?: any) => {
    if (inv) {
      setEditingInvoiceId(inv.id);
      setInvoiceFormData({
        invoice_number: inv.invoice_number || '',
        amount: String(inv.amount || ''),
        raise_date: inv.raise_date ? inv.raise_date.split('T')[0] : '',
        due_date: inv.due_date ? inv.due_date.split('T')[0] : '',
        status: inv.status || 'raised',
        notes: inv.notes || '',
      });
    } else {
      setEditingInvoiceId(null);
      const today = new Date().toISOString().split('T')[0];
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 15);
      setInvoiceFormData({
        invoice_number: '', // Do not prefill
        amount: '',
        raise_date: today,
        due_date: nextDue.toISOString().split('T')[0],
        status: 'raised',
        notes: '',
      });
    }
    setInvoiceError('');
    setShowInvoiceModal(true);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceError('');
    setIsSavingInvoice(true);
    try {
      const url = editingInvoiceId
        ? `/api/leads/${lead.id}/invoices/${editingInvoiceId}`
        : `/api/leads/${lead.id}/invoices`;
      const method = editingInvoiceId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save invoice');
      setShowInvoiceModal(false);
      setEditingInvoiceId(null);
      fetchLeadDetails();
      onLeadUpdated();
    } catch (err: any) {
      setInvoiceError(err.message || 'Error saving invoice');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleMarkCleared = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearingInvoice) return;
    setIsClearingInvoice(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/invoices/${clearingInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cleared',
          payment_method: clearFormData.payment_method,
          payment_reference: clearFormData.payment_reference,
          cleared_at: clearFormData.cleared_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark invoice as cleared');
      setClearingInvoice(null);
      fetchLeadDetails();
      onLeadUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice');
    } finally {
      setIsClearingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string, invoiceNum: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoiceNum}?`)) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLeadDetails();
        onLeadUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete invoice');
      }
    } catch {
      alert('Error deleting invoice');
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
    setIsEditing(true);
  };

  const isDealClosed = lead?.status === 'won' || lead?.status === 'lost';
  const canEditLead =
    (currentUser?.role === 'admin' || currentUser?.id === lead?.owner_id || currentUser?.id === lead?.manager_id) &&
    (!isDealClosed || currentUser?.role === 'admin');

  const personalNotes = notes.filter((n) => n.visibility === 'personal');
  const globalRemarks = notes.filter((n) => n.visibility === 'global');

  if (!leadId) return null;

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
                    {getStatusMeta(lead?.status).label}
                  </span>
                );
              }

              return (
                <select
                  value={lead?.status || 'unassigned'}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    if (nextVal !== (lead?.status || 'unassigned')) {
                      setPendingStatusChange({ from: lead?.status || 'unassigned', to: nextVal });
                      if ((!lead?.manager_id || lead?.status === 'unassigned') && nextVal !== 'unassigned') {
                        if (currentUser?.role === 'business_relations') {
                          setPendingManagerId(currentUser.id);
                        } else {
                          setPendingManagerId('');
                        }
                      } else {
                        setPendingManagerId('');
                      }
                    }
                  }}
                  disabled={isUpdatingStatus}
                  className="input-field"
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: '#0f172a',
                    color: getStatusMeta(lead?.status).color,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                  }}
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
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
            ...(showContractTab ? [{ id: 'contract', label: `Contract & Invoices ${invoices.length > 0 ? `(${invoices.length})` : ''}`, icon: '📄' }] : []),
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
                              {lead?.manager_id ? 'Reassign ⇄' : '+ Assign Manager'}
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

              {/* TAB 5: CONTRACT & INVOICES */}
              {activeTab === 'contract' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {!contract ? (
                    <div
                      className="glass-panel"
                      style={{
                        padding: '40px 24px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '2.5rem' }}>📄</div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                        No Active Contract Configured
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: 0 }}>
                        This deal is closed as <strong>Won</strong>! Setup the signed client contract duration, agreed total value, and start generating milestone invoices.
                      </p>
                      <button
                        onClick={() => handleOpenContractModal()}
                        className="btn-primary"
                        style={{ marginTop: '8px', padding: '10px 20px', fontSize: '0.9rem' }}
                      >
                        + Setup Client Contract
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 1. Metric Ribbon */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #818cf8' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Agreed Contract Value
                          </span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                            ₹{Number(contract.contract_amount || 0).toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#c7d2fe', marginTop: '4px' }}>
                            Duration: {contract.duration_months} Months
                          </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #38bdf8' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Total Invoiced
                          </span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                            ₹{totalInvoiced.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {invoices.length} invoice(s) generated
                          </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #10b981' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Cash Collected (Cleared)
                          </span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                            ₹{totalCleared.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#34d399', marginTop: '4px' }}>
                            ● Verified in Bank Account
                          </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid #f59e0b' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Balance Pending
                          </span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                            ₹{pendingBalance.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Potential Uncollected Value
                          </div>
                        </div>
                      </div>

                      {/* 2. Contract Terms Card */}
                      <div className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                              Contract Agreement Terms
                            </h4>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background:
                                  contract.status === 'active'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : contract.status === 'completed'
                                    ? 'rgba(56, 189, 248, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color:
                                  contract.status === 'active'
                                    ? '#34d399'
                                    : contract.status === 'completed'
                                    ? '#38bdf8'
                                    : '#f87171',
                                border: '1px solid currentColor',
                              }}
                            >
                              ● {contract.status} Agreement
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenContractModal(contract)}
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            ✏️ Edit Terms
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '0.88rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>
                              Agreement Period
                            </span>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {contract.start_date ? formatSlotDate(contract.start_date) : 'Not set'} ➔ {contract.end_date ? formatSlotDate(contract.end_date) : 'Not set'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>
                              Duration
                            </span>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {contract.duration_months} Months
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>
                              Configured By
                            </span>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {contract.created_by_name || 'Admin'} {contract.created_by_code ? `(${contract.created_by_code})` : ''}
                            </strong>
                          </div>
                        </div>

                        {contract.notes && (
                          <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', fontSize: '0.84rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                              Contract Notes & Terms
                            </span>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{contract.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* 3. Invoices Table */}
                      <div className="glass-panel" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                              Invoices & Payment Milestones
                            </h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                              Record installments, billings, and track bank collections
                            </p>
                          </div>

                          <button
                            onClick={() => handleOpenInvoiceModal()}
                            className="btn-primary"
                            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                          >
                            + Add Invoice / Installment
                          </button>
                        </div>

                        <div className="table-responsive">
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Invoice #
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Amount
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Raise Date
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Due Date
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Status
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                                  Collection / Bank Ref
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'right' }}>
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No invoices generated yet. Click "+ Add Invoice / Installment" to create the payment schedule.
                                  </td>
                                </tr>
                              ) : (
                                invoices.map((inv) => (
                                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span className="user-code-pill" style={{ color: '#38bdf8' }}>
                                        {inv.invoice_number}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#ffffff' }}>
                                      ₹{Number(inv.amount).toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                      {inv.raise_date ? formatSlotDate(inv.raise_date) : '—'}
                                    </td>
                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                      {inv.due_date ? formatSlotDate(inv.due_date) : '—'}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span
                                        style={{
                                          padding: '3px 8px',
                                          borderRadius: '9999px',
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          background:
                                            inv.status === 'cleared'
                                              ? 'rgba(16, 185, 129, 0.15)'
                                              : inv.status === 'pending'
                                              ? 'rgba(245, 158, 11, 0.15)'
                                              : inv.status === 'raised'
                                              ? 'rgba(56, 189, 248, 0.15)'
                                              : 'rgba(239, 68, 68, 0.15)',
                                          color:
                                            inv.status === 'cleared'
                                              ? '#34d399'
                                              : inv.status === 'pending'
                                              ? '#fbbf24'
                                              : inv.status === 'raised'
                                              ? '#38bdf8'
                                              : '#f87171',
                                          border: '1px solid currentColor',
                                        }}
                                      >
                                        {inv.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      {inv.status === 'cleared' ? (
                                        <div style={{ fontSize: '0.8rem' }}>
                                          <div style={{ color: '#34d399', fontWeight: 600 }}>
                                            ✓ {inv.cleared_at ? new Date(inv.cleared_at).toLocaleDateString('en-IN') : 'Cleared'}
                                          </div>
                                          {inv.payment_reference && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                                              Ref: <code style={{ color: '#c7d2fe' }}>{inv.payment_reference}</code>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                          Pending Collection
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                        {inv.status !== 'cleared' && isAdmin && (
                                          <button
                                            onClick={() => {
                                              setClearingInvoice(inv);
                                              setClearFormData({
                                                payment_method: 'Bank Transfer / NEFT / RTGS',
                                                payment_reference: '',
                                                cleared_at: new Date().toISOString().split('T')[0],
                                              });
                                            }}
                                            className="btn-primary"
                                            style={{
                                              padding: '4px 10px',
                                              fontSize: '0.76rem',
                                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            }}
                                          >
                                            Mark Cleared ✓
                                          </button>
                                        )}
                                        {(inv.status !== 'cleared' || isAdmin) && (
                                          <button
                                            onClick={() => handleOpenInvoiceModal(inv)}
                                            className="btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                                            title="Edit invoice"
                                          >
                                            ✏️
                                          </button>
                                        )}
                                        {(inv.status !== 'cleared' || isAdmin) && (
                                          <button
                                            onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                            className="btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '0.76rem', color: '#f87171' }}
                                            title="Delete invoice"
                                          >
                                            🗑️
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
                    </>
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
                {lead?.manager_id ? 'Reassign Lead' : 'Assign Lead'}
              </h3>
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
                  {isReassigning ? 'Saving...' : lead?.manager_id ? 'Confirm Reassign' : 'Confirm Assignment'}
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
        {/* CONFIRMATION FOR STAGE STATUS CHANGE (PREVENT ACCIDENTAL CLICKS) */}
        {pendingStatusChange && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1350,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: '24px',
                background: '#0b1120',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Confirm Stage Transition
                </h3>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                Are you sure you want to change the stage status for <strong>{lead?.institute_name}</strong> ({lead?.lead_code})?
              </p>

              {/* Transition Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '16px',
                }}
              >
                {(() => {
                  const fromMeta = getStatusMeta(pendingStatusChange.from);
                  const toMeta = getStatusMeta(pendingStatusChange.to);
                  return (
                    <>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: fromMeta.color,
                          background: fromMeta.bgColor,
                          border: `1px solid ${fromMeta.borderColor}`,
                        }}
                      >
                        {fromMeta.label}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>➔</span>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: toMeta.color,
                          background: toMeta.bgColor,
                          border: `1px solid ${toMeta.borderColor}`,
                        }}
                      >
                        {toMeta.label}
                      </span>
                    </>
                  );
                })()}
              </div>

              {/* Warning Notice for Unassigning Lead */}
              {pendingStatusChange.to === 'unassigned' && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.84rem',
                    lineHeight: 1.45,
                    marginBottom: '16px',
                  }}
                >
                  <strong>⚠️ Returning to Unassigned Pool:</strong> Changing stage status to{' '}
                  <strong>Unassigned</strong> will automatically remove{' '}
                  <strong>{lead?.manager_name ? `${lead.manager_name} (${lead.manager_code || ''})` : 'the assigned manager'}</strong>{' '}
                  and return this lead to the general unassigned pool.
                </div>
              )}

              {/* Lead Manager Selection when moving out of Unassigned Pool */}
              {(!lead?.manager_id || lead?.status === 'unassigned') && pendingStatusChange.to !== 'unassigned' && (
                <div style={{ marginBottom: '18px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#93c5fd',
                      marginBottom: '6px',
                    }}
                  >
                    Assign Lead Manager <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={pendingManagerId}
                    onChange={(e) => setPendingManagerId(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '0.88rem',
                      background: '#0f172a',
                      border: '1px solid rgba(147, 197, 253, 0.35)',
                    }}
                  >
                    <option value="">-- Select Business Relations Representative --</option>
                    {managersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.user_code}) {m.email ? `• ${m.email}` : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Select which representative will take ownership of this lead in their pipeline.
                  </p>
                </div>
              )}

              {/* Warning Notice for Won / Lost stages */}
              {(pendingStatusChange.to === 'won' || pendingStatusChange.to === 'lost') && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    marginBottom: '18px',
                  }}
                >
                  <strong>⚠️ Closed Deal Governance:</strong> Marking a deal as{' '}
                  <strong>{pendingStatusChange.to === 'won' ? 'Won 🏆' : 'Lost'}</strong> finalizes the deal and locks
                  stage/details modification for regular representatives. Only an Administrator can reopen or edit closed deals.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPendingStatusChange(null);
                    setPendingManagerId('');
                  }}
                  disabled={isUpdatingStatus}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetStatus = pendingStatusChange.to;
                    const isAssigningFromPool =
                      (!lead?.manager_id || lead?.status === 'unassigned') && targetStatus !== 'unassigned';
                    await handleStatusChange(targetStatus, isAssigningFromPool ? pendingManagerId : null);
                  }}
                  disabled={
                    isUpdatingStatus ||
                    ((!lead?.manager_id || lead?.status === 'unassigned') &&
                       pendingStatusChange.to !== 'unassigned' &&
                       !pendingManagerId)
                  }
                  className="btn-primary"
                  style={{
                    background:
                      pendingStatusChange.to === 'won'
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : pendingStatusChange.to === 'lost' || pendingStatusChange.to === 'unassigned'
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : undefined,
                  }}
                >
                  {isUpdatingStatus ? 'Updating Stage...' : '✓ Confirm Stage Change'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SETUP / EDIT CONTRACT MODAL */}
        {showContractModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {contract ? 'Edit Client Contract' : 'Setup Client Contract'}
                </h3>
                <button onClick={() => setShowContractModal(false)} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                  ✕
                </button>
              </div>

              {contractError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '14px' }}>
                  {contractError}
                </div>
              )}

              <form onSubmit={handleSaveContract} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      1. Agreement Status <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={contractFormData.status}
                      onChange={(e) => setContractFormData({ ...contractFormData, status: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                    >
                      <option value="active">Active Agreement</option>
                      <option value="completed">Completed / Ended</option>
                      <option value="renewed">Renewed</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      2. Contract Duration (Months) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={contractFormData.duration_months}
                      onChange={(e) => setContractFormData({ ...contractFormData, duration_months: parseInt(e.target.value, 10) || 12 })}
                      className="input-field"
                      placeholder="e.g. 12"
                      style={{ background: '#0f172a' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      3. Start Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={contractFormData.start_date}
                      onChange={(e) => setContractFormData({ ...contractFormData, start_date: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      4. End Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={contractFormData.end_date}
                      onChange={(e) => setContractFormData({ ...contractFormData, end_date: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Agreed Contract Value (₹ INR) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={contractFormData.contract_amount}
                    onChange={(e) => setContractFormData({ ...contractFormData, contract_amount: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 150000"
                    style={{ background: '#0f172a' }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Automatically synchronizes with the lead's deal valuation & revenue calculation.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Agreement Notes / Special Terms
                  </label>
                  <textarea
                    rows={3}
                    value={contractFormData.notes}
                    onChange={(e) => setContractFormData({ ...contractFormData, notes: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 50% on signing, 50% after term 1 onboarding..."
                    style={{ background: '#0f172a', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowContractModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingContract} className="btn-primary">
                    {isSavingContract ? 'Saving...' : 'Save Contract Terms'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE / EDIT INVOICE MODAL */}
        {showInvoiceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {editingInvoiceId ? 'Edit Invoice' : 'Generate Milestone Invoice'}
                </h3>
                <button onClick={() => setShowInvoiceModal(false)} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                  ✕
                </button>
              </div>

              {invoiceError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '14px' }}>
                  {invoiceError}
                </div>
              )}

              <form onSubmit={handleSaveInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Invoice Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceFormData.invoice_number}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_number: e.target.value })}
                    className="input-field"
                    placeholder="e.g. INV-2024-001"
                    style={{ background: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Amount (₹ INR) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={invoiceFormData.amount}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 50000"
                    style={{ background: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Raise Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={invoiceFormData.raise_date}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, raise_date: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={invoiceFormData.due_date}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, due_date: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={invoiceFormData.status}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="raised">Raised (Issued)</option>
                    <option value="pending">Pending Client Clearance</option>
                    {isAdmin && <option value="cleared">Cleared (Collected)</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={invoiceFormData.notes}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                    className="input-field"
                    placeholder="e.g. First tranche / 50% signing advance..."
                    style={{ background: '#0f172a', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowInvoiceModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingInvoice} className="btn-primary">
                    {isSavingInvoice ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MARK CLEARED (PAYMENT COLLECTION) MODAL */}
        {clearingInvoice && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#34d399' }}>
                  ✓ Confirm Payment Clearance
                </h3>
                <button onClick={() => setClearingInvoice(null)} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Record payment clearance details for invoice <strong>{clearingInvoice.invoice_number}</strong> (₹{Number(clearingInvoice.amount).toLocaleString('en-IN')}) into the audited ledger.
              </p>

              <form onSubmit={handleMarkCleared} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Payment Method <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={clearFormData.payment_method}
                    onChange={(e) => setClearFormData({ ...clearFormData, payment_method: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="Bank Transfer / NEFT / RTGS">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="Credit Card / Online Gateway">Credit Card / Online Gateway</option>
                    <option value="Cash">Cash Deposit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Reference <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clearFormData.payment_reference}
                    onChange={(e) => setClearFormData({ ...clearFormData, payment_reference: e.target.value })}
                    className="input-field"
                    placeholder="e.g. UTR / Bank Reference / Cheque #"
                    style={{ background: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Clearance Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={clearFormData.cleared_at}
                    onChange={(e) => setClearFormData({ ...clearFormData, cleared_at: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setClearingInvoice(null)} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isClearingInvoice}
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    {isClearingInvoice ? 'Recording...' : '✓ Mark Cleared'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Unified Edit Lead Modal */}
        {isEditing && lead && (
          <CreateLeadModal
            isOpen={isEditing}
            onClose={() => setIsEditing(false)}
            onSuccess={() => {
              setIsEditing(false);
              fetchLeadDetails();
              onLeadUpdated();
            }}
            leadToEdit={lead}
          />
        )}
      </div>
    </div>
  );
}

