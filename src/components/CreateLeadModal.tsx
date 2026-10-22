'use client';

import React, { useState, useEffect, useRef } from 'react';
import { COUNTRIES } from '@/lib/countries';

const STUDENT_STRENGTH_OPTIONS = [
  'Below 500',
  '500 - 1000',
  '1000 - 2000',
  '2000 - 3000',
  '3000 - 4000',
  '4000+',
];

export const EXPECTED_START_OPTIONS = [
  'Immediately (Within 1-2 weeks)',
  'Within 1 Month',
  'Within 2-3 Months',
  'Next Academic Session',
  'Flexible / Exploring',
  'Specific Date...',
];

function mapStudentStrength(val: string | number | null | undefined): string {
  if (!val) return '';
  const str = String(val).trim();
  if (STUDENT_STRENGTH_OPTIONS.includes(str)) return str;
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return '';
  if (num < 500) return 'Below 500';
  if (num <= 1000) return '500 - 1000';
  if (num <= 2000) return '1000 - 2000';
  if (num <= 3000) return '2000 - 3000';
  if (num <= 4000) return '3000 - 4000';
  return '4000+';
}

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: any, duplicateWarning?: string) => void;
  initialEnquiry?: any | null;
}

const DRAFT_STORAGE_KEY = 'schoolites_lead_form_draft';

const INITIAL_BLANK_LEAD_FORM = {
  institute_type: '',
  institute_name: '',
  country: 'India',
  city: '',
  student_strength: '',
  current_erp: '',
  current_erp_name: '',
  spoc_name: '',
  spoc_role: '',
  spoc_phone: '',
  spoc_email: '',
  dm_same_as_spoc: false,
  dm_name: '',
  dm_role: '',
  dm_phone: '',
  dm_email: '',
  additional_contact_name: '',
  additional_contact_role: '',
  additional_contact_phone: '',
  additional_contact_email: '',
  decision_flow: '',
  preferred_slot_date: '',
  preferred_slot_time: '',
  preferred_slot_mode: '',
  expected_start_date: '',
  additional_details: '',
};

