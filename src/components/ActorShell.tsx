'use client';

import React, { useState, useEffect, useRef } from 'react';
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

  // My Account Profile Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('schoolites_sidebar_expanded');
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
  }, []);

  // Close profile menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        {/* Brand Header (without role subtitle and without redundant collapse button) */}
        <div
          style={{
            height: '64px',
            padding: isExpanded ? '0 20px' : '0 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
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
              <h2 style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.2 }}>
                Schoolites ERP
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: roleColor,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  lineHeight: 1.3,
                  marginTop: '2px',
                }}
              >
                {roleTitle}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <nav
          style={{
            flex: 1,
            padding: isExpanded ? '20px 12px' : '20px 8px',
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
                padding: '0 10px 8px',
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
              <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {activeTabTitle || roleTitle}
              </span>
            </div>
          </div>

          {/* Right: Action Buttons + "My Account" Profile Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Action Buttons (e.g. + Create Lead) */}
            {headerActions && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {headerActions}
              </div>
            )}

            {/* MY ACCOUNT PROFILE DROPDOWN MENU */}
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '5px 14px 5px 6px',
                  borderRadius: '24px',
                  background: isProfileMenuOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: isProfileMenuOpen ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isProfileMenuOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!isProfileMenuOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }}
                >
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>My Account</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isProfileMenuOpen ? '▲' : '▼'}</span>
              </button>

              {/* FLOATING PROFILE POPOVER */}
              {isProfileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '270px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)',
                    padding: '16px',
                    zIndex: 1100,
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  {/* User Profile Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                      }}
                    >
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user?.name || 'Authorized Rep'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user?.email || ''}
                      </div>
                    </div>
                  </div>

                  {/* Role & ID Badges */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '6px',
                      marginBottom: '14px',
                    }}
                  >
                    <span className={`badge-role ${roleBadgeClass}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                      {roleTitle}
                    </span>
                    <span className="user-code-pill" style={{ color: roleColor, fontSize: '0.74rem' }}>
                      {user?.user_code || '---'}
                    </span>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '10px 0' }} />

                  {/* Sign Out Button */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    }}
                  >
                    <span>Sign Out of Account</span>
                    <span style={{ fontSize: '1rem' }}>⎋</span>
                  </button>
                </div>
              )}
            </div>
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
