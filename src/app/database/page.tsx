'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DatabaseRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.replace('/login');
          return;
        }

        if (data.user.role === 'admin') {
          router.replace('/admin/database');
          return;
        }

        if (data.user.role === 'pre_sales') {
          router.replace('/presales?tab=database');
          return;
        }

        if (data.user.role === 'referral') {
          router.replace('/referral?tab=database');
          return;
        }

        router.replace('/');
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Redirecting to Places Database...
    </div>
  );
}
