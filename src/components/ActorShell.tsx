'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PricingModal from './PricingModal';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  section?: string;
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

  // Desktop sidebar expanded state with localStorage persistence (default true)
  const [isExpanded, setIsExpanded] = useState(true);

  // Mobile drawer state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Global Pricing Modal State
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // My Account Profile Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('schoolites_sidebar_expanded');
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    if (isMobile) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setIsExpanded((prev) => {
        const next = !prev;
        localStorage.setItem('schoolites_sidebar_expanded', String(next));
        return next;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  const showLabels = isMobile || isExpanded;
  const sidebarWidth = isMobile ? 270 : isExpanded ? 260 : 72;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobile && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 998,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ========================================================
          EXPANDABLE SIDEBAR / MOBILE OFF-CANVAS DRAWER
         ======================================================== */}
      <aside
        id="app-sidebar"
        style={{
          width: `${sidebarWidth}px`,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: isMobile ? 999 : 100,
          background: 'rgba(11, 17, 32, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: isMobile
            ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'width 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isMobile ? (mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          overflow: 'hidden',
          boxShadow: isMobile && mobileDrawerOpen ? '8px 0 32px rgba(0, 0, 0, 0.75)' : '4px 0 24px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: isMobile ? '58px' : '64px',
            padding: showLabels ? '0 20px' : '0 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'space-between' : 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            <img
              src="/schoolites-logo.png"
              alt="Schoolites Logo"
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#ffffff',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
                flexShrink: 0,
              }}
            />
            {showLabels && (
              <div style={{ overflow: 'hidden' }}>
                <h2 style={{ fontSize: isMobile ? '0.98rem' : '1.02rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.2 }}>
                  Schoolites ERP
                </h2>
                <span
                  style={{
                    fontSize: isMobile ? '0.62rem' : '0.68rem',
                    color: roleColor,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                    lineHeight: 1.2,
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {roleTitle}
                </span>
              </div>
            )}
          </div>

          {/* Close button inside mobile drawer */}
          {isMobile && (
            <button
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav
          style={{
            flex: 1,
            padding: showLabels ? '20px 12px' : '20px 8px',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {showLabels && !navItems.some((item) => Boolean(item.section)) && (
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

          {navItems.map((item, idx) => {
            const isActive = Boolean(item.isActive);
            const prevItem = idx > 0 ? navItems[idx - 1] : null;
            const isNewSection = item.section && (!prevItem || prevItem.section !== item.section);

            const sectionNode = isNewSection ? (
              showLabels ? (
                <div
                  key={`sec-${item.section}`}
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: idx === 0 ? '0 10px 6px' : '16px 10px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.section}
                </div>
              ) : idx > 0 ? (
                <div
                  key={`div-${idx}`}
                  style={{
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    margin: '8px 4px',
                  }}
                />
              ) : null
            ) : null;

            const content = (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showLabels ? 'space-between' : 'center',
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
                  {showLabels && (
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

                {showLabels && item.badge !== undefined && item.badge !== null && (
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
              padding: showLabels ? '10px 14px' : '12px 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
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

            return (
              <React.Fragment key={item.id}>
                {sectionNode}
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (isMobile) setMobileDrawerOpen(false);
                    }}
                    title={!showLabels ? item.label : undefined}
                    style={commonStyles}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      item.onClick?.();
                      if (isMobile) setMobileDrawerOpen(false);
                    }}
                    title={!showLabels ? item.label : undefined}
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
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* ========================================================
          MAIN WORKSPACE WRAPPER (Auto-offsets with sidebar / 0 margin on mobile)
         ======================================================== */}
      <div
        style={{
          flex: 1,
          marginLeft: isMobile ? '0px' : `${sidebarWidth}px`,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: isMobile ? 'none' : 'margin-left 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
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
            height: isMobile ? '58px' : '64px',
            background: 'rgba(9, 13, 22, 0.88)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0 14px' : '0 32px',
            gap: isMobile ? '10px' : '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Left: Sidebar Toggle + Current Section Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', overflow: 'hidden' }}>
            <button
              onClick={toggleSidebar}
              title={isMobile ? 'Open Menu' : isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
              style={{
                width: isMobile ? '34px' : '36px',
                height: isMobile ? '34px' : '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '0.95rem' : '1rem',
                transition: 'all 0.15s ease',
                flexShrink: 0,
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

            <div style={{ overflow: 'hidden' }}>
              <span
                style={{
                  fontSize: isMobile ? '0.9rem' : '1.02rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                  maxWidth: isMobile ? '150px' : '400px',
                }}
              >
                {activeTabTitle || roleTitle}
              </span>
            </div>
          </div>

          {/* Right: Action Buttons + "My Account" Profile Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', flexShrink: 0 }}>
            {/* Global Pricing Button */}
            <button
              type="button"
              onClick={() => setIsPricingModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: isMobile ? '5px 10px' : '6px 14px',
                borderRadius: '20px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#c7d2fe',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.22)';
                e.currentTarget.style.borderColor = '#818cf8';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                e.currentTarget.style.color = '#c7d2fe';
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>🏷️</span>
              <span>Pricing</span>
            </button>

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
                  gap: isMobile ? '6px' : '9px',
                  padding: isMobile ? '4px 10px 4px 4px' : '5px 14px 5px 6px',
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
                    width: isMobile ? '26px' : '30px',
                    height: isMobile ? '26px' : '30px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? '0.76rem' : '0.82rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }}
                >
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                {!isMobile && <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>My Account</span>}
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
                    maxWidth: 'calc(100vw - 28px)',
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

      {/* Global Pricing Modal for Actors and Admins */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        isAdmin={user?.role === 'admin'}
      />
    </div>
  );
}
