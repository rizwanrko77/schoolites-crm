'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LEAD_STATUSES } from '@/lib/leadStatuses';

export interface LeadTableControlsProps {
  search: string;
  onSearchChange: (search: string) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  onClearAll: () => void;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
}

export default function LeadTableControls({
  search,
  onSearchChange,
  selectedStatuses,
  onStatusesChange,
  sortBy,
  onSortChange,
  onClearAll,
  placeholder = 'Search by code, institute, city, SPOC, phone, email...',
  totalCount,
  filteredCount,
}: LeadTableControlsProps) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusPopoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusPopoverRef.current && !statusPopoverRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allStatusIds = LEAD_STATUSES.map((s) => s.id);
  const isAllSelected = selectedStatuses.length === allStatusIds.length;
  const isNoneSelected = selectedStatuses.length === 0;
  const isFiltered = Boolean(search.trim()) || !isAllSelected || sortBy !== 'created_desc';

  const toggleStatus = (id: string) => {
    let newSelection: string[];
    if (selectedStatuses.includes(id)) {
      newSelection = selectedStatuses.filter((sid) => sid !== id);
    } else {
      newSelection = [...selectedStatuses, id];
    }
    onStatusesChange(newSelection);
  };

  const handleSelectAll = () => {
    onStatusesChange(allStatusIds);
  };

  const handleClearStatuses = () => {
    onStatusesChange([]);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '16px',
      }}
    >
      {/* Left: Search Bar */}
      <div style={{ flex: '1 1 300px', minWidth: '240px', position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          style={{
            paddingLeft: '36px',
            paddingRight: search ? '36px' : '14px',
            paddingTop: '8px',
            paddingBottom: '8px',
            fontSize: '0.86rem',
            width: '100%',
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            title="Clear search text"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Right Controls: Status Filter, Sort Dropdown, Clear All */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Status Multi-Select Filter Popover */}
        <div style={{ position: 'relative' }} ref={statusPopoverRef}>
          <button
            type="button"
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              fontWeight: 600,
              background: !isAllSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: !isAllSelected ? '#a5b4fc' : 'var(--text-secondary)',
              border: !isAllSelected ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🎯</span>
            <span>
              {isAllSelected
                ? 'All Stages'
                : selectedStatuses.length === 0
                ? 'No Stages'
                : `Stage (${selectedStatuses.length})`}
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{isStatusOpen ? '▲' : '▼'}</span>
          </button>

          {isStatusOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                zIndex: 100,
                width: '260px',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                padding: '12px',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Filter Stages
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#818cf8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    All
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
                  <button
                    type="button"
                    onClick={handleClearStatuses}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {LEAD_STATUSES.map((st) => {
                  const isChecked = selectedStatuses.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '9px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        transition: 'background 0.12s ease',
                        background: isChecked ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isChecked ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStatus(st.id)}
                        style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <span style={{ color: st.color, fontSize: '0.9rem' }}>●</span>
                      <span style={{ color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isChecked ? 600 : 400 }}>
                        {st.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="input-field"
            style={{
              padding: '7px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: 'auto',
              background: '#0f172a',
              border: sortBy !== 'created_desc' ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
              color: sortBy !== 'created_desc' ? '#a5b4fc' : 'var(--text-primary)',
            }}
          >
            <option value="created_desc">🕒 Created (Newest First)</option>
            <option value="created_asc">🕒 Created (Oldest First)</option>
            <option value="updated_desc">🔄 Updated (Most Recent)</option>
            <option value="updated_asc">🔄 Updated (Oldest First)</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={onClearAll}
            title="Reset all search, status filters, and sorting to defaults"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>✕</span>
            <span>Clear Filters</span>
          </button>
        )}

        {/* Showing Count */}
        {totalCount !== undefined && filteredCount !== undefined && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
