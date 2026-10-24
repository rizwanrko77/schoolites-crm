'use client';

import React, { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  record_type: string;
  record_id: string;
  actor_name: string;
  action: string;
  metadata: any;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/logs');
      if (!res.ok) throw new Error('Failed to load logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="workspace-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            System Audit Logs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Immutable, timestamped record of administrative actions, user creations, and pipeline status changes
          </p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
          🔄 Refresh Logs
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Timestamp
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Actor
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Action
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Target Type
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Metadata Details
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.actor_name || 'System'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                      {log.record_type}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: '320px', wordBreak: 'break-all' }}>
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
