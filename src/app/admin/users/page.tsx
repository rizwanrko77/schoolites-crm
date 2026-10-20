'use client';

import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: 'admin' | 'pre_sales' | 'referral' | 'business_relations';
  date_of_joining: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface UserCounts {
  total: number;
  active: number;
  admin: number;
  pre_sales: number;
  referral: number;
  business_relations: number;
}

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'pre_sales',
    date_of_joining: new Date().toISOString().split('T')[0],
    description: '',
  });

  // Action status message
  const [toastMsg, setToastMsg] = useState('');

  // Sensitive Action Confirmation State
  const [confirmStatusUser, setConfirmStatusUser] = useState<User | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (roleFilter !== 'all') queryParams.append('role', roleFilter);
      if (search.trim()) queryParams.append('search', search.trim());

      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
      if (data.counts) setCounts(data.counts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(debounce);
  }, [search, roleFilter]);

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
        date_of_joining: new Date().toISOString().split('T')[0],
        description: '',
      });
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
    business_relations: 'BR',
    admin: 'ADM',
  };

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '28px' }}>
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

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Total Users
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {counts.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '4px' }}>
            ● {counts.active} Active Access
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid var(--role-presales-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--role-presales-color)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Pre-Sales Team
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {counts.pre_sales}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Prefix: <span className="user-code-pill" style={{ color: 'var(--role-presales-color)' }}>PS-</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid var(--role-referral-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--role-referral-color)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Referral Partners
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {counts.referral}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Prefix: <span className="user-code-pill" style={{ color: 'var(--role-referral-color)' }}>REF-</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid var(--role-business-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--role-business-color)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Business Relations
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {counts.business_relations}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Prefix: <span className="user-code-pill" style={{ color: 'var(--role-business-color)' }}>BR-</span>
          </div>
        </div>
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
        {/* Role Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'pre_sales', label: 'Pre-Sales' },
            { id: 'referral', label: 'Referral' },
            { id: 'business_relations', label: 'Business Relations' },
            { id: 'admin', label: 'Admins' },
          ].map((tab) => {
            const isSelected = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  border: isSelected ? '1px solid #818cf8' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
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
        <div style={{ overflowX: 'auto' }}>
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
                      <span className="user-code-pill" style={{ color: '#ffffff' }}>
                        {user.user_code}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {user.email}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge-role ${user.role}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '240px' }}>
                      {user.description || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
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
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="pre_sales">Pre-Sales (PS)</option>
                    <option value="referral">Referral Partner (REF)</option>
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
