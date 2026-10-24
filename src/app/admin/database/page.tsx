'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { COUNTRY_DATA, Country, DEFAULT_COUNTRY } from '@/lib/countries';

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
  type_tags: string[] | null;
  formatted_address: string | null;
  street_address: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  business_status: string | null;
  regular_opening_hours: any | null;
  search_keyword: string | null;
  search_city: string | null;
  search_area: string | null;
  status: string;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  last_contacted_at: string | null;
  callback_at: string | null;
  notes: string | null;
  converted_lead_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_user_name?: string | null;
  assigned_user_code?: string | null;
  assigned_user_role?: string | null;
  converted_lead_code?: string | null;
  converted_lead_status?: string | null;
}

interface PlaceHistoryItem {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  metadata: any | null;
  created_at: string;
  actor_name: string | null;
  actor_code: string | null;
  actor_role: string | null;
}

interface DataRequestItem {
  id: string;
  user_id: string;
  remaining_count: number;
  requested_count: number;
  preferred_city: string | null;
  notes: string | null;
  status: string;
  fulfilled_by: string | null;
  fulfilled_count: number;
  fulfilled_at: string | null;
  created_at: string;
  user_name: string;
  user_code: string;
  user_role: string;
  user_email: string;
  fulfilled_by_name?: string | null;
}

interface DBUser {
  id: string;
  user_code: string;
  name: string;
  role: string;
}

