'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export interface ActorShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    user_code: string;
  } | null;
  roleTitle: string;
  roleBadgeClass: 'admin' | 'pre_sales' | 'referral' | 'business_relations' | string;
  roleColor: string;
  navItems: NavItem[];
  headerActions?: React.ReactNode;
  activeTabTitle?: string;
  children: React.ReactNode;
}

export default function ActorShell({
  user,
  roleTitle,
  roleBadgeClass,
  roleColor,
  navItems,
  headerActions,
  activeTabTitle,
  children,
}: ActorShellProps) {
  const router = useRouter();

  // Sidebar expanded state with localStorage persistence (default true)
  const [isExpanded, setIsExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('schoolites_sidebar_expanded');
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('schoolites_sidebar_expanded', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  const sidebarWidth = isExpanded ? 260 : 72;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      {/* ========================================================
          EXPANDABLE SIDEBAR
         ======================================================== */}
      <aside
        id="app-sidebar"
        style={{
          width: `${sidebarWidth}px`,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          background: 'rgba(11, 17, 32, 0.96)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Brand & Toggle Header */}
        <div
          style={{
            height: '64px',
            padding: isExpanded ? '0 16px 0 20px' : '0 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '17px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                flexShrink: 0,
              }}
            >
              S
            </div>
            {isExpanded && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <h2 style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Schoolites
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: roleColor,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'block',
                  }}
                >
                  {roleTitle}
                </span>
              </div>
            )}
          </div>

          {isExpanded && (
            <button
              onClick={toggleSidebar}
              title="Collapse Sidebar"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              ◀
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav
          style={{
            flex: 1,
            padding: isExpanded ? '18px 12px' : '18px 8px',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {isExpanded && (
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 10px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              Navigation
            </div>
          )}

          {navItems.map((item) => {
            const isActive = Boolean(item.isActive);
            const content = (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isExpanded ? 'space-between' : 'center',
                  width: '100%',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: '1.18rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.88rem',
                        fontWeight: isActive ? 600 : 500,
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </div>

                {isExpanded && item.badge !== undefined && item.badge !== null && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      background: isActive ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#e0e7ff' : 'var(--text-muted)',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );

            const commonStyles: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: isExpanded ? '10px 14px' : '12px 0',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              borderRadius: 'var(--radius-md)',
              background: isActive
                ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.22) 0%, rgba(99, 102, 241, 0.08) 100%)'
                : 'transparent',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
              color: isActive ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.16s ease',
              cursor: 'pointer',
              position: 'relative',
              textDecoration: 'none',
            };

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={!isExpanded ? item.label : undefined}
                  style={commonStyles}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                title={!isExpanded ? item.label : undefined}
                style={commonStyles}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {content}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Toggle at Bottom (when collapsed) */}
        {!isExpanded && (
          <div
            style={{
              padding: '12px 0',
              display: 'flex',
              justifyContent: 'center',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={toggleSidebar}
              title="Expand Sidebar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              ▶
            </button>
          </div>
        )}

        {/* User Identity Footer */}
        <div
          style={{
            padding: isExpanded ? '14px 16px' : '14px 8px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(10, 15, 29, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {isExpanded ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="user-code-pill" style={{ color: roleColor, fontSize: '0.74rem' }}>
                    {user?.user_code || '---'}
                  </span>
                  <span className={`badge-role ${roleBadgeClass}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    {roleTitle}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Logout ⎋
                </button>
              </div>

              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.name || 'Authorized Rep'}
                </div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.email || ''}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                title={`${user?.name} (${user?.user_code})`}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `2px solid ${roleColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#ffffff',
                }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  padding: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ⎋
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          MAIN WORKSPACE WRAPPER (Auto-offsets with sidebar)
         ======================================================== */}
      <div
        style={{
          flex: 1,
          marginLeft: `${sidebarWidth}px`,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ========================================================
            STICKY HEADER
           ======================================================== */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 90,
            height: '64px',
            background: 'rgba(9, 13, 22, 0.88)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            gap: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Left: Sidebar Toggle + Portal & Section Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={toggleSidebar}
              title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              ☰
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
                  {roleTitle}
                </span>
                {activeTabTitle && (
                  <>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
                    <span style={{ fontSize: '0.88rem', color: '#c7d2fe', fontWeight: 600 }}>
                      {activeTabTitle}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actor-specific Header Actions + Actor Pill & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Dynamic Action Buttons (e.g. + Create Lead, Copy Referral Link) */}
            {headerActions && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {headerActions}
              </div>
            )}

            <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 2px' }} />

            {/* Actor Identity Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge-role ${roleBadgeClass}`} style={{ fontSize: '0.74rem' }}>
                {roleTitle}
              </span>
              <span className="user-code-pill" style={{ color: roleColor, fontSize: '0.76rem' }}>
                {user?.user_code || '---'}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Sign Out of Portal"
            >
              <span>Logout</span>
              <span style={{ fontSize: '0.9rem' }}>⎋</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