export default function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  initialEnquiry,
}: CreateLeadModalProps) {
  const [formData, setFormData] = useState<any>(INITIAL_BLANK_LEAD_FORM);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdditionalContact, setShowAdditionalContact] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Expected Start Date Hybrid State
  const [startPreset, setStartPreset] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');

  const handleStartPresetChange = (preset: string) => {
    setStartPreset(preset);
    if (preset === 'Specific Date...') {
      setFormData((prev: any) => ({ ...prev, expected_start_date: customStartDate || '' }));
    } else {
      setFormData((prev: any) => ({ ...prev, expected_start_date: preset }));
    }
  };

  const handleCustomDateChange = (dateVal: string) => {
    setCustomStartDate(dateVal);
    setFormData((prev: any) => ({ ...prev, expected_start_date: dateVal }));
  };

  // Searchable Country Dropdown State
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Admin Form Field Configurations State
  interface FieldConfig {
    field_key: string;
    label: string;
    category: string;
    field_type: string;
    options: string[];
    is_visible: boolean;
    is_required: boolean;
  }

  const [fieldConfigs, setFieldConfigs] = useState<Record<string, FieldConfig>>({});

  // Core fields that must never be hidden to maintain CRM integrity
  const CORE_REQUIRED_FIELDS = ['institute_name', 'spoc_name', 'spoc_phone'];

  const isVisible = (key: string, defaultVal = true): boolean => {
    if (CORE_REQUIRED_FIELDS.includes(key)) return true;
    if (fieldConfigs[key]) return fieldConfigs[key].is_visible;
    return defaultVal;
  };

  const isRequired = (key: string, defaultVal = false): boolean => {
    if (CORE_REQUIRED_FIELDS.includes(key)) return true;
    if (fieldConfigs[key]) return fieldConfigs[key].is_required;
    return defaultVal;
  };

  const isAnyVisible = (keys: string[]): boolean => keys.some((k) => isVisible(k));

  // Fetch lead field configs from /api/leads/config when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadConfigs() {
      try {
        const res = await fetch('/api/leads/config');
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.configs)) {
            const map: Record<string, FieldConfig> = {};
            data.configs.forEach((c: FieldConfig) => {
              map[c.field_key] = c;
            });
            setFieldConfigs(map);
          }
        }
      } catch (err) {
        console.warn('Failed to load lead field configs, using defaults', err);
      }
    }

    loadConfigs();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset or pre-fill form when modal opens or initialEnquiry changes (with draft restoration)
  useEffect(() => {
    if (!isOpen) return;

    if (initialEnquiry) {
      setFormData({
        ...INITIAL_BLANK_LEAD_FORM,
        institute_type: initialEnquiry.institute_type || '',
        institute_name: initialEnquiry.institute_name || '',
        country: initialEnquiry.country || 'India',
        city: initialEnquiry.city || '',
        student_strength: initialEnquiry.student_count ? mapStudentStrength(initialEnquiry.student_count) : '',
        current_erp: '',
        current_erp_name: '',
        spoc_name: initialEnquiry.spoc_name || '',
        spoc_role: '',
        spoc_phone: initialEnquiry.phone || '',
        spoc_email: initialEnquiry.email || '',
        dm_same_as_spoc: false,
        dm_name: '',
        dm_role: '',
        dm_phone: '',
        dm_email: '',
        additional_contact_name: '',
        additional_contact_role: '',
        additional_contact_phone: '',
        additional_contact_email: '',
        decision_flow: '',
        preferred_slot_date: '',
        preferred_slot_time: '',
        preferred_slot_mode: '',
        expected_start_date: '',
        additional_details: initialEnquiry.message ? `Requirements from Enquiry: ${initialEnquiry.message}` : '',
        source_enquiry_id: initialEnquiry.id,
      });
      setStartPreset('');
      setCustomStartDate('');
      setShowAdditionalContact(false);
      setError('');
    } else {
      // Check for previously saved local draft in browser
      let restoredFromDraft = false;
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_STORAGE_KEY) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.formData) {
            setFormData({
              ...INITIAL_BLANK_LEAD_FORM,
              ...parsed.formData,
              country: parsed.formData.country || 'India',
            });
            if (parsed.startPreset !== undefined) setStartPreset(parsed.startPreset);
            if (parsed.customStartDate !== undefined) setCustomStartDate(parsed.customStartDate);
            if (parsed.showAdditionalContact !== undefined) setShowAdditionalContact(Boolean(parsed.showAdditionalContact));
            restoredFromDraft = true;
          }
        }
      } catch (err) {
        console.warn('Could not restore lead draft from localStorage:', err);
      }

      if (!restoredFromDraft) {
        setFormData(INITIAL_BLANK_LEAD_FORM);
        setStartPreset('');
        setCustomStartDate('');
        setShowAdditionalContact(false);
      }
      setError('');
    }
  }, [isOpen, initialEnquiry]);

  // Auto-save form draft to localStorage whenever fields change (for fresh leads, not inbound conversions)
  useEffect(() => {
    if (!isOpen || initialEnquiry) return;

    // Check if any field differs from blank defaults
    const hasData = Object.keys(formData).some((k) => {
      if (k === 'country') return false; // India is the preset default
      return Boolean(formData[k]);
    }) || Boolean(customStartDate) || showAdditionalContact;

    if (hasData) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            formData,
            startPreset,
            customStartDate,
            showAdditionalContact,
          })
        );
      } catch (e) {
        console.warn('Failed to auto-save lead draft to localStorage', e);
      }
    } else {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) { }
    }
  }, [formData, startPreset, customStartDate, showAdditionalContact, isOpen, initialEnquiry]);

  // Auto-revert clear confirmation after 4 seconds
  useEffect(() => {
    if (confirmClear) {
      const timer = setTimeout(() => setConfirmClear(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmClear]);

  // Clear all entered details with 2-stage inline confirmation
  const handleClearForm = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) { }
    setFormData(INITIAL_BLANK_LEAD_FORM);
    setStartPreset('');
    setCustomStartDate('');
    setShowAdditionalContact(false);
    setError('');
  };


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

    // Dynamic Validation against Admin Form Field Configurations
    for (const [key, cfg] of Object.entries(fieldConfigs)) {
      if (cfg.is_visible && cfg.is_required) {
        if (formData.dm_same_as_spoc && key.startsWith('dm_')) continue;
        if (key.startsWith('additional_contact_') && !showAdditionalContact) continue;

        const val = formData[key];
        if (val === undefined || val === null || String(val).trim() === '') {
          setError(`${cfg.label || key} is mandatory.`);
          return;
        }
      }
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

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) { }

      onSuccess(data.lead, data.duplicate_warning);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="glass-panel modal-dialog">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Create New Lead</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {initialEnquiry ? `Converting from Enquiry ${initialEnquiry.enquiry_code}` : 'Register a qualified school/institution into the active pipeline'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              id="clear-lead-form-btn"
              type="button"
              onClick={handleClearForm}
              title={confirmClear ? 'Click again to confirm reset' : 'Clear all fields'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: confirmClear ? '#ffffff' : '#f87171',
                background: confirmClear ? '#dc2626' : 'rgba(239, 68, 68, 0.08)',
                border: confirmClear ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!confirmClear) {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                if (!confirmClear) {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                }
              }}
            >
              <span>{confirmClear ? '⚠️' : '🗑️'}</span>
              <span>{confirmClear ? 'Confirm Clear?' : 'Clear Form'}</span>
            </button>
            <button
              id="close-lead-modal-btn"
              type="button"
              onClick={onClose}
              style={{
                color: 'var(--text-muted)',
                fontSize: '1.4rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
              }}
              title="Close modal"
            >
              ✕
            </button>
          </div>
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
              {isVisible('institute_type') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Institute Type {isRequired('institute_type', true) ? '*' : ''}
                  </label>
                  <select
                    value={formData.institute_type}
                    onChange={(e) => setFormData({ ...formData, institute_type: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                    required={isRequired('institute_type', true)}
                  >
                    <option value="">-- Select Institute Type --</option>
                    <option value="School">School</option>
                    <option value="College">College</option>
                    <option value="Institution">Institution</option>
                    <option value="University">University</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div className="col-span-2-responsive">
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

              {isVisible('country') && (
                <div ref={countryDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Country {isRequired('country', true) ? '*' : ''}
                  </label>
                  <div
                    onClick={() => {
                      setIsCountryOpen(!isCountryOpen);
                      setCountrySearch('');
                    }}
                    className="input-field"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: '#0f172a',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ color: formData.country ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {formData.country || 'India'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isCountryOpen ? '▲' : '▼'}</span>
                  </div>

                  {isCountryOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: '#090d16',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                        padding: '8px',
                        animation: 'fadeIn 0.15s ease',
                      }}
                    >
                      <div style={{ marginBottom: '6px' }}>
                        <input
                          type="text"
                          autoFocus
                          placeholder="🔍 Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="input-field"
                          style={{ padding: '8px 12px', fontSize: '0.84rem', width: '100%', background: '#0f172a' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            No matching country
                          </div>
                        ) : (
                          COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
                            <div
                              key={c}
                              onClick={() => {
                                setFormData((prev: any) => ({ ...prev, country: c }));
                                setIsCountryOpen(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                fontSize: '0.84rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: formData.country === c ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                color: formData.country === c ? '#c7d2fe' : 'var(--text-primary)',
                                fontWeight: formData.country === c ? 600 : 400,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => {
                                if (formData.country !== c) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                if (formData.country !== c) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{c}</span>
                              {formData.country === c && <span style={{ color: '#818cf8', fontSize: '0.8rem' }}>✓</span>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isVisible('city') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    City {isRequired('city', true) ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-field"
                    required={isRequired('city', true)}
                  />
                </div>
              )}

              {isVisible('student_strength') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Student Strength {isRequired('student_strength', true) ? '*' : ''}
                  </label>
                  <select
                    value={formData.student_strength}
                    onChange={(e) => setFormData({ ...formData, student_strength: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                    required={isRequired('student_strength', true)}
                  >
                    <option value="">-- Select Student Strength --</option>
                    {STUDENT_STRENGTH_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isVisible('current_erp') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Current ERP System {isRequired('current_erp', true) ? '*' : ''}
                  </label>
                  <select
                    value={formData.current_erp}
                    onChange={(e) => setFormData({ ...formData, current_erp: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                    required={isRequired('current_erp', true)}
                  >
                    <option value="">-- Select Current ERP Status --</option>
                    <option value="yes">YES (Active System)</option>
                    <option value="no">NO (None)</option>
                    <option value="unsure">Unsure</option>
                  </select>
                </div>
              )}

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
              2. Contact Persons (SPOC, Decision Maker & Additional Contacts)
            </h3>

            {/* SPOC */}
            <div className="contact-grid-2col" style={{ marginBottom: '16px' }}>
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

              {isVisible('spoc_role') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    SPOC Designation {isRequired('spoc_role', true) ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Principal, Director, Admin Head"
                    value={formData.spoc_role}
                    onChange={(e) => setFormData({ ...formData, spoc_role: e.target.value })}
                    className="input-field"
                    autoComplete="off"
                    required={isRequired('spoc_role', true)}
                  />
                </div>
              )}

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

              {isVisible('spoc_email') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    SPOC Email {isRequired('spoc_email', false) ? '*' : ''}
                  </label>
                  <input
                    type="email"
                    placeholder="spoc@institution.edu"
                    value={formData.spoc_email}
                    onChange={(e) => setFormData({ ...formData, spoc_email: e.target.value })}
                    className="input-field"
                    required={isRequired('spoc_email', false)}
                  />
                </div>
              )}
            </div>

            {/* Checkbox: Same as SPOC */}
            {isVisible('dm_same_as_spoc') && (
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
            )}

            {/* Decision Maker if different */}
            {!formData.dm_same_as_spoc && isAnyVisible(['dm_name', 'dm_role', 'dm_phone', 'dm_email']) && (
              <div className="contact-grid-2col" style={{ marginBottom: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
                {isVisible('dm_name') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Decision Maker Name {isRequired('dm_name', true) ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      placeholder="Trustee / Chairperson / Director"
                      value={formData.dm_name}
                      onChange={(e) => setFormData({ ...formData, dm_name: e.target.value })}
                      className="input-field"
                      required={!formData.dm_same_as_spoc && isRequired('dm_name', true)}
                    />
                  </div>
                )}

                {isVisible('dm_role') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      DM Designation {isRequired('dm_role', true) ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Trustee, Chairperson, Director"
                      value={formData.dm_role}
                      onChange={(e) => setFormData({ ...formData, dm_role: e.target.value })}
                      className="input-field"
                      autoComplete="off"
                      required={!formData.dm_same_as_spoc && isRequired('dm_role', true)}
                    />
                  </div>
                )}

                {isVisible('dm_phone') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      DM Mobile / WhatsApp {isRequired('dm_phone', true) ? '*' : ''}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Direct mobile number"
                      value={formData.dm_phone}
                      onChange={(e) => setFormData({ ...formData, dm_phone: e.target.value.replace(/[^0-9]/g, '') })}
                      className="input-field"
                      required={!formData.dm_same_as_spoc && isRequired('dm_phone', true)}
                    />
                  </div>
                )}

                {isVisible('dm_email') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      DM Email {isRequired('dm_email', false) ? '*' : ''}
                    </label>
                    <input
                      type="email"
                      placeholder="dm@institution.edu"
                      value={formData.dm_email}
                      onChange={(e) => setFormData({ ...formData, dm_email: e.target.value })}
                      className="input-field"
                      required={!formData.dm_same_as_spoc && isRequired('dm_email', false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Optional Additional Contact Person */}
            {isAnyVisible(['additional_contact_name', 'additional_contact_role', 'additional_contact_phone', 'additional_contact_email']) && (
              <div style={{ marginTop: '14px' }}>
                {!showAdditionalContact ? (
                  <button
                    type="button"
                    onClick={() => setShowAdditionalContact(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px dashed rgba(99, 102, 241, 0.35)',
                      color: '#818cf8',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                    }}
                  >
                    <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>+</span>
                    <span>Add Additional Contact Details</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      (Optional — IT Coordinator, Vice Principal, Admin, etc.)
                    </span>
                  </button>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      animation: 'fadeIn 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem' }}>👤</span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Additional Contact Person (Optional)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdditionalContact(false);
                          setFormData((prev: any) => ({
                            ...prev,
                            additional_contact_name: '',
                            additional_contact_role: '',
                            additional_contact_phone: '',
                            additional_contact_email: '',
                          }));
                        }}
                        style={{
                          fontSize: '0.78rem',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="contact-grid-2col">
                      {isVisible('additional_contact_name') && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                            Contact Person Name {isRequired('additional_contact_name', false) ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Mr. Ramesh Sharma"
                            value={formData.additional_contact_name}
                            onChange={(e) => setFormData({ ...formData, additional_contact_name: e.target.value })}
                            className="input-field"
                            required={showAdditionalContact && isRequired('additional_contact_name', false)}
                          />
                        </div>
                      )}

                      {isVisible('additional_contact_role') && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                            Designation / Role {isRequired('additional_contact_role', false) ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. IT Coordinator / Vice Principal"
                            value={formData.additional_contact_role}
                            onChange={(e) => setFormData({ ...formData, additional_contact_role: e.target.value })}
                            className="input-field"
                            autoComplete="off"
                            required={showAdditionalContact && isRequired('additional_contact_role', false)}
                          />
                        </div>
                      )}

                      {isVisible('additional_contact_phone') && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                            Mobile / WhatsApp {isRequired('additional_contact_phone', false) ? '*' : ''}
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="Direct contact number"
                            value={formData.additional_contact_phone}
                            onChange={(e) => setFormData({ ...formData, additional_contact_phone: e.target.value.replace(/[^0-9]/g, '') })}
                            className="input-field"
                            required={showAdditionalContact && isRequired('additional_contact_phone', false)}
                          />
                        </div>
                      )}

                      {isVisible('additional_contact_email') && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                            Email Address {isRequired('additional_contact_email', false) ? '*' : ''}
                          </label>
                          <input
                            type="email"
                            placeholder="contact@institution.edu"
                            value={formData.additional_contact_email}
                            onChange={(e) => setFormData({ ...formData, additional_contact_email: e.target.value })}
                            className="input-field"
                            required={showAdditionalContact && isRequired('additional_contact_email', false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Decision Flow & Preferred Connect Slot */}
          {isAnyVisible(['preferred_slot_date', 'preferred_slot_time', 'preferred_slot_mode', 'expected_start_date', 'decision_flow', 'additional_details']) && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                3. Pipeline Flow & Preferred Connect Slot
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                {isVisible('preferred_slot_date') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Preferred Slot Date {isRequired('preferred_slot_date', false) ? '*' : ''}
                    </label>
                    <input
                      type="date"
                      value={formData.preferred_slot_date}
                      onChange={(e) => setFormData({ ...formData, preferred_slot_date: e.target.value })}
                      className="input-field"
                      style={{ colorScheme: 'dark' }}
                      required={isRequired('preferred_slot_date', false)}
                    />
                  </div>
                )}

                {isVisible('preferred_slot_time') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Preferred Slot Time {isRequired('preferred_slot_time', false) ? '*' : ''}
                    </label>
                    <input
                      type="time"
                      value={formData.preferred_slot_time}
                      onChange={(e) => setFormData({ ...formData, preferred_slot_time: e.target.value })}
                      className="input-field"
                      style={{ colorScheme: 'dark' }}
                      required={isRequired('preferred_slot_time', false)}
                    />
                  </div>
                )}

                {isVisible('preferred_slot_mode') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Preferred Mode {isRequired('preferred_slot_mode', false) ? '*' : ''}
                    </label>
                    <select
                      value={formData.preferred_slot_mode}
                      onChange={(e) => setFormData({ ...formData, preferred_slot_mode: e.target.value })}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                      required={isRequired('preferred_slot_mode', false)}
                    >
                      <option value="">-- Select Preferred Mode --</option>
                      <option value="Phone/WhatsApp Call">Phone/WhatsApp Call</option>
                      <option value="Virtual Meet">Virtual Meet</option>
                      <option value="Unsure">Unsure</option>
                    </select>
                  </div>
                )}

                {isVisible('expected_start_date') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Expected Start Date {isRequired('expected_start_date', false) ? '*' : ''}
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                        (How early/late ERP in use)
                      </span>
                    </label>
                    <select
                      value={startPreset}
                      onChange={(e) => handleStartPresetChange(e.target.value)}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                      required={isRequired('expected_start_date', false)}
                    >
                      <option value="">-- Select Expected Start Date --</option>
                      {EXPECTED_START_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {startPreset === 'Specific Date...' && (
                      <div style={{ marginTop: '8px', animation: 'fadeIn 0.15s ease' }}>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => handleCustomDateChange(e.target.value)}
                          className="input-field"
                          style={{ colorScheme: 'dark', background: '#0f172a' }}
                          required={startPreset === 'Specific Date...'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isVisible('decision_flow') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Decision Flow & Institutional Context {isRequired('decision_flow', false) ? '*' : ''}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Principal evaluates feature fit, Chairman signs commercial agreement..."
                    value={formData.decision_flow}
                    onChange={(e) => setFormData({ ...formData, decision_flow: e.target.value })}
                    className="input-field"
                    style={{ resize: 'vertical' }}
                    required={isRequired('decision_flow', false)}
                  />
                </div>
              )}

              {isVisible('additional_details') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Additional Details {isRequired('additional_details', false) ? '*' : ''}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any special remarks or background context..."
                    value={formData.additional_details}
                    onChange={(e) => setFormData({ ...formData, additional_details: e.target.value })}
                    className="input-field"
                    style={{ resize: 'vertical' }}
                    required={isRequired('additional_details', false)}
                  />
                </div>
              )}
            </div>
          )}

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
