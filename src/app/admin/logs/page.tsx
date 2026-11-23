'use client';

import React, { useState, useEffect } from 'react';
import { useAdminReady } from '../admin-session';

interface AuditLog {
  id: string;
  record_type: string;
  record_id: string;
  actor_name: string;
  action: string;
  metadata: any;
  created_at: string;
}

type LogCategory = 'all' | 'database' | 'leads' | 'enquiries' | 'users';

export default function AdminLogsPage() {
  const adminReady = useAdminReady();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<LogCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async (category: LogCategory = activeCategory) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      params.append('limit', '120');

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/login';
          return;
        }
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to load logs:', errData.error || res.statusText);
        setLogs([]);
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminReady) return;
    fetchLogs(activeCategory);
  }, [adminReady, activeCategory]);

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const actor = (log.actor_name || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    const recordType = (log.record_type || '').toLowerCase();
    const metaStr = JSON.stringify(log.metadata || {}).toLowerCase();
    return actor.includes(q) || action.includes(q) || recordType.includes(q) || metaStr.includes(q);
  });

  const getRecordTypeBadge = (recordType: string) => {
    switch (recordType) {
      case 'database_place':
        return { label: 'Places DB', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
      case 'database_request':
        return { label: 'DB Request', bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
      case 'lead':
        return { label: 'CRM Lead', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'enquiry':
        return { label: 'Enquiry', bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: 'rgba(52, 211, 153, 0.3)' };
      case 'user':
        return { label: 'User & Auth', bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' };
      default:
        return { label: recordType, bg: 'rgba(99, 102, 241, 0.15)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  const renderHumanSummary = (log: AuditLog) => {
    const meta = log.metadata || {};

    if (log.record_type === 'database_place') {
      const school = meta.school_name || meta.place_id || 'School';
      const city = meta.city ? `(${meta.city})` : '';
      if (log.action === 'converted_to_lead') {
        return (
          <div>
            <strong style={{ color: '#34d399' }}>🎯 Converted to Lead:</strong>{' '}
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{school}</span> {city}
            {meta.lead_code && <span style={{ marginLeft: '6px', color: '#c084fc', fontFamily: 'monospace' }}>[{meta.lead_code}]</span>}
          </div>
        );
      }
      if (log.action === 'status_changed') {
        return (
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Updated status of</span>{' '}
            <strong style={{ color: '#ffffff' }}>{school}</strong> {city}:{' '}
            <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.76rem' }}>{meta.old_status || 'fresh'}</span>
            {' ➔ '}
            <span style={{ padding: '2px 6px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', borderRadius: '4px', fontWeight: 700, fontSize: '0.76rem' }}>{meta.new_status}</span>
            {meta.notes && <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontStyle: 'italic' }}>"{meta.notes}"</span>}
          </div>
        );
      }
      if (log.action === 'note_added') {
        return (
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Added call notes for</span>{' '}
            <strong style={{ color: '#ffffff' }}>{school}</strong> {city}
            {meta.notes && <span style={{ color: '#e2e8f0', display: 'block', marginTop: '2px', fontStyle: 'italic' }}>"{meta.notes}"</span>}
          </div>
        );
      }
      return (
        <div>
          <strong style={{ color: '#ffffff' }}>{school}</strong> {city} — {log.action}
          {meta.notes && <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>{meta.notes}</span>}
        </div>
      );
    }

    if (log.record_type === 'database_request') {
      return (
        <div>
          <span style={{ color: '#fbbf24', fontWeight: 600 }}>Requested data batch</span> of{' '}
          <strong>{meta.requested_count || 25} records</strong> (Remaining in queue: {meta.remaining_count})
          {meta.preferred_city && <span style={{ marginLeft: '6px', color: '#38bdf8' }}>[City: {meta.preferred_city}]</span>}
        </div>
      );
    }

    if (log.record_type === 'lead') {
      const code = meta.lead_code ? `[${meta.lead_code}]` : '';
      const institute = meta.institute_name ? `"${meta.institute_name}"` : '';
      return (
        <div>
          <strong style={{ color: '#c084fc' }}>Lead {code}</strong> {institute}{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            {log.action.replace(/_/g, ' ')}
            {meta.status ? ` (Status: ${meta.status})` : ''}
            {meta.manager_name ? ` ➔ Assigned: ${meta.manager_name}` : ''}
          </span>
        </div>
      );
    }

    if (log.record_type === 'enquiry') {
      const code = meta.enquiry_code ? `[${meta.enquiry_code}]` : '';
      const institute = meta.institute_name ? `"${meta.institute_name}"` : '';
      return (
        <div>
          <strong style={{ color: '#34d399' }}>Enquiry {code}</strong> {institute}{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            {log.action.replace(/_/g, ' ')}
            {meta.claimed_by ? ` by ${meta.claimed_by}` : ''}
          </span>
        </div>
      );
    }

    if (log.record_type === 'user') {
      return (
        <div>
          <strong style={{ color: '#fb7185' }}>User Account:</strong>{' '}
          <span style={{ color: '#ffffff' }}>{meta.name || meta.user_code || log.actor_name}</span>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            ({meta.role || 'user'}) — {log.action.replace(/_/g, ' ')}
          </span>
        </div>
      );
    }

    // Default narrative fallback
    const summaryKeys = Object.entries(meta)
      .filter(([k, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');

    return (
      <div>
        <span style={{ color: 'var(--text-primary)' }}>{log.action.replace(/_/g, ' ')}</span>
        {summaryKeys && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>{summaryKeys}</span>}
      </div>
    );
  };

  return (
    <div className="workspace-container">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            System Audit &amp; Activity Logs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Live, unified record of team actions across Places Database, Outreach Calling, CRM Leads, Enquiries, and Security
          </p>
        </div>
        <button onClick={() => fetchLogs(activeCategory)} className="btn-secondary" style={{ fontSize: '0.85rem' }} disabled={loading}>
          🔄 {loading ? 'Syncing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', margin: '14px 0' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'database', label: '📞 Places DB & Outreach' },
            { id: 'leads', label: '🎯 CRM Leads' },
            { id: 'enquiries', label: '📩 Public Enquiries' },
            { id: 'users', label: '👤 Users & Access' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as LogCategory)}
              className={activeCategory === tab.id ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.82rem',
                padding: '6px 14px',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: '320px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, school or lead..."
            className="input-field"
            style={{ width: '100%', padding: '7px 12px', fontSize: '0.84rem' }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', width: '170px' }}>
                  Timestamp
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', width: '160px' }}>
                  Team Member
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', width: '120px' }}>
                  Module
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Activity Summary
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right', width: '100px' }}>
                  Inspect
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {search ? `No activity logs match "${search}"` : 'No activity recorded yet for this category.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getRecordTypeBadge(log.record_type);
                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                          {log.actor_name || 'System'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.86rem' }}>
                        {renderHumanSummary(log)}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                          title="View complete metadata"
                        >
                          Details ➔
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

      {/* METADATA INSPECT MODAL */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: getRecordTypeBadge(selectedLog.record_type).bg,
                    color: getRecordTypeBadge(selectedLog.record_type).text,
                    border: `1px solid ${getRecordTypeBadge(selectedLog.record_type).border}`,
                  }}
                >
                  {selectedLog.record_type}
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                  Action: {selectedLog.action}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  By <strong>{selectedLog.actor_name || 'System'}</strong> on {new Date(selectedLog.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Human Narrative Summary
              </span>
              <div style={{ marginTop: '6px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {renderHumanSummary(selectedLog)}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Raw Audit Metadata Payload
              </span>
              <pre
                style={{
                  marginTop: '6px',
                  padding: '14px',
                  background: '#090d16',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: '#a5b4fc',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
              <button onClick={() => setSelectedLog(null)} className="btn-secondary" style={{ padding: '6px 18px', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
