'use client';

import React, { useState, useEffect } from 'react';

interface FormFieldConfig {
  id: string;
  form_type: 'enquiry' | 'lead';
  field_key: string;
  label: string;
  category: string;
  field_type: string;
  options: string[];
  is_visible: boolean;
  is_required: boolean;
  display_order: number;
}

export default function AdminFormsPage() {
  const [activeTab, setActiveTab] = useState<'enquiry' | 'lead'>('enquiry');
  const [configs, setConfigs] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // Sensitive Action Confirmation State
  const [confirmFieldAction, setConfirmFieldAction] = useState<{
    field: FormFieldConfig;
    property: 'is_visible' | 'is_required';
  } | null>(null);
  const [isUpdatingField, setIsUpdatingField] = useState(false);

  const fetchConfigs = async (type: 'enquiry' | 'lead') => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/form-configs?form_type=${type}`);
      if (!res.ok) throw new Error('Failed to load form field configurations');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs(activeTab);
  }, [activeTab]);

  const handleExecuteToggle = async () => {
    if (!confirmFieldAction) return;
    const { field, property } = confirmFieldAction;
    const updatedVal = !field[property];

    setIsUpdatingField(true);
    try {
      const res = await fetch('/api/admin/form-configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: field.id, [property]: updatedVal }),
      });
      if (!res.ok) {
        throw new Error('Update failed');
      }
      setToastMsg(
        `Field "${field.label}" ${
          property === 'is_visible'
            ? updatedVal
              ? 'is now visible'
              : 'is now hidden'
            : updatedVal
            ? 'is now required (mandatory)'
            : 'is now optional'
        }.`
      );
      setTimeout(() => setToastMsg(''), 3500);
      setConfirmFieldAction(null);
      fetchConfigs(activeTab);
    } catch {
      alert('Failed to update field configuration');
    } finally {
      setIsUpdatingField(false);
    }
  };

  return (
    <div className="workspace-container">
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
      <div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Hybrid Form Field Controls
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Configure visible and required fields for Public Enquiry forms and Lead Creation forms in real-time
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('enquiry')}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'enquiry' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.04)',
            color: activeTab === 'enquiry' ? '#ffffff' : 'var(--text-secondary)',
            border: activeTab === 'enquiry' ? 'none' : '1px solid var(--border-subtle)',
            boxShadow: activeTab === 'enquiry' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📝</span>
          <span>Public Enquiry Form (10 Fields)</span>
        </button>

        <button
          onClick={() => setActiveTab('lead')}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'lead' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.04)',
            color: activeTab === 'lead' ? '#ffffff' : 'var(--text-secondary)',
            border: activeTab === 'lead' ? 'none' : '1px solid var(--border-subtle)',
            boxShadow: activeTab === 'lead' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🎯</span>
          <span>Lead Creation Form (24 Fields)</span>
        </button>
      </div>

      {/* Fields Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Field Label & Key
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Category
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Input Type
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'center' }}>
                  Visibility
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'center' }}>
                  Requirement
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading field settings...
                  </td>
                </tr>
              ) : (
                configs.map((field) => (
                  <tr
                    key={field.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      opacity: field.is_visible ? 1 : 0.55,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {field.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {field.field_key}
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {field.category.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {field.field_type}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button
                        onClick={() => setConfirmFieldAction({ field, property: 'is_visible' })}
                        title={field.is_visible ? 'Click to hide field' : 'Click to make field visible'}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '9999px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: field.is_visible ? 'var(--success-bg)' : 'rgba(255, 255, 255, 0.05)',
                          color: field.is_visible ? '#34d399' : 'var(--text-muted)',
                          border: field.is_visible ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {field.is_visible ? '● Visible' : '○ Hidden'}
                      </button>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button
                        onClick={() => setConfirmFieldAction({ field, property: 'is_required' })}
                        disabled={!field.is_visible}
                        title={field.is_required ? 'Click to make optional' : 'Click to make mandatory'}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '9999px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: field.is_visible ? 'pointer' : 'not-allowed',
                          background: field.is_required ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                          color: field.is_required ? '#f87171' : 'var(--text-muted)',
                          border: field.is_required ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {field.is_required ? '★ Mandatory' : 'Optional'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION MODAL FOR FORM FIELD ACTION */}
      {confirmFieldAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                ⚙️
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Confirm Field Configuration</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {activeTab === 'enquiry' ? 'Public Enquiry Form' : 'Lead Creation Form'}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              {confirmFieldAction.property === 'is_visible' ? (
                confirmFieldAction.field.is_visible ? (
                  <>
                    Are you sure you want to <strong style={{ color: '#f87171' }}>hide</strong> the field{' '}
                    <strong style={{ color: '#ffffff' }}>"{confirmFieldAction.field.label}"</strong>? Visitors or team members will no longer see or submit this field.
                  </>
                ) : (
                  <>
                    Are you sure you want to make{' '}
                    <strong style={{ color: '#ffffff' }}>"{confirmFieldAction.field.label}"</strong> <strong style={{ color: '#34d399' }}>visible</strong> on the form?
                  </>
                )
              ) : confirmFieldAction.field.is_required ? (
                <>
                  Are you sure you want to make{' '}
                  <strong style={{ color: '#ffffff' }}>"{confirmFieldAction.field.label}"</strong> <strong style={{ color: '#38bdf8' }}>optional</strong> instead of mandatory?
                </>
              ) : (
                <>
                  Are you sure you want to make{' '}
                  <strong style={{ color: '#ffffff' }}>"{confirmFieldAction.field.label}"</strong> <strong style={{ color: '#f87171' }}>mandatory (required)</strong>? Users will not be able to submit without filling this field.
                </>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmFieldAction(null)}
                className="btn-secondary"
                disabled={isUpdatingField}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteToggle}
                className="btn-primary"
                disabled={isUpdatingField}
              >
                {isUpdatingField ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
