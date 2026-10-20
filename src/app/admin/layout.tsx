'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!data.user || data.user.role !== 'admin') {
          router.push('/login');
          return;
        }
        setCurrentUser(data.user);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '0.95rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Verifying Admin Access...
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Team Users', href: '/admin/users', icon: '👥', badge: 'Core' },
    { label: 'Form Builder', href: '/admin/forms', icon: '📝', badge: 'V1' },
    { label: 'All Leads & Pool', href: '/admin/leads', icon: '🎯', badge: 'Phase 4' },
    { label: 'Places DB Pipeline', href: '/admin/database', icon: '🏢', badge: 'Phase 5' },
    { label: 'Incentives & Payouts', href: '/admin/incentives', icon: '💰', badge: 'Phase 6' },
    { label: 'Assets Hub', href: '/admin/assets', icon: '📁', badge: 'Phase 3' },
    { label: 'Audit Logs', href: '/admin/logs', icon: '📜', badge: 'Security' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '280px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '18px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            S
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Schoolites</h2>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--role-admin-color)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Admin Center
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0 12px 10px',
            }}
          >
            Management
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.9rem',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                        color: isActive ? '#c7d2fe' : 'var(--text-muted)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User profile footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(10, 15, 29, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="user-code-pill" style={{ color: 'var(--role-admin-color)' }}>
                {currentUser?.user_code}
              </span>
              <span className="badge-role admin">Admin</span>
            </div>
            <button
              id="logout-btn"
              onClick={handleLogout}
              title="Sign Out"
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Logout ⎋
            </button>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.email}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, marginLeft: '280px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
