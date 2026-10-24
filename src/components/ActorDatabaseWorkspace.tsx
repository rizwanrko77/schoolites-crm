'use client';

import React, { useState, useEffect } from 'react';

interface PlaceRecord {
  id: string;
  place_id: string;
  name: string;
  primary_phone: string | null;
  alternative_phone: string | null;
  website: string | null;
  maps_url: string | null;
  rating: number | string | null;
  rating_count: number | null;
  primary_type: string | null;
  street_address: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  business_status: string | null;
  status: string;
  assigned_at: string | null;
  last_contacted_at: string | null;
  callback_at: string | null;
  notes: string | null;
  converted_lead_id: string | null;
  converted_lead_code?: string | null;
  converted_lead_status?: string | null;
}

interface ActorDatabaseWorkspaceProps {
  user: any;
  onConvertToLead: (place: PlaceRecord) => void;
}

export default function ActorDatabaseWorkspace({ user, onConvertToLead }: ActorDatabaseWorkspaceProps) {
  const [subTab, setSubTab] = useState<'new' | 'assigned'>('new');
  const [records, setRecords] = useState<PlaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    unworked_count: 0,
    active_outreach_count: 0,
    converted_count: 0,
    total_assigned: 0,
  });
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [cities, setCities] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // Editing state for notes & callbacks
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [callbackDates, setCallbackDates] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Request Batch Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqPreferredCity, setReqPreferredCity] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqCount, setReqCount] = useState(25);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // Inspect place detail drawer
  const [inspectedPlace, setInspectedPlace] = useState<PlaceRecord | null>(null);

  const [toastMsg, setToastMsg] = useState('');

  const fetchDatabasePlaces = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('tab', subTab);
      if (search.trim()) params.append('search', search.trim());
      if (cityFilter !== 'all') params.append('city', cityFilter);
      if (subTab === 'assigned' && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/database?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load places data');
      const data = await res.json();
      setRecords(data.records || []);
      setMetrics(data.metrics || metrics);
      setPendingRequest(data.pendingRequest || null);
      setCities(data.cities || []);

      // Initialize notes
      const initialNotes: Record<string, string> = {};
      const initialCallbacks: Record<string, string> = {};
      (data.records || []).forEach((r: PlaceRecord) => {
        initialNotes[r.id] = r.notes || '';
        if (r.callback_at) {
          initialCallbacks[r.id] = new Date(r.callback_at).toISOString().slice(0, 16);
        }
      });
      setEditingNotes(initialNotes);
      setCallbackDates(initialCallbacks);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDatabasePlaces();
    }, 200);
    return () => clearTimeout(timer);
  }, [subTab, search, statusFilter, cityFilter]);

  const handleUpdateStatus = async (place: PlaceRecord, newStatus: string, customCallback?: string) => {
    setUpdatingId(place.id);
    try {
      const noteText = editingNotes[place.id] !== undefined ? editingNotes[place.id] : place.notes || '';
      const callbackTimestamp = customCallback || callbackDates[place.id] || null;

      const res = await fetch('/api/database', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          status: newStatus,
          notes: noteText,
          callback_at: callbackTimestamp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update outreach record');

      setToastMsg(`Status updated to ${newStatus.replace(/_/g, ' ')}!`);
      setTimeout(() => setToastMsg(''), 3000);

      // Refresh list
      fetchDatabasePlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (place: PlaceRecord) => {
    setUpdatingId(place.id);
    try {
      const res = await fetch('/api/database', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          notes: editingNotes[place.id] || '',
          callback_at: callbackDates[place.id] || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save notes');
      setToastMsg('Outreach notes saved!');
      setTimeout(() => setToastMsg(''), 2500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSubmitBatchRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReq(true);
    try {
      const res = await fetch('/api/database/request-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_city: reqPreferredCity,
          notes: reqNotes,
          requested_count: reqCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request new data batch');

      setToastMsg('Batch request submitted to admin successfully!');
      setTimeout(() => setToastMsg(''), 4000);
      setIsRequestModalOpen(false);
      setReqNotes('');
      setReqPreferredCity('');
      fetchDatabasePlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const getStatusBadge = (st: string) => {
    const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      new: { label: 'New / Uncontacted', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: '📋' },
      rnr: { label: 'RNR (Ringing No Response)', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', icon: '📞' },
      switched_off: { label: 'Switched Off', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', icon: '📵' },
      interested: { label: 'Interested', color: '#34d399', bg: 'rgba(52, 211, 153, 0.18)', icon: '🔥' },
      contact_later: { label: 'Callback Scheduled', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', icon: '📅' },
      not_interested: { label: 'Not Interested', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', icon: '✕' },
      following_up: { label: 'Active Follow-up', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', icon: '🔄' },
      converted_to_lead: { label: 'Converted to Lead', color: '#10b981', bg: 'rgba(16, 185, 129, 0.25)', icon: '🎯' },
    };
    const meta = map[st] || { label: st, color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', icon: '●' };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: meta.color,
          background: meta.bg,
          border: `1px solid ${meta.color}40`,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </span>
    );
  };

  const isLowQueue = metrics.unworked_count <= 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
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

      {/* Threshold Alert & Request Button Banner (Shown when remaining <= 10) */}
      {isLowQueue && (
        <div
          className="glass-panel"
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              ⚡
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>
                {metrics.unworked_count === 0
                  ? 'Your New Prospect Queue is Empty!'
                  : `Only ${metrics.unworked_count} Unworked Prospect Records Remaining!`}
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {pendingRequest
                  ? 'You have a pending data request submitted to the admin team. New prospects will be assigned shortly.'
                  : 'You have reached the threshold (10 or fewer unworked records). You can request a fresh batch of school prospects now.'}
              </p>
            </div>
          </div>

          <div>
            {pendingRequest ? (
              <span
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <span>⏳</span>
                <span>Request Pending Admin Fulfillment</span>
              </span>
            ) : (
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.88rem',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                  fontWeight: 700,
                }}
              >
                + Request More Data ⚡
              </button>
            )}
          </div>
        </div>
      )}

      {/* Metrics Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #38bdf8' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Unworked Fresh Queue
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: metrics.unworked_count <= 10 ? '#fbbf24' : '#38bdf8', marginTop: '4px' }}>
            {metrics.unworked_count}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #818cf8' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Active Outreach Pipeline
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
            {metrics.active_outreach_count}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Converted to CRM Leads
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {metrics.converted_count}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
        <button
          onClick={() => {
            setSubTab('new');
            setStatusFilter('all');
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'new' ? '2px solid #38bdf8' : '2px solid transparent',
            color: subTab === 'new' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>📋</span>
          <span>New Data ({metrics.unworked_count})</span>
        </button>

        <button
          onClick={() => {
            setSubTab('assigned');
            setStatusFilter('all');
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'assigned' ? '2px solid #818cf8' : '2px solid transparent',
            color: subTab === 'assigned' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🎯</span>
          <span>Assigned Database / Pipeline ({metrics.active_outreach_count + metrics.converted_count})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.75)',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search prospect by school name, city, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ width: '100%', padding: '8px 14px', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>City:</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="input-field"
              style={{ padding: '7px 10px', fontSize: '0.82rem', background: '#0f172a', color: '#ffffff' }}
            >
              <option value="all">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {subTab === 'assigned' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Outreach Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
                style={{ padding: '7px 10px', fontSize: '0.82rem', background: '#0f172a', color: '#ffffff' }}
              >
                <option value="all">All Outreach Stages</option>
                <option value="interested">🔥 Interested</option>
                <option value="contact_later">📅 Callback Scheduled</option>
                <option value="following_up">🔄 Following Up</option>
                <option value="rnr">📞 Ringing No Response (RNR)</option>
                <option value="switched_off">📵 Switched Off</option>
                <option value="converted_to_lead">🎯 Converted to Lead</option>
                <option value="not_interested">✕ Not Interested</option>
              </select>
            </div>
          )}

          {(search || cityFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setCityFilter('all');
                setStatusFilter('all');
              }}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#f87171' }}
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Prospects Working Queue List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading prospect records...
          </div>
        ) : records.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              {subTab === 'new' ? 'No New Unworked Prospects' : 'No Outreach Records Found'}
            </h4>
            <p style={{ fontSize: '0.86rem', maxWidth: '400px', margin: '0 auto' }}>
              {subTab === 'new'
                ? isLowQueue
                  ? 'Your unworked queue is clear. Click "Request More Data" above to receive a new batch from the central pool.'
                  : 'All assigned records have been contacted or moved into your outreach pipeline.'
                : 'No records matching your search filters.'}
            </p>
          </div>
        ) : (
          records.map((place) => (
            <div
              key={place.id}
              className="glass-panel"
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                borderLeft: `4px solid ${
                  place.status === 'converted_to_lead'
                    ? '#10b981'
                    : place.status === 'interested'
                    ? '#34d399'
                    : place.status === 'contact_later'
                    ? '#818cf8'
                    : '#38bdf8'
                }`,
              }}
            >
              {/* Card Header: School Name, Contact Numbers, Rating */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                      {place.name}
                    </h3>
                    {getStatusBadge(place.status)}
                    {place.converted_lead_code && (
                      <span className="enterprise-code-pill" style={{ color: '#10b981', fontWeight: 700, fontSize: '0.74rem' }}>
                        Lead: {place.converted_lead_code}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>📍 {[place.area, place.city, place.country].filter(Boolean).join(', ')}</span>
                    {place.rating && (
                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                        ★ {place.rating} ({place.rating_count || 0} reviews)
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Type: {place.primary_type ? place.primary_type.replace(/_/g, ' ') : 'School'}
                    </span>
                    {place.website && (
                      <a href={place.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                        🌐 Website ↗
                      </a>
                    )}
                    {place.maps_url && (
                      <a href={place.maps_url} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', textDecoration: 'none' }}>
                        🗺️ Maps ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Primary Calling Button */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {place.primary_phone && (
                    <a
                      href={`tel:${place.primary_phone}`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                      }}
                    >
                      <span>📞 Call:</span>
                      <span>{place.primary_phone}</span>
                    </a>
                  )}

                  {place.alternative_phone && (
                    <a
                      href={`tel:${place.alternative_phone}`}
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                    >
                      Alt: {place.alternative_phone}
                    </a>
                  )}

                  <button
                    onClick={() => setInspectedPlace(place)}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="View full school metadata and details"
                  >
                    <span>🔍</span>
                    <span>Inspect</span>
                  </button>

                  {place.status !== 'converted_to_lead' && (
                    <button
                      onClick={() => onConvertToLead(place)}
                      className="btn-primary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🎯</span>
                      <span>Convert to Lead ↗</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Status Action Buttons */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Quick Outcome Logging:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    disabled={updatingId === place.id || place.status === 'rnr'}
                    onClick={() => handleUpdateStatus(place, 'rnr')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      borderColor: place.status === 'rnr' ? '#fbbf24' : undefined,
                      color: place.status === 'rnr' ? '#fbbf24' : undefined,
                    }}
                  >
                    📞 RNR (No Answer)
                  </button>

                  <button
                    disabled={updatingId === place.id || place.status === 'switched_off'}
                    onClick={() => handleUpdateStatus(place, 'switched_off')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      borderColor: place.status === 'switched_off' ? '#f87171' : undefined,
                      color: place.status === 'switched_off' ? '#f87171' : undefined,
                    }}
                  >
                    📵 Switched Off
                  </button>

                  <button
                    disabled={updatingId === place.id || place.status === 'interested'}
                    onClick={() => handleUpdateStatus(place, 'interested')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      borderColor: place.status === 'interested' ? '#34d399' : undefined,
                      color: place.status === 'interested' ? '#34d399' : undefined,
                      fontWeight: 700,
                    }}
                  >
                    🔥 Interested
                  </button>

                  <button
                    disabled={updatingId === place.id || place.status === 'following_up'}
                    onClick={() => handleUpdateStatus(place, 'following_up')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      borderColor: place.status === 'following_up' ? '#c084fc' : undefined,
                      color: place.status === 'following_up' ? '#c084fc' : undefined,
                    }}
                  >
                    🔄 Following Up
                  </button>

                  <button
                    disabled={updatingId === place.id || place.status === 'contact_later'}
                    onClick={() => handleUpdateStatus(place, 'contact_later')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      borderColor: place.status === 'contact_later' ? '#818cf8' : undefined,
                      color: place.status === 'contact_later' ? '#818cf8' : undefined,
                    }}
                  >
                    📅 Schedule Callback
                  </button>

                  <button
                    disabled={updatingId === place.id || place.status === 'not_interested'}
                    onClick={() => handleUpdateStatus(place, 'not_interested')}
                    className="btn-secondary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      opacity: place.status === 'not_interested' ? 1 : 0.7,
                    }}
                  >
                    ✕ Not Interested
                  </button>
                </div>
              </div>

              {/* Notes & Callback Scheduling Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <input
                    type="text"
                    placeholder="Enter call notes (e.g. Spoke with Principal, asked to call back Wednesday at 3pm)..."
                    value={editingNotes[place.id] !== undefined ? editingNotes[place.id] : place.notes || ''}
                    onChange={(e) => setEditingNotes({ ...editingNotes, [place.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNotes(place);
                    }}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.84rem', padding: '8px 12px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="datetime-local"
                    value={callbackDates[place.id] || ''}
                    onChange={(e) => setCallbackDates({ ...callbackDates, [place.id]: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.8rem', padding: '7px 8px', width: '150px' }}
                  />
                  <button
                    onClick={() => handleSaveNotes(place)}
                    disabled={updatingId === place.id}
                    className="btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    {updatingId === place.id ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* REQUEST MORE DATA MODAL */}
      {isRequestModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsRequestModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>⚡ Request New Prospects Batch</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Your remaining queue is {metrics.unworked_count} records. Submit a request to admin for fresh data.
                </p>
              </div>
              <button onClick={() => setIsRequestModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitBatchRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Requested Batch Size
                </label>
                <select
                  value={reqCount}
                  onChange={(e) => setReqCount(parseInt(e.target.value, 10))}
                  className="input-field"
                  style={{ width: '100%', background: '#0f172a', color: '#ffffff' }}
                >
                  <option value={25}>25 Fresh Prospects</option>
                  <option value={50}>50 Fresh Prospects</option>
                  <option value={100}>100 Fresh Prospects</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Preferred City / Region (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pune, Mumbai, Bangalore..."
                  value={reqPreferredCity}
                  onChange={(e) => setReqPreferredCity(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Notes / Preference for Admin (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. High schools preferred, completed previous batch."
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsRequestModalOpen(false)} className="btn-secondary" disabled={isSubmittingReq}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmittingReq} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                  {isSubmittingReq ? 'Submitting...' : 'Submit Request to Admin ⚡'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect & Full Details Drawer for Actor */}
      {inspectedPlace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1200,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setInspectedPlace(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              height: '100%',
              background: '#0b1120',
              borderLeft: '1px solid var(--border-subtle)',
              padding: '28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div>
                <span className="enterprise-code-pill" style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
                  {inspectedPlace.place_id}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                  {inspectedPlace.name}
                </h2>
                <div style={{ marginTop: '6px' }}>
                  {getStatusBadge(inspectedPlace.status)}
                </div>
              </div>
              <button
                onClick={() => setInspectedPlace(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Direct Calling & Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {inspectedPlace.primary_phone && (
                <a
                  href={`tel:${inspectedPlace.primary_phone}`}
                  style={{
                    flex: 1,
                    minWidth: '160px',
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  }}
                >
                  <span>📞 Call:</span>
                  <span>{inspectedPlace.primary_phone}</span>
                </a>
              )}

              {inspectedPlace.alternative_phone && (
                <a
                  href={`tel:${inspectedPlace.alternative_phone}`}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>📞 Alt:</span>
                  <span>{inspectedPlace.alternative_phone}</span>
                </a>
              )}

              {inspectedPlace.status !== 'converted_to_lead' && (
                <button
                  onClick={() => {
                    setInspectedPlace(null);
                    onConvertToLead(inspectedPlace);
                  }}
                  className="btn-primary"
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.88rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🎯</span>
                  <span>Convert to Lead ↗</span>
                </button>
              )}
            </div>

            {/* Detailed Place Information Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>City & Locality</span>
                <div style={{ marginTop: '2px', fontWeight: 600 }}>
                  {[inspectedPlace.area, inspectedPlace.city].filter(Boolean).join(', ') || '—'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Google Rating</span>
                <div style={{ marginTop: '2px', color: '#fbbf24', fontWeight: 700 }}>
                  ★ {inspectedPlace.rating || 'N/A'} ({inspectedPlace.rating_count || 0} reviews)
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>State & Pincode</span>
                <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>
                  {[inspectedPlace.state, inspectedPlace.postal_code].filter(Boolean).join(' - ') || '—'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Business Status</span>
                <div style={{ marginTop: '2px', color: inspectedPlace.business_status === 'OPERATIONAL' ? '#34d399' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {inspectedPlace.business_status || 'OPERATIONAL'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Address</span>
                <div style={{ marginTop: '2px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  {inspectedPlace.street_address || [inspectedPlace.area, inspectedPlace.city, inspectedPlace.state, inspectedPlace.postal_code].filter(Boolean).join(', ') || '—'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '6px' }}>
                {inspectedPlace.website && (
                  <a href={inspectedPlace.website} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    🌐 Visit Website ↗
                  </a>
                )}
                {inspectedPlace.maps_url && (
                  <a href={inspectedPlace.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    📍 View on Google Maps ↗
                  </a>
                )}
              </div>
            </div>

            {/* Notes & Activity History */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: 700 }}>
                Outreach History & Notes
              </span>
              {inspectedPlace.last_contacted_at && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Last Contacted: {new Date(inspectedPlace.last_contacted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {inspectedPlace.callback_at && (
                <div style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 600 }}>
                  Scheduled Callback: {new Date(inspectedPlace.callback_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                <strong>Current Notes:</strong> {editingNotes[inspectedPlace.id] || inspectedPlace.notes || 'No notes added yet.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
