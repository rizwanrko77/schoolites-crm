'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ActorShell, { NavItem } from '@/components/ActorShell';

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

  const navItems: NavItem[] = [
    { id: 'users', label: 'Team Users', href: '/admin/users', icon: '👥', badge: 'Core', isActive: pathname.startsWith('/admin/users') },
    { id: 'forms', label: 'Form Builder', href: '/admin/forms', icon: '📝', badge: 'V1', isActive: pathname.startsWith('/admin/forms') },
    { id: 'leads', label: 'All Leads & Pool', href: '/admin/leads', icon: '🎯', badge: 'Phase 4', isActive: pathname.startsWith('/admin/leads') },
    { id: 'database', label: 'Places DB Pipeline', href: '/admin/database', icon: '🏢', badge: 'Phase 5', isActive: pathname.startsWith('/admin/database') },
    { id: 'incentives', label: 'Incentives & Payouts', href: '/admin/incentives', icon: '💰', badge: 'Phase 6', isActive: pathname.startsWith('/admin/incentives') },
    { id: 'assets', label: 'Assets Hub', href: '/admin/assets', icon: '📁', badge: 'Phase 3', isActive: pathname.startsWith('/admin/assets') },
    { id: 'logs', label: 'Audit Logs', href: '/admin/logs', icon: '📜', badge: 'Security', isActive: pathname.startsWith('/admin/logs') },
  ];

  const currentNav = navItems.find((n) => n.isActive);

  return (
    <ActorShell
      user={currentUser}
      roleTitle="Admin Center"
      roleBadgeClass="admin"
      roleColor="var(--role-admin-color)"
      navItems={navItems}
      activeTabTitle={currentNav?.label}
    >
      {children}
    </ActorShell>
  );
}
