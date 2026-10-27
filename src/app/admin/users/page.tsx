'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAdminReady } from '../admin-session';

interface User {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: 'admin' | 'pre_sales' | 'referral' | 'business_relations' | 'promoter';
  commission_rate?: number | string | null;
  date_of_joining: string | null;
  description: string | null;
  is_active: boolean;
  has_database_access?: boolean;
  created_at: string;
}

interface UserCounts {
  total: number;
  active: number;
  inactive?: number;
  admin: number;
  pre_sales: number;
  referral: number;
  promoter?: number;
  business_relations: number;
}

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admins', prefix: 'ADM', color: 'var(--role-admin-color)' },
  { id: 'pre_sales', label: 'Pre-Sales', prefix: 'PS', color: 'var(--role-presales-color)' },
  { id: 'referral', label: 'Referral Partners', prefix: 'REF', color: 'var(--role-referral-color)' },
  { id: 'promoter', label: 'Promoters', prefix: 'PM', color: 'var(--role-promoter-color)' },
  { id: 'business_relations', label: 'Business Relations', prefix: 'BR', color: 'var(--role-business-color)' },
];

const ALL_ROLE_IDS = ROLE_OPTIONS.map((r) => r.id);

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState<UserCounts>({
    total: 0,
    active: 0,
    admin: 0,
    pre_sales: 0,
    referral: 0,
    business_relations: 0,
  });
  const adminReady = useAdminReady();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  // Role Multi-Select Filter State
  const [selectedRoles, setSelectedRoles] = useState<string[]>(ALL_ROLE_IDS);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Active Status Filter State (options: 'all' | 'active' | 'inactive', default: 'active')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Role Breakdown Stats & Overview Card Collapse State (hidden/collapsed by default)
  const [roleStats, setRoleStats] = useState<Record<string, { total: number; active: number; inactive: number }>>({});
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

  const isAllRolesSelected = selectedRoles.length === ALL_ROLE_IDS.length;
  const isNoRolesSelected = selectedRoles.length === 0;

  // Dismiss dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dismiss dropdowns on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsRoleDropdownOpen(false);
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSelectAllRoles = () => {
    setSelectedRoles(ALL_ROLE_IDS);
  };

  const handleClearRoles = () => {
    setSelectedRoles([]);
  };

  const ROLE_DEFAULT_RATES: Record<string, number> = {
    promoter: 10,
    pre_sales: 10,
    referral: 20,
    business_relations: 10,
    admin: 0,
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [rateMode, setRateMode] = useState<'default' | 'custom'>('default');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'pre_sales',
    date_of_joining: '',
    description: '',
    commission_rate: '10',
    has_database_access: false,
  });

  // Action status message
  const [toastMsg, setToastMsg] = useState('');

  // Sensitive Action Confirmation State
  const [confirmStatusUser, setConfirmStatusUser] = useState<User | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const queryParams = new URLSearchParams();
      if (selectedRoles.length === 0) {
        queryParams.append('roles', 'none');
      } else if (selectedRoles.length < ALL_ROLE_IDS.length) {
        queryParams.append('roles', selectedRoles.join(','));
      }
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }
      if (search.trim()) queryParams.append('search', search.trim());

      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load users');
        return;
      }
      setUsers(data.users || []);
      if (data.counts) setCounts(data.counts);
      if (data.roleStats) setRoleStats(data.roleStats);
    } catch {
      setLoadError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminReady) return;
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(debounce);
  }, [search, selectedRoles, statusFilter, adminReady]);

  const handleConfirmStatusChange = async () => {
    if (!confirmStatusUser) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${confirmStatusUser.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !confirmStatusUser.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update user status');
        return;
      }
      setToastMsg(`Status for ${confirmStatusUser.name} (${confirmStatusUser.user_code}) updated to ${!confirmStatusUser.is_active ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setToastMsg(''), 3500);
      setConfirmStatusUser(null);
      fetchUsers();
    } catch {
      alert('Error updating user status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setIsModalOpen(false);
      setFormData({
        name: '',
        email: '',
        role: 'pre_sales',
        date_of_joining: '',
        description: '',
        commission_rate: '10',
        has_database_access: false,
      });
      setRateMode('default');
      setToastMsg(`User ${data.user.user_code} successfully created!`);
      setTimeout(() => setToastMsg(''), 4000);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rolePrefixMap: Record<string, string> = {
    pre_sales: 'PS',
    referral: 'REF',
    promoter: 'PM',
    business_relations: 'BR',
    admin: 'ADM',
  };

  return (
    <div className="workspace-container">
      {/* Top Banner / Toast Notification */}
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

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Team & User Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Control user permissions, generate unique user codes, and monitor team access
          </p>
          {loadError && (
            <p style={{ color: '#fca5a5', fontSize: '0.88rem', marginTop: '8px' }}>{loadError}</p>
          )}
        </div>

        <button
          id="add-member-btn"
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
          style={{ padding: '12px 22px', fontSize: '0.95rem' }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
          Add Team Member
        </button>
      </div>

      {/* Role & Prefix Overview (Compact Summary Table) */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {/* Header with Collapse/Expand Toggle */}
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: isOverviewExpanded ? '1px solid var(--border-subtle)' : 'none',
          }}
          onClick={() => setIsOverviewExpanded((prev) => !prev)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.05rem' }}>📊</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
              Team Roles & Prefix Overview
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                padding: '2px 9px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                fontWeight: 600,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              {counts.total} Total ({counts.active} Active, {counts.inactive ?? 0} Inactive)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {isOverviewExpanded ? 'Hide Table' : 'Show Table'}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                transform: isOverviewExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Expandable Table */}
        {isOverviewExpanded && (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.015)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    Role Type
                  </th>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    Code Prefix
                  </th>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    Active
                  </th>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    Inactive
                  </th>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    Total Users
                  </th>
                  <th style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROLE_OPTIONS.map((item) => {
                  const stat = roleStats[item.id] || { total: 0, active: 0, inactive: 0 };
                  const isCurrentFilter = selectedRoles.length === 1 && selectedRoles[0] === item.id;
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.12s ease',
                        background: isCurrentFilter ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isCurrentFilter
                          ? 'rgba(99, 102, 241, 0.08)'
                          : 'transparent')
                      }
                    >
                      <td style={{ padding: '9px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: item.color,
                              display: 'inline-block',
                              boxShadow: `0 0 6px ${item.color}`,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{item.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 20px' }}>
                        <span className="user-code-pill" style={{ color: item.color, fontSize: '0.78rem' }}>
                          {item.prefix}-
                        </span>
                      </td>
                      <td style={{ padding: '9px 20px' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ● {stat.active}
                        </span>
                      </td>
                      <td style={{ padding: '9px 20px' }}>
                        <span style={{ color: stat.inactive > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: stat.inactive > 0 ? 600 : 400 }}>
                          {stat.inactive}
                        </span>
                      </td>
                      <td style={{ padding: '9px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {stat.total}
                      </td>
                      <td style={{ padding: '9px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrentFilter) {
                              setSelectedRoles(ALL_ROLE_IDS);
                            } else {
                              setSelectedRoles([item.id]);
                            }
                          }}
                          style={{
                            background: isCurrentFilter ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                            border: isCurrentFilter ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                            color: isCurrentFilter ? '#ffffff' : 'var(--text-secondary)',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {isCurrentFilter ? 'Clear Filter' : 'Filter →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Role Multi-Select Dropdown Popover */}
          <div style={{ position: 'relative' }} ref={roleDropdownRef}>
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
              aria-expanded={isRoleDropdownOpen}
              aria-haspopup="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 15px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: !isAllRolesSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: !isAllRolesSelected ? '#a5b4fc' : 'var(--text-secondary)',
                border: !isAllRolesSelected ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: !isAllRolesSelected ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none',
              }}
            >
              <span>👥</span>
              <span>
                {isAllRolesSelected
                  ? 'All Roles'
                  : isNoRolesSelected
                  ? 'No Roles'
                  : selectedRoles.length === 1
                  ? ROLE_OPTIONS.find((r) => r.id === selectedRoles[0])?.label || '1 Role'
                  : `Roles (${selectedRoles.length})`}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  opacity: 0.8,
                  transition: 'transform 0.15s ease',
                  transform: isRoleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </span>
            </button>

            {isRoleDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 100,
                  width: '270px',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                  padding: '12px',
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                {/* Popover Header */}
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
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Filter Roles
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllRoles}
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
                      onClick={handleClearRoles}
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

                {/* Roles Checkbox List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {ROLE_OPTIONS.map((role) => {
                    const isChecked = selectedRoles.includes(role.id);
                    const roleCount = (counts as any)[role.id] ?? 0;
                    return (
                      <label
                        key={role.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          transition: 'background 0.12s ease',
                          background: isChecked ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isChecked
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRole(role.id)}
                            style={{
                              cursor: 'pointer',
                              accentColor: '#6366f1',
                              width: '14px',
                              height: '14px',
                            }}
                          />
                          <span style={{ color: isChecked ? '#ffffff' : 'var(--text-secondary)' }}>
                            {role.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}
                          >
                            {roleCount}
                          </span>
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: role.color,
                              display: 'inline-block',
                            }}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Status Dropdown Popover */}
          <div style={{ position: 'relative' }} ref={statusDropdownRef}>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
              aria-expanded={isStatusDropdownOpen}
              aria-haspopup="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 15px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: statusFilter !== 'all' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: statusFilter !== 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: statusFilter !== 'all' ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: statusFilter !== 'all' ? '0 0 10px rgba(99, 102, 241, 0.2)' : 'none',
              }}
            >
              <span>
                {statusFilter === 'active' ? '🟢' : statusFilter === 'inactive' ? '🔴' : '🔘'}
              </span>
              <span>
                {statusFilter === 'active'
                  ? 'Active'
                  : statusFilter === 'inactive'
                  ? 'Inactive'
                  : 'All Statuses'}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  opacity: 0.8,
                  transition: 'transform 0.15s ease',
                  transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </span>
            </button>

            {isStatusDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 100,
                  width: '190px',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                  padding: '8px',
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {[
                    { id: 'all', label: 'All Statuses', icon: '🔘', count: counts.total },
                    { id: 'active', label: 'Active', icon: '🟢', count: counts.active },
                    { id: 'inactive', label: 'Inactive', icon: '🔴', count: counts.inactive ?? (counts.total - counts.active) },
                  ].map((opt) => {
                    const isSelected = statusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.id as any);
                          setIsStatusDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '5px',
                          background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 600 : 500,
                          textAlign: 'left',
                          transition: 'background 0.12s ease',
                          width: '100%',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem' }}>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            fontWeight: 500,
                          }}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search input */}
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <input
            type="text"
            placeholder="Search by name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ padding: '9px 14px', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  User Code
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Member Name & Email
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Team Role
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Joined Date
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Description / Department
                </th>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading team directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="user-code-pill"
                        style={{ color: '#ffffff', textDecoration: 'none', display: 'inline-block' }}
                      >
                        {user.user_code}
                      </Link>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Link
                        href={`/admin/users/${user.id}`}
                        style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px', textDecoration: 'none', display: 'inline-block' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      >
                        {user.name} ↗
                      </Link>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {user.email}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge-role ${user.role}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                      {user.has_database_access && (
                        <span
                          style={{
                            marginLeft: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          <span>🏢</span> DB Access
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '240px' }}>
                      {user.description || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="btn-secondary"
                          style={{
                            padding: '5px 12px',
                            fontSize: '0.78rem',
                            textDecoration: 'none',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          Performance ↗
                        </Link>
                        <button
                          onClick={() => setConfirmStatusUser(user)}
                          title={user.is_active ? 'Click to deactivate access' : 'Click to reactivate access'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: user.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: user.is_active ? '#34d399' : '#f87171',
                            border: user.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '0.65rem' }}>●</span>
                          <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '32px',
              position: 'relative',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.25s ease',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Add New Team Member</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Assign role and auto-generate unique user code
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '1.4rem',
                  lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Work Email *
                </label>
                <input
                  type="email"
                  placeholder="e.g. rahul@schoolites.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  User will use this email to receive login OTP.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Team Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as any;
                      const isEligibleForDb = newRole === 'pre_sales' || newRole === 'referral';
                      setFormData({
                        ...formData,
                        role: newRole,
                        commission_rate: rateMode === 'default' ? String(ROLE_DEFAULT_RATES[newRole] ?? 10) : formData.commission_rate,
                        has_database_access: isEligibleForDb ? formData.has_database_access : false,
                      });
                    }}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="pre_sales">Pre-Sales (PS)</option>
                    <option value="referral">Referral Partner (REF)</option>
                    <option value="promoter">Promoter / Affiliate (PM)</option>
                    <option value="business_relations">Business Relations (BR)</option>
                    <option value="admin">Administrator (ADM)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                    className="input-field"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* Incentive / Commission Rate Settings */}
              {formData.role !== 'admin' && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                      Incentive / Commission Rate (%)
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRateMode('default');
                          setFormData((prev) => ({
                            ...prev,
                            commission_rate: String(ROLE_DEFAULT_RATES[prev.role] ?? 10),
                          }));
                        }}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: rateMode === 'default' ? '#6366f1' : 'var(--border-subtle)',
                          background: rateMode === 'default' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: rateMode === 'default' ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Default ({ROLE_DEFAULT_RATES[formData.role]}%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateMode('custom')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: rateMode === 'custom' ? '#6366f1' : 'var(--border-subtle)',
                          background: rateMode === 'custom' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          color: rateMode === 'custom' ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Custom %
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      disabled={rateMode === 'default'}
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                      className="input-field"
                      style={{
                        maxWidth: '120px',
                        fontWeight: 700,
                        color: '#34d399',
                        opacity: rateMode === 'default' ? 0.8 : 1,
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      % payout on verified cash collected from won deals
                    </span>
                  </div>
                </div>
              )}

              {/* Code Preview Callout */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px dashed rgba(99, 102, 241, 0.3)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Generated Code Prefix:</span>
                <span className="user-code-pill" style={{ color: '#818cf8', fontWeight: 700 }}>
                  {rolePrefixMap[formData.role]}-&#123;next_seq&#125;
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Description / Department (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. North Zone Outreach representative"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Database Access Toggle (Pre-Sales & Referral only) */}
              {(formData.role === 'pre_sales' || formData.role === 'referral') && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: formData.has_database_access ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: formData.has_database_access ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setFormData((f) => ({ ...f, has_database_access: !f.has_database_access }))}
                >
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏢</span>
                      <span>Grant Places Database Access</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Gives member access to the discovery queue & Google Places outreach pipeline.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.has_database_access}
                    onChange={(e) => setFormData({ ...formData, has_database_access: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="submit-user-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating User...' : 'Create & Assign Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR SENSITIVE ACCESS CHANGES */}
      {confirmStatusUser && (
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
              border: confirmStatusUser.is_active ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: confirmStatusUser.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                {confirmStatusUser.is_active ? '⚠️' : '✅'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  {confirmStatusUser.is_active ? 'Deactivate Member Access?' : 'Reactivate Member Access?'}
                </h3>
                <span className="user-code-pill" style={{ color: '#ffffff', fontSize: '0.78rem' }}>
                  {confirmStatusUser.user_code}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              {confirmStatusUser.is_active ? (
                <>
                  Are you sure you want to deactivate access for <strong style={{ color: '#ffffff' }}>{confirmStatusUser.name}</strong>?
                  They will be <span style={{ color: '#f87171', fontWeight: 600 }}>immediately blocked</span> from requesting OTPs and logging into the Schoolites portal.
                </>
              ) : (
                <>
                  Are you sure you want to restore access for <strong style={{ color: '#ffffff' }}>{confirmStatusUser.name}</strong>?
                  They will be able to receive OTPs and access their dashboard again.
                </>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmStatusUser(null)}
                className="btn-secondary"
                disabled={isUpdatingStatus}
              >
                Cancel
              </button>
              <button
                id="confirm-status-action-btn"
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: '#ffffff',
                  background: confirmStatusUser.is_active
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: confirmStatusUser.is_active
                    ? '0 4px 14px rgba(239, 68, 68, 0.4)'
                    : '0 4px 14px rgba(16, 185, 129, 0.4)',
                }}
              >
                {isUpdatingStatus
                  ? 'Updating...'
                  : confirmStatusUser.is_active
                  ? 'Yes, Deactivate Access'
                  : 'Yes, Reactivate Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
