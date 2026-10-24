'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { COUNTRIES } from '@/lib/countries';

const STUDENT_STRENGTH_OPTIONS = [
  'Below 500',
  '500 - 1000',
  '1000 - 2000',
  '2000 - 3000',
  '3000 - 4000',
  '4000+',
];

interface FormField {
  id: string;
  field_key: string;
  label: string;
  category: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  display_order: number;
}

interface OwnerInfo {
  name: string;
  user_code: string;
  role: string;
}

export default function PublicEnquiryPage() {
  return (
    <React.Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            Loading Partner Enquiry Form...
          </div>
        </main>
      }
    >
      <EnquiryContent />
    </React.Suspense>
  );
}

function EnquiryContent() {
  const params = useParams();
  const rawCode = Array.isArray(params?.code) ? params.code[0] : params?.code || '';
  const code = decodeURIComponent(rawCode).toUpperCase();

  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({
    country: 'India',
    institute_type: 'School',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  // Selectable Country state
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!code) return;

    async function loadConfig() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/enquiry-config?code=${code}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Invalid referral link.');
        }

        setOwner(data.owner);
        setFields(data.fields || []);

        // Pre-fill default select fields (keep student capacity unselected so applicant chooses explicitly)
        const initialData: Record<string, any> = { country: 'India', institute_type: 'School' };
        data.fields.forEach((f: FormField) => {
          if (
            f.field_type === 'select' &&
            f.field_key !== 'student_count' &&
            f.field_key !== 'student_strength' &&
            f.options &&
            f.options.length > 0
          ) {
            initialData[f.field_key] = f.options[0];
          }
          if (f.field_key === 'student_count' || f.field_key === 'student_strength') {
            initialData[f.field_key] = '';
          }
        });
        setFormData(initialData);
      } catch (err: any) {
        setLoadError(err.message || 'Unable to load referral page.');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [code]);

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validate phone number if present
    if (formData.phone) {
      const cleanPhone = String(formData.phone).replace(/[^0-9]/g, '');
      if (cleanPhone.length < 7) {
        setSubmitError('Please enter a valid numeric phone number (minimum 7 digits).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_code: code,
          form_data: formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit enquiry.');
      }

      setSubmittedCode(data.enquiry_code);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Loading Partner Enquiry Form...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 70%)',
          padding: '24px',
        }}
      >
        <div className="glass-panel" style={{ maxWidth: '480px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Referral Link Not Found
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '20px' }}>
            {loadError}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Please check the link provided by your Schoolites partner or representative.
          </p>
        </div>
      </main>
    );
  }

  // Success Confirmation Screen
  if (submittedCode) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #064e3b 0%, #0a0d16 70%)',
          padding: '24px',
        }}
      >
        <div
          className="glass-panel"
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: '48px 36px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideUp 0.3s ease',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            }}
          >
            ✓
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
            Thank You for Connecting!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
            Your request has been successfully registered and routed to our dedicated institutional team.
          </p>

          <div
            style={{
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '28px',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Your Reference Code
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em' }}>
              {submittedCode}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Representative Assigned: <strong>{owner?.name}</strong> ({owner?.user_code})
            </div>
          </div>

          <button
            onClick={() => {
              setSubmittedCode(null);
              setFormData({ country: 'India', institute_type: 'School' });
            }}
            className="btn-secondary"
            style={{ fontSize: '0.88rem' }}
          >
            Submit Another Enquiry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 15%, #1e1b4b 0%, #0a0d16 75%)',
        padding: '48px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-panel enquiry-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.25s ease',
        }}
      >
        {/* Header with Representative Attribution */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img
              src="/schoolites-logo.png"
              alt="Schoolites Logo"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#ffffff',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
            />
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '9999px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              fontSize: '0.82rem',
              color: '#c7d2fe',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            <span>🤝</span>
            <span>Dedicated Representative: <strong>{owner?.name}</strong> ({owner?.user_code})</span>
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Schoolites Institution Partnership
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto' }}>
            Transform your campus operations, student engagement, and learning ecosystem with Schoolites.
          </p>
        </div>

        {submitError && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{submitError}</span>
          </div>
        )}

        {/* Dynamic Form generated from Admin Form Config */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {fields.map((field) => {
              const isFullWidth = field.field_type === 'textarea' || field.field_key === 'institute_name' || field.field_key === 'message';

              return (
                <div
                  key={field.id}
                  style={{
                    gridColumn: isFullWidth ? '1 / -1' : 'span 1',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    {field.label} {field.is_required && <span style={{ color: '#f87171' }}>*</span>}
                  </label>

                  {field.field_key === 'country' ? (
                    <div ref={countryDropdownRef} style={{ position: 'relative' }}>
                      <div
                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                        className="input-field"
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#0f172a',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ color: formData.country ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {formData.country || 'Select Country...'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                      </div>

                      {isCountryOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: '#090d16',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                            padding: '8px',
                            marginTop: '4px',
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
                          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 ? (
                              <div style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No matching country
                              </div>
                            ) : (
                              COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
                                <div
                                  key={c}
                                  onClick={() => {
                                    handleInputChange('country', c);
                                    setIsCountryOpen(false);
                                    setCountrySearch('');
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
                  ) : field.field_key === 'student_count' || field.field_key === 'student_strength' ? (
                    <select
                      value={formData[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                      required={field.is_required}
                    >
                      <option value="">Select Student Count / Capacity</option>
                      {STUDENT_STRENGTH_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.field_type === 'select' ? (
                    <select
                      value={formData[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="input-field"
                      style={{ background: '#0f172a' }}
                      required={field.is_required}
                    >
                      {(field.options || ['School', 'College', 'Institution', 'University', 'Other']).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.field_type === 'textarea' ? (
                    <textarea
                      rows={3}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      value={formData[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="input-field"
                      style={{ resize: 'vertical' }}
                      required={field.is_required}
                    />
                  ) : field.field_type === 'number' || field.field_key === 'phone' ? (
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 9876543210"
                      value={formData[field.field_key] || ''}
                      onChange={(e) => {
                        // Allow only numeric digits
                        const numericVal = e.target.value.replace(/[^0-9]/g, '');
                        handleInputChange(field.field_key, numericVal);
                      }}
                      className="input-field"
                      required={field.is_required}
                    />
                  ) : field.field_key === 'email' ? (
                    <input
                      type="email"
                      placeholder="contact@school.edu"
                      value={formData[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="input-field"
                      required={field.is_required}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      value={formData[field.field_key] || ''}
                      onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                      className="input-field"
                      required={field.is_required}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '12px' }}>
            <button
              id="submit-public-enquiry-btn"
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
            >
              {submitting ? 'Submitting Enquiry...' : 'Submit Partnership Enquiry →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              Your details are confidential and will only be used to facilitate your institution connect.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
