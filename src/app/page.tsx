'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.replace('/login');
          return;
        }
        switch (data.user.role) {
          case 'admin':
            router.replace('/admin/users');
            break;
          case 'pre_sales':
            router.replace('/presales');
            break;
          case 'referral':
            router.replace('/referral');
            break;
          case 'business_relations':
            router.replace('/business');
            break;
          default:
            router.replace('/login');
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <img
          src="/schoolites-logo.png"
          alt="Schoolites Logo"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            objectFit: 'cover',
            background: '#ffffff',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            marginBottom: '16px',
          }}
        />
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        Loading Schoolites ERP...
      </div>
    </div>
  );
}