export default function AdminDatabasePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'fresh' | 'assigned' | 'requests'>('all');
  const [records, setRecords] = useState<PlaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_records: 0,
    fresh_count: 0,
    assigned_count: 0,
    converted_count: 0,
    pending_requests_count: 0,
  });
  const [cities, setCities] = useState<string[]>([]);
  const [dbUsers, setDbUsers] = useState<DBUser[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 50 });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Requests queue state
  const [requests, setRequests] = useState<DataRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Detail & History Drawer
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [drawerPlace, setDrawerPlace] = useState<PlaceRecord | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<PlaceHistoryItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modals
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  const [isApiSearchModalOpen, setIsApiSearchModalOpen] = useState(false);
  const [apiSearchQuery, setApiSearchQuery] = useState('CBSE Schools');
  const [apiSearchCity, setApiSearchCity] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [apiSearchAreas, setApiSearchAreas] = useState('');
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [apiSearchSummary, setApiSearchSummary] = useState<any | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [fulfillModalRequest, setFulfillModalRequest] = useState<DataRequestItem | null>(null);
  const [fulfillBatchSize, setFulfillBatchSize] = useState<number>(25);
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Visual batch allocation for requests
  const [allocatingForRequest, setAllocatingForRequest] = useState<DataRequestItem | null>(null);
  const [isAllocatingVisual, setIsAllocatingVisual] = useState(false);

  const [toastMsg, setToastMsg] = useState('');

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedCity !== 'all') params.append('city', selectedCity);
      if (selectedUser !== 'all') params.append('assigned_to', selectedUser);
      params.append('page', String(page));
      params.append('limit', '50');

      if (activeTab === 'fresh') {
        params.append('status', 'fresh');
      } else if (activeTab === 'assigned') {
        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus);
        } else {
          // All active statuses
          params.append('assigned_to', selectedUser !== 'all' ? selectedUser : 'all');
        }
      } else {
        if (selectedStatus !== 'all') params.append('status', selectedStatus);
      }

      const res = await fetch(`/api/admin/places?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch places');
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || stats);
      setCities(data.cities || []);
      setDbUsers(data.dbUsers || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await fetch('/api/admin/places/requests?status=all');
      if (!res.ok) throw new Error('Failed to load data requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountryDropdownOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'requests') {
        fetchRequests();
      } else {
        fetchPlaces();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCity, selectedStatus, selectedUser, page, activeTab]);

  // Load place details for Drawer
  const openDrawer = async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/admin/places/${placeId}`);
      if (!res.ok) throw new Error('Failed to load place details');
      const data = await res.json();
      setDrawerPlace(data.place);
      setDrawerHistory(data.history || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedPlaceId(null);
    setDrawerPlace(null);
    setDrawerHistory([]);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(records.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !assignTargetUserId) return;
    setIsAssigning(true);
    try {
      const res = await fetch('/api/admin/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_ids: selectedIds,
          user_id: assignTargetUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign records');

      setToastMsg(`Successfully assigned ${data.assignedCount} records to ${data.assignedTo.name}!`);
      setTimeout(() => setToastMsg(''), 4000);
      setIsAssignModalOpen(false);
      setSelectedIds([]);
      fetchPlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) setCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      alert('Please select a CSV file or paste CSV content.');
      return;
    }
    setIsImporting(true);
    setImportSummary(null);
    try {
      const res = await fetch('/api/admin/places/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import CSV');

      setImportSummary(data.summary);
      setToastMsg(data.message);
      setTimeout(() => setToastMsg(''), 5000);
      fetchPlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleGooglePlacesSearch = async () => {
    if (!apiSearchQuery.trim() || !apiSearchCity.trim()) {
      alert('Please provide both a search query and a city.');
      return;
    }
    setIsSearchingApi(true);
    setApiSearchSummary(null);
    try {
      const res = await fetch('/api/admin/places/search-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: apiSearchQuery,
          city: apiSearchCity,
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          areas: apiSearchAreas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      setApiSearchSummary(data.summary);
      setToastMsg(data.message);
      setTimeout(() => setToastMsg(''), 5000);
      fetchPlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handleFulfillRequest = async () => {
    if (!fulfillModalRequest) return;
    setIsFulfilling(true);
    try {
      const res = await fetch('/api/admin/places/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: fulfillModalRequest.id,
          batch_size: fulfillBatchSize,
          action: 'fulfill',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fulfill request');

      setToastMsg(data.message);
      setTimeout(() => setToastMsg(''), 4000);
      setFulfillModalRequest(null);
      fetchRequests();
      fetchPlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to decline/reject this data request?')) return;
    try {
      const res = await fetch('/api/admin/places/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          action: 'reject',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request');
      setToastMsg('Data request marked as rejected.');
      setTimeout(() => setToastMsg(''), 3000);
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartVisualAllocation = (reqItem: DataRequestItem) => {
    setAllocatingForRequest(reqItem);
    setActiveTab('fresh');
    setSelectedCity(reqItem.preferred_city || 'all');
    setSelectedIds([]);
    setSearch('');
    setPage(1);
  };

  const handleConfirmVisualAllocation = async () => {
    if (!allocatingForRequest || selectedIds.length === 0) return;
    setIsAllocatingVisual(true);
    try {
      const res = await fetch('/api/admin/places/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: allocatingForRequest.id,
          place_ids: selectedIds,
          action: 'fulfill',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to allocate data to request');

      setToastMsg(`Allocated ${data.fulfilledCount} records to ${allocatingForRequest.user_name} successfully!`);
      setTimeout(() => setToastMsg(''), 4000);
      setAllocatingForRequest(null);
      setSelectedIds([]);
      fetchRequests();
      fetchPlaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAllocatingVisual(false);
    }
  };

  const handleAutoSelectForRequest = () => {
    if (!allocatingForRequest) return;
    const targetCount = allocatingForRequest.requested_count || 25;
    const idsToSelect = records.slice(0, targetCount).map((r) => r.id);
    setSelectedIds(idsToSelect);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      fresh: { label: 'Fresh / Unassigned', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', icon: '✨' },
      unassigned: { label: 'Fresh Pool', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', icon: '✨' },
      new: { label: 'New / Assigned', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: '📋' },
      rnr: { label: 'Ringing No Response', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', icon: '📞' },
      switched_off: { label: 'Switched Off', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', icon: '📵' },
      interested: { label: 'Interested', color: '#34d399', bg: 'rgba(52, 211, 153, 0.18)', icon: '🔥' },
      contact_later: { label: 'Callback Scheduled', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', icon: '📅' },
      not_interested: { label: 'Not Interested', color: '#e2e8f0', bg: 'rgba(226, 232, 240, 0.1)', icon: '✕' },
      following_up: { label: 'Following Up', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', icon: '🔄' },
      converted_to_lead: { label: 'Converted to Lead', color: '#10b981', bg: 'rgba(16, 185, 129, 0.25)', icon: '🎯' },
    };

    const meta = map[s] || { label: status, color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.05)', icon: '●' };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 9px',
          borderRadius: '9999px',
          fontSize: '0.74rem',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
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

      {/* Header & Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🏢</span> Places Database & Discovery Pipeline
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Central repository of schools and institutions discovered via Google Places API & Apps Script. Filter, manage audit history, and assign batches to referral & pre-sales reps.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setImportSummary(null);
              setIsCsvModalOpen(true);
            }}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <span>📄</span>
            <span>Import Apps Script CSV</span>
          </button>

          <button
            onClick={() => {
              setApiSearchSummary(null);
              setIsApiSearchModalOpen(true);
            }}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
          >
            <span>🔍</span>
            <span>Google Places Search</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                if (dbUsers.length > 0) setAssignTargetUserId(dbUsers[0].id);
                setIsAssignModalOpen(true);
              }}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 18px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
            >
              <span>⚡</span>
              <span>Assign {selectedIds.length} Records</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #818cf8' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Discovered</span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            {stats.total_records.toLocaleString()}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #94a3b8' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Fresh Unassigned Pool</span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>
            {stats.fresh_count.toLocaleString()}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #38bdf8' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>In Active Outreach</span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {stats.assigned_count.toLocaleString()}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Converted to Leads</span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {stats.converted_count.toLocaleString()}
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderLeft: stats.pending_requests_count > 0 ? '4px solid #f59e0b' : '4px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
          onClick={() => setActiveTab('requests')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Quota Requests</span>
            {stats.pending_requests_count > 0 && (
              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700 }}>
                Action Needed
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: stats.pending_requests_count > 0 ? '#fbbf24' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.pending_requests_count}
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
        <button
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'all' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🌐</span>
          <span>All Records ({stats.total_records})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('fresh');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'fresh' ? '2px solid #94a3b8' : '2px solid transparent',
            color: activeTab === 'fresh' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>✨</span>
          <span>Fresh Pool ({stats.fresh_count})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('assigned');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'assigned' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'assigned' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>📋</span>
          <span>Assigned Outreach ({stats.assigned_count})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('requests');
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'requests' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'requests' ? '#fbbf24' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>⚡</span>
          <span>Data Requests Queue</span>
          {stats.pending_requests_count > 0 && (
            <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: '9999px', background: '#f59e0b', color: '#000000', fontWeight: 800 }}>
              {stats.pending_requests_count}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'requests' ? (
        /* REQUESTS QUEUE VIEW */
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Actor Quota Requests</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Requests submitted by team members when their unworked prospect count reached 10 or less.
              </p>
            </div>
            <button onClick={fetchRequests} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              🔄 Refresh Queue
            </button>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th className="enterprise-th">Request Date</th>
                  <th className="enterprise-th">Member Name & Role</th>
                  <th className="enterprise-th">Remaining Queue</th>
                  <th className="enterprise-th">Requested City</th>
                  <th className="enterprise-th">Batch Size</th>
                  <th className="enterprise-th">Notes</th>
                  <th className="enterprise-th">Status</th>
                  <th className="enterprise-th" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requestsLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading requests queue...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No data quota requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td className="enterprise-td">
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="enterprise-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="enterprise-avatar">
                            {r.user_name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.user_name}</div>
                            <span className="enterprise-code-pill" style={{ fontSize: '0.72rem' }}>{r.user_code}</span>
                            <span className={`badge-role ${r.user_role}`} style={{ marginLeft: '4px', fontSize: '0.68rem', padding: '1px 6px' }}>
                              {r.user_role.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="enterprise-td">
                        <span style={{ fontWeight: 700, color: r.remaining_count <= 5 ? '#f87171' : '#fbbf24', fontSize: '0.9rem' }}>
                          {r.remaining_count} records left
                        </span>
                      </td>
                      <td className="enterprise-td">
                        <span style={{ fontWeight: 600, color: r.preferred_city ? '#38bdf8' : 'var(--text-muted)' }}>
                          {r.preferred_city || 'Any City'}
                        </span>
                      </td>
                      <td className="enterprise-td">
                        <span style={{ fontWeight: 700 }}>{r.requested_count} items</span>
                      </td>
                      <td className="enterprise-td" style={{ maxWidth: '200px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: r.notes ? 'normal' : 'italic' }}>
                          {r.notes || 'No specific notes'}
                        </span>
                      </td>
                      <td className="enterprise-td">
                        {r.status === 'pending' ? (
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                            ⏳ Pending Fulfillment
                          </span>
                        ) : r.status === 'fulfilled' ? (
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                            ✓ Fulfilled ({r.fulfilled_count} items)
                          </span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                            ✕ Rejected
                          </span>
                        )}
                      </td>
                      <td className="enterprise-td" style={{ textAlign: 'right' }}>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleStartVisualAllocation(r)}
                              className="btn-primary"
                              style={{
                                padding: '5px 12px',
                                fontSize: '0.78rem',
                                background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Redirect to Fresh Pool with preset filters to select and assign records"
                            >
                              <span>🎯</span>
                              <span>Select & Allocate</span>
                            </button>
                            <button
                              onClick={() => {
                                setFulfillModalRequest(r);
                                setFulfillBatchSize(r.requested_count || 25);
                              }}
                              className="btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                              title="Quick 1-Click Auto Fulfill"
                            >
                              ⚡ 1-Click
                            </button>
                            <button
                              onClick={() => handleRejectRequest(r.id)}
                              className="btn-secondary"
                              style={{ padding: '5px 8px', fontSize: '0.78rem', color: '#f87171' }}
                              title="Decline this request"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            by {r.fulfilled_by_name || 'Admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RECORDS TABLE VIEW */
        <>
          {/* Active Allocation Mode Ribbon (When admin is fulfilling an actor's request) */}
          {allocatingForRequest && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(37, 99, 235, 0.12) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}
                >
                  🎯
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                      Allocating Data to: {allocatingForRequest.user_name}
                    </span>
                    <span className="enterprise-code-pill" style={{ fontSize: '0.74rem' }}>{allocatingForRequest.user_code}</span>
                    <span className={`badge-role ${allocatingForRequest.user_role}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {allocatingForRequest.user_role.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Target: <strong>{allocatingForRequest.requested_count} records</strong>
                    {allocatingForRequest.preferred_city ? ` (City: ${allocatingForRequest.preferred_city})` : ''}
                    {' • '}
                    <strong style={{ color: selectedIds.length === allocatingForRequest.requested_count ? '#34d399' : '#38bdf8' }}>
                      {selectedIds.length} of {allocatingForRequest.requested_count} records selected
                    </strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAutoSelectForRequest}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                >
                  ⚡ Auto-Select Top {allocatingForRequest.requested_count}
                </button>

                <button
                  type="button"
                  disabled={selectedIds.length === 0 || isAllocatingVisual}
                  onClick={handleConfirmVisualAllocation}
                  className="btn-primary"
                  style={{
                    padding: '7px 16px',
                    fontSize: '0.84rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedIds.length === 0 ? 0.6 : 1,
                  }}
                >
                  <span>✓</span>
                  <span>{isAllocatingVisual ? 'Allocating...' : `Confirm Allocation (${selectedIds.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAllocatingForRequest(null);
                    setSelectedIds([]);
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171' }}
                >
                  ✕ Cancel Allocation
                </button>
              </div>
            </div>
          )}

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
                placeholder="Search school name, phone, city, address, or Place ID..."
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
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="input-field"
                  style={{ padding: '7px 10px', fontSize: '0.82rem', background: '#0f172a', color: '#ffffff' }}
                >
                  <option value="all">All Cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {activeTab !== 'fresh' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status:</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="input-field"
                    style={{ padding: '7px 10px', fontSize: '0.82rem', background: '#0f172a', color: '#ffffff' }}
                  >
                    <option value="all">All Outreach Stages</option>
                    <option value="new">📋 New (Uncontacted)</option>
                    <option value="rnr">📞 Ringing No Response (RNR)</option>
                    <option value="switched_off">📵 Switched Off</option>
                    <option value="interested">🔥 Interested</option>
                    <option value="contact_later">📅 Callback Scheduled</option>
                    <option value="following_up">🔄 Following Up</option>
                    <option value="converted_to_lead">🎯 Converted to Lead</option>
                    <option value="not_interested">✕ Not Interested</option>
                  </select>
                </div>
              )}

              {activeTab !== 'fresh' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned To:</label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="input-field"
                    style={{ padding: '7px 10px', fontSize: '0.82rem', background: '#0f172a', color: '#ffffff' }}
                  >
                    <option value="all">All Members</option>
                    <option value="unassigned">Unassigned (Fresh)</option>
                    {dbUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.user_code})</option>
                    ))}
                  </select>
                </div>
              )}

              {(search || selectedCity !== 'all' || selectedStatus !== 'all' || selectedUser !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedCity('all');
                    setSelectedStatus('all');
                    setSelectedUser('all');
                    setPage(1);
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#f87171' }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="enterprise-th" style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={records.length > 0 && selectedIds.length === records.length}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th className="enterprise-th">Institution & Google Info</th>
                    <th className="enterprise-th">Contact Numbers</th>
                    <th className="enterprise-th">City / Location</th>
                    <th className="enterprise-th">Outreach Status</th>
                    <th className="enterprise-th">Assigned Representative</th>
                    <th className="enterprise-th">Callback / Activity</th>
                    <th className="enterprise-th" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading places directory...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No places found matching your filters. Import a CSV or perform a Google Places search to discover prospects.
                      </td>
                    </tr>
                  ) : (
                    records.map((p) => {
                      const isSelected = selectedIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          style={{
                            background: isSelected ? 'rgba(56, 189, 248, 0.05)' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => openDrawer(p.id)}
                        >
                          <td
                            className="enterprise-td"
                            style={{ textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(p.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>

                          <td className="enterprise-td">
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                              {p.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              {p.rating && (
                                <span style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                  ★ {p.rating} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({p.rating_count || 0})</span>
                                </span>
                              )}
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                {p.primary_type ? p.primary_type.replace(/_/g, ' ') : 'school'}
                              </span>
                              {p.website && (
                                <a
                                  href={p.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ fontSize: '0.74rem', color: '#38bdf8', textDecoration: 'none' }}
                                >
                                  🌐 Web
                                </a>
                              )}
                              {p.maps_url && (
                                <a
                                  href={p.maps_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ fontSize: '0.74rem', color: '#34d399', textDecoration: 'none' }}
                                >
                                  📍 Maps
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="enterprise-td" onClick={(e) => e.stopPropagation()}>
                            {p.primary_phone ? (
                              <a
                                href={`tel:${p.primary_phone}`}
                                style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                📞 {p.primary_phone}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No phone</span>
                            )}
                            {p.alternative_phone && (
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Alt: {p.alternative_phone}
                              </div>
                            )}
                          </td>

                          <td className="enterprise-td">
                            <strong style={{ color: 'var(--text-primary)' }}>{p.city || '—'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {p.area || p.state || 'India'}
                            </div>
                          </td>

                          <td className="enterprise-td">
                            {getStatusBadge(p.status)}
                            {p.converted_lead_code && (
                              <div style={{ marginTop: '4px' }}>
                                <span className="enterprise-code-pill" style={{ fontSize: '0.7rem', color: '#34d399' }}>
                                  Lead: {p.converted_lead_code}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="enterprise-td">
                            {p.assigned_user_name ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="enterprise-avatar">
                                  {p.assigned_user_name.charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.assigned_user_name}</div>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.assigned_user_code}</span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                Central Pool (Unassigned)
                              </span>
                            )}
                          </td>

                          <td className="enterprise-td">
                            {p.callback_at ? (
                              <div style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.8rem' }}>
                                📅 {new Date(p.callback_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            ) : p.last_contacted_at ? (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Last call: {new Date(p.last_contacted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Not contacted</span>
                            )}
                          </td>

                          <td className="enterprise-td" style={{ textAlign: 'right' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(p.id);
                              }}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            >
                              Inspect ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>
                  Showing page {page} of {pagination.totalPages} ({pagination.total} records)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* DETAIL & AUDIT HISTORY DRAWER */}
      {selectedPlaceId && (
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
          onClick={closeDrawer}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
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
            {drawerLoading || !drawerPlace ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading full metadata and audit trail...
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                  <div>
                    <span className="enterprise-code-pill" style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
                      {drawerPlace.place_id}
                    </span>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                      {drawerPlace.name}
                    </h2>
                    <div style={{ marginTop: '6px' }}>
                      {getStatusBadge(drawerPlace.status)}
                    </div>
                  </div>
                  <button
                    onClick={closeDrawer}
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

                {/* Key Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Phone</span>
                    <div style={{ marginTop: '2px' }}>
                      <a href={`tel:${drawerPlace.primary_phone}`} style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'none' }}>
                        📞 {drawerPlace.primary_phone || '—'}
                      </a>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alt Phone</span>
                    <div style={{ marginTop: '2px', color: 'var(--text-primary)' }}>
                      {drawerPlace.alternative_phone ? `📞 ${drawerPlace.alternative_phone}` : '—'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>City & Area</span>
                    <div style={{ marginTop: '2px', fontWeight: 600 }}>
                      {[drawerPlace.area, drawerPlace.city, drawerPlace.country].filter(Boolean).join(', ')}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Google Rating</span>
                    <div style={{ marginTop: '2px', color: '#fbbf24', fontWeight: 700 }}>
                      ★ {drawerPlace.rating || 'N/A'} ({drawerPlace.rating_count || 0} reviews)
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Street Address</span>
                    <div style={{ marginTop: '2px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {drawerPlace.street_address || drawerPlace.formatted_address || '—'}
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {drawerPlace.website && (
                      <a href={drawerPlace.website} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                        🌐 Visit Website ↗
                      </a>
                    )}
                    {drawerPlace.maps_url && (
                      <a href={drawerPlace.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                        📍 Open in Google Maps ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Assignment & Notes */}
                <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>Assignment Status</span>
                    {drawerPlace.assigned_at && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Assigned on {new Date(drawerPlace.assigned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {drawerPlace.assigned_user_name ? (
                      <span>Assigned to {drawerPlace.assigned_user_name} [{drawerPlace.assigned_user_code}] ({drawerPlace.assigned_user_role})</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Unassigned in Central Pool</span>
                    )}
                  </div>
                  {drawerPlace.notes && (
                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      <strong>Latest Notes:</strong> {drawerPlace.notes}
                    </div>
                  )}
                </div>

                {/* Complete Chronological Audit History */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📜</span> Complete Audit History Trail
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {drawerHistory.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        No history entries recorded yet.
                      </div>
                    ) : (
                      drawerHistory.map((h) => (
                        <div
                          key={h.id}
                          style={{
                            padding: '12px 14px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                              {h.action.replace(/_/g, ' ')}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                            {h.notes}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span>by {h.actor_name || 'System'}</span>
                            {h.actor_code && <span className="enterprise-code-pill" style={{ fontSize: '0.68rem' }}>{h.actor_code}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isCsvModalOpen && (
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
          onClick={() => setIsCsvModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '600px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>📄 Import Google Apps Script CSV</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Upload or paste your Google Sheets export. Records are deduplicated by Place ID and automatically filtered for valid phone numbers.
                </p>
              </div>
              <button onClick={() => setIsCsvModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="input-field"
                style={{ width: '100%', padding: '8px' }}
              />
              {csvFileName && (
                <span style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '4px', display: 'block' }}>
                  Loaded: {csvFileName}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Or Paste CSV Text Directly
              </label>
              <textarea
                rows={6}
                placeholder="place_id,institution_name,primary_phone,city,rating..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              />
            </div>

            {importSummary && (
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                <strong style={{ color: '#34d399' }}>Import Results:</strong>
                <div>• Inserted New: {importSummary.insertedCount}</div>
                <div>• Updated Existing: {importSummary.updatedCount}</div>
                <div>• Skipped (No Phone Number): {importSummary.skippedNoPhoneCount}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsCsvModalOpen(false)} className="btn-secondary" disabled={isImporting}>
                Cancel
              </button>
              <button onClick={handleImportCsv} className="btn-primary" disabled={isImporting || !csvText.trim()}>
                {isImporting ? 'Processing CSV...' : 'Import Data Into DB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE PLACES API SEARCH MODAL */}
      {isApiSearchModalOpen && (
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
          onClick={() => setIsApiSearchModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '580px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>🔍 Google Places API Search (New)</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Directly search Google Places New API to discover new schools with phone numbers.
                </p>
              </div>
              <button onClick={() => setIsApiSearchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Search Keyword *
              </label>
              <input
                type="text"
                value={apiSearchQuery}
                onChange={(e) => setApiSearchQuery(e.target.value)}
                placeholder="e.g. CBSE Schools, Play School, High School"
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  City *
                </label>
                <input
                  type="text"
                  value={apiSearchCity}
                  onChange={(e) => setApiSearchCity(e.target.value)}
                  placeholder="e.g. Mumbai, Pune, Bangalore"
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Searchable Country Select Dropdown */}
              <div style={{ position: 'relative' }} ref={countryDropdownRef}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Country / Region *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryDropdownOpen(!isCountryDropdownOpen);
                    setCountrySearchQuery('');
                  }}
                  className="input-field"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: isCountryDropdownOpen ? '1px solid #38bdf8' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                      {selectedCountry.code}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                      {selectedCountry.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    {isCountryDropdownOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isCountryDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: '#0b1329',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.75)',
                      zIndex: 1500,
                      maxHeight: '230px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search country or code (e.g. IN, AE, US)..."
                        value={countrySearchQuery}
                        onChange={(e) => setCountrySearchQuery(e.target.value)}
                        className="input-field"
                        style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                      {COUNTRY_DATA.filter(
                        (c) =>
                          c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
                          c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
                      ).length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No country found matching "{countrySearchQuery}"
                        </div>
                      ) : (
                        COUNTRY_DATA.filter(
                          (c) =>
                            c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
                            c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
                        ).map((c) => (
                          <div
                            key={c.code}
                            onClick={() => {
                              setSelectedCountry(c);
                              setIsCountryDropdownOpen(false);
                              setCountrySearchQuery('');
                            }}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              background: selectedCountry.code === c.code ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                              color: selectedCountry.code === c.code ? '#38bdf8' : 'var(--text-primary)',
                              fontSize: '0.84rem',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                            }}
                            onMouseEnter={(e) => {
                              if (selectedCountry.code !== c.code) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCountry.code !== c.code) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <span>{c.name}</span>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                              {c.code}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Areas / Localities (Optional, comma-separated)
              </label>
              <input
                type="text"
                value={apiSearchAreas}
                onChange={(e) => setApiSearchAreas(e.target.value)}
                placeholder="e.g. Andheri, Bandra, Borivali"
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓</span>
              <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>Google Places API Key configured & active in system</span>
            </div>

            {apiSearchSummary && (
              <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                <strong style={{ color: '#38bdf8' }}>Search Summary:</strong>
                <div>• Total Prospects Evaluated: {apiSearchSummary.totalFetched}</div>
                <div>• New Added: {apiSearchSummary.insertedCount}</div>
                <div>• Existing Updated: {apiSearchSummary.updatedCount}</div>
                <div>• Filtered Out (No Phone Number): {apiSearchSummary.skippedNoPhoneCount}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsApiSearchModalOpen(false)} className="btn-secondary" disabled={isSearchingApi}>
                Cancel
              </button>
              <button onClick={handleGooglePlacesSearch} className="btn-primary" disabled={isSearchingApi || !apiSearchQuery.trim() || !apiSearchCity.trim()}>
                {isSearchingApi ? 'Calling Places API...' : 'Run Places Search'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN MODAL */}
      {isAssignModalOpen && (
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
          onClick={() => setIsAssignModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>⚡ Assign Selected Prospects</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              You are assigning <strong style={{ color: '#ffffff' }}>{selectedIds.length}</strong> selected records to a team member's working queue.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Select Team Member (With Places DB Access)
              </label>
              <select
                value={assignTargetUserId}
                onChange={(e) => setAssignTargetUserId(e.target.value)}
                className="input-field"
                style={{ width: '100%', padding: '9px 12px', background: '#0f172a', color: '#ffffff' }}
              >
                {dbUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.user_code}) - {u.role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAssignModalOpen(false)} className="btn-secondary" disabled={isAssigning}>
                Cancel
              </button>
              <button onClick={handleBulkAssign} className="btn-primary" disabled={isAssigning || !assignTargetUserId}>
                {isAssigning ? 'Assigning...' : `Confirm & Assign ${selectedIds.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULFILL REQUEST MODAL */}
      {fulfillModalRequest && (
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
          onClick={() => setFulfillModalRequest(null)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>⚡ Fulfill Data Quota Request</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Fulfill request for <strong style={{ color: '#ffffff' }}>{fulfillModalRequest.user_name} [{fulfillModalRequest.user_code}]</strong>.
              Remaining in queue: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{fulfillModalRequest.remaining_count} records</span>.
            </p>

            {fulfillModalRequest.preferred_city && (
              <div style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px', fontSize: '0.82rem', color: '#38bdf8' }}>
                Preferred City: <strong>{fulfillModalRequest.preferred_city}</strong>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Batch Size to Assign from Fresh Pool
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={fulfillBatchSize}
                onChange={(e) => setFulfillBatchSize(parseInt(e.target.value, 10) || 25)}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setFulfillModalRequest(null)} className="btn-secondary" disabled={isFulfilling}>
                Cancel
              </button>
              <button onClick={handleFulfillRequest} className="btn-primary" disabled={isFulfilling} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                {isFulfilling ? 'Assigning...' : `Assign ${fulfillBatchSize} Fresh Prospects ✓`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
