'use client';

import React, { useState, useEffect } from 'react';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: any, duplicateWarning?: string) => void;
  initialEnquiry?: any | null;
}

export default function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  initialEnquiry,
}: CreateLeadModalProps) {
  const [formData, setFormData] = useState<any>({
    institute_type: 'School',
    institute_name: '',
    country: 'India',
    city: '',
    student_strength: '',
    current_erp: 'unsure',
    current_erp_name: '',
    spoc_name: '',
    spoc_role: 'Principal / Admin Head',
    spoc_phone: '',
    spoc_email: '',
    dm_same_as_spoc: true,
    dm_name: '',
    dm_role: 'Principal / Management',
    dm_phone: '',
    dm_email: '',
    additional_contact_name: '',
    additional_contact_role: 'IT Coordinator / Admin',
    additional_contact_phone: '',
    additional_contact_email: '',
    decision_flow: '',
    preferred_slot_date: '',
    preferred_slot_time: '11:00 AM',
    preferred_slot_mode: 'Call',
    deal_value: '',
    additional_details: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill if enquiry is passed
  useEffect(() => {
    if (initialEnquiry) {
      setFormData((prev: any) => ({
        ...prev,
        source_enquiry_id: initialEnquiry.id,
        institute_type: initialEnquiry.institute_type || 'School',
        institute_name: initialEnquiry.institute_name || '',
        country: initialEnquiry.country || 'India',
        city: initialEnquiry.city || '',
        student_strength: initialEnquiry.student_count || '',
        spoc_name: initialEnquiry.spoc_name || '',
        spoc_phone: initialEnquiry.phone || '',
        spoc_email: initialEnquiry.email || '',
        additional_details: initialEnquiry.message ? `Requirements from Enquiry: ${initialEnquiry.message}` : '',
      }));
    }
  }, [initialEnquiry]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.institute_name.trim()) {
      setError('Institute Name is mandatory.');
      return;
    }
    if (!formData.spoc_name.trim()) {
      setError('SPOC Contact Name is mandatory.');
      return;
    }
    if (!formData.spoc_phone) {
      setError('SPOC Mobile/WhatsApp is mandatory.');
      return;
    }

    const cleanSpocPhone = String(formData.spoc_phone).replace(/[^0-9]/g, '');
    if (cleanSpocPhone.length < 7) {
      setError('SPOC Phone must contain at least 7 numeric digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create lead.');
      }

      onSuccess(data.lead, data.duplicate_warning);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '36px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Create New Pipeline Lead</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {initialEnquiry ? `Converting from Enquiry ${initialEnquiry.enquiry_code}` : 'Register a qualified school/institution into the active pipeline'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              marginBottom: '20px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Section 1: Institution Info */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              1. Institution & Organization Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Institute Type *
                </label>
                <select
                  value={formData.institute_type}
                  onChange={(e) => setFormData({ ...formData, institute_type: e.target.value })}
                  className="input-field"
                  style={{ background: '#0f172a' }}
                >
                  <option value="School">School</option>
                  <option value="College">College</option>
                  <option value="Institution">Institution</option>
                  <option value="University">University</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Institution Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. St. Xavier's High School"
                  value={formData.institute_name}
                  onChange={(e) => setFormData({ ...formData, institute_name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Country *
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  City *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Student Strength *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1500 - 2500"
                  value={formData.student_strength}
                  onChange={(e) => setFormData({ ...formData, student_strength: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Current ERP System *
                </label>
                <select
                  value={formData.current_erp}
                  onChange={(e) => setFormData({ ...formData, current_erp: e.target.value })}
                  className="input-field"
                  style={{ background: '#0f172a' }}
                >
                  <option value="yes">YES (Active System)</option>
                  <option value="no">NO (None)</option>
                  <option value="unsure">Unsure / Mixed</option>
                </select>
              </div>

              {formData.current_erp === 'yes' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Which ERP? (Specify Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fedena, Entab, In-house"
                    value={formData.current_erp_name}
                    onChange={(e) => setFormData({ ...formData, current_erp_name: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: SPOC & Decision Maker */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              2. Contact Persons (SPOC & Decision Maker)
            </h3>

            {/* SPOC */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  SPOC Name *
                </label>
                <input
                  type="text"
                  placeholder="Contact person name"
                  value={formData.spoc_name}
                  onChange={(e) => setFormData({ ...formData, spoc_name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  SPOC Designation *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Principal / Coordinator"
                  value={formData.spoc_role}
                  onChange={(e) => setFormData({ ...formData, spoc_role: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  SPOC Phone / WhatsApp *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="e.g. 9876543210"
                  value={formData.spoc_phone}
                  onChange={(e) => setFormData({ ...formData, spoc_phone: e.target.value.replace(/[^0-9]/g, '') })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  SPOC Email
                </label>
                <input
                  type="email"
                  placeholder="spoc@institution.edu"
                  value={formData.spoc_email}
                  onChange={(e) => setFormData({ ...formData, spoc_email: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {/* Checkbox: Same as SPOC */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.08)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
              }}
            >
              <input
                id="dm-same-checkbox"
                type="checkbox"
                checked={formData.dm_same_as_spoc}
                onChange={(e) => setFormData({ ...formData, dm_same_as_spoc: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="dm-same-checkbox" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                Decision Maker is the Same Person as SPOC
              </label>
            </div>

            {/* Decision Maker if different */}
            {!formData.dm_same_as_spoc && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Decision Maker Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Trustee / Chairperson / Director"
                    value={formData.dm_name}
                    onChange={(e) => setFormData({ ...formData, dm_name: e.target.value })}
                    className="input-field"
                    required={!formData.dm_same_as_spoc}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    DM Designation *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Managing Trustee"
                    value={formData.dm_role}
                    onChange={(e) => setFormData({ ...formData, dm_role: e.target.value })}
                    className="input-field"
                    required={!formData.dm_same_as_spoc}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    DM Mobile / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Direct mobile number"
                    value={formData.dm_phone}
                    onChange={(e) => setFormData({ ...formData, dm_phone: e.target.value.replace(/[^0-9]/g, '') })}
                    className="input-field"
                    required={!formData.dm_same_as_spoc}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    DM Email
                  </label>
                  <input
                    type="email"
                    placeholder="dm@institution.edu"
                    value={formData.dm_email}
                    onChange={(e) => setFormData({ ...formData, dm_email: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Decision Flow & Preferred Connect Slot */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              3. Pipeline Flow & Preferred Connect Slot
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Preferred Slot Date
                </label>
                <input
                  type="date"
                  value={formData.preferred_slot_date}
                  onChange={(e) => setFormData({ ...formData, preferred_slot_date: e.target.value })}
                  className="input-field"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Preferred Slot Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 11:30 AM or 3:00 PM"
                  value={formData.preferred_slot_time}
                  onChange={(e) => setFormData({ ...formData, preferred_slot_time: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Preferred Mode
                </label>
                <select
                  value={formData.preferred_slot_mode}
                  onChange={(e) => setFormData({ ...formData, preferred_slot_mode: e.target.value })}
                  className="input-field"
                  style={{ background: '#0f172a' }}
                >
                  <option value="Call">Phone Call</option>
                  <option value="Meeting">Video / Campus Meeting</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Expected Deal Value (₹ INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={formData.deal_value}
                  onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Decision Flow & Institutional Context
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Principal evaluates feature fit, Chairman signs commercial agreement..."
                value={formData.decision_flow}
                onChange={(e) => setFormData({ ...formData, decision_flow: e.target.value })}
                className="input-field"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Additional Notes
              </label>
              <textarea
                rows={2}
                placeholder="Any special remarks or background context..."
                value={formData.additional_details}
                onChange={(e) => setFormData({ ...formData, additional_details: e.target.value })}
                className="input-field"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button id="submit-create-lead-btn" type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Lead...' : 'Submit Lead to Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
