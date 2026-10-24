'use client';

import { useEffect, useRef } from 'react';

/**
 * Lightweight, zero-cost pipeline synchronization:
 * 1. Window Focus Refetch: Instantly fetches fresh leads when the user returns to the window or browser tab.
 * 2. Visibility Change: Immediately refreshes when a background tab becomes visible.
 * 3. Active-Tab Polling: Gently refreshes every 30 seconds ONLY when the tab is actively in view.
 * 
 * Cost & Efficiency Benefits:
 * - Zero external libraries or WebSocket connections.
 * - 100% preserves Neon Postgres "Scale-to-Zero" ($0 idle database cost when away).
 * - Zero battery or CPU drain when minimized or in background.
 */
export function usePipelineAutoSync(onRefresh: () => void, intervalMs = 30000) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Refresh on tab focus
    const handleFocus = () => {
      refreshRef.current?.();
    };

    // 2. Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRef.current?.();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Low-frequency polling only when visible
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshRef.current?.();
      }
    }, intervalMs);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(timer);
    };
  }, [intervalMs]);
}
