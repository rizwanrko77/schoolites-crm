'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ActorShell, { NavItem } from '@/components/ActorShell';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
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

  const navItems: NavItem[] = [
    { id: 'users', label: 'All Users', href: '/admin/users', icon: '👥', badge: 'Core', isActive: pathname.startsWith('/admin/users') },
    { id: 'enquiries', label: 'All Enquiries', href: '/admin/enquiries', icon: '📥', badge: 'Inbound', isActive: pathname.startsWith('/admin/enquiries') },
    { id: 'leads', label: 'All Leads', href: '/admin/leads', icon: '🎯', badge: 'Phase 4', isActive: pathname.startsWith('/admin/leads') },
    { id: 'forms', label: 'Form Builder', href: '/admin/forms', icon: '📝', badge: 'V1', isActive: pathname.startsWith('/admin/forms') },
    { id: 'database', label: 'Places DB', href: '/admin/database', icon: '🏢', badge: 'Active', isActive: pathname.startsWith('/admin/database') },
    { id: 'business', label: 'Business & Payouts', href: '/admin/business', icon: '💼', badge: 'Active', isActive: pathname.startsWith('/admin/business') || pathname.startsWith('/admin/incentives') },
    { id: 'assets', label: 'Assets Hub', href: '/admin/assets', icon: '📁', badge: 'Phase 3', isActive: pathname.startsWith('/admin/assets') },
    { id: 'logs', label: 'Audit Logs', href: '/admin/logs', icon: '📜', badge: 'Security', isActive: pathname.startsWith('/admin/logs') },
  ];

  const currentNav = navItems.find((n) => n.isActive);

  return (
    <>
      {loading && <AdminAccessScreen message="Verifying Admin Access..." />}
      <div hidden={loading}>
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
      </div>
    </>
  );
}

function AdminAccessScreen({ message }: { message: string }) {
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
        {message}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<AdminAccessScreen message="Loading Admin Workspace..." />}
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
