'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface ActorDeal {
  lead_id: string;
  lead_code: string;
  institute_name: string;
  institute_type: string;
  city: string;
  country: string;
  contract_value: number;
  duration_months: number;
  start_date: string | null;
  end_date: string | null;
  contract_status: string;
  cleared_cash: number;
  pending_invoice_cash?: number;
  unbilled_cash?: number;
  pending_cash: number;
  invoice_count: number;
  actor_role: 'promoter' | 'owner' | 'manager' | null;
  actor_rate: number;
  actor_paid_reward: number;
  actor_pending_invoice_reward?: number;
  actor_unbilled_reward?: number;
  actor_pending_reward: number;
  actor_total_reward: number;
}

interface ActorSummary {
  totalClients: number;
  totalContractValue: number;
  totalClearedCash: number;
  totalPendingInvoiceCash?: number;
  totalUnbilledCash?: number;
  totalPendingCash: number;
  myRewardsPaid: number;
  myRewardsPendingInvoice?: number;
  myRewardsUnbilled?: number;
  myRewardsPending: number;
  myRewardsTotal: number;
}

interface ActorBusinessLedgerProps {
  roleTitle?: string;
  roleColor?: string;
}

export default function ActorBusinessLedger({
  roleTitle = 'Your Business & Rewards',
  roleColor = 'var(--role-business-color)',
}: ActorBusinessLedgerProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ActorSummary | null>(null);
  const [deals, setDeals] = useState<ActorDeal[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'cleared' | 'pending'>('all');

  const fetchBusinessData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/business?view=personal');
      if (!res.ok) throw new Error('Failed to load business data');
      const data = await res.json();
      setSummary(data.summary || null);
      setDeals(data.deals || []);
    } catch (err) {
      console.error('Failed to fetch business data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        d.lead_code.toLowerCase().includes(q) ||
        d.institute_name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'cleared') {
        return d.actor_paid_reward > 0 && d.actor_pending_reward === 0;
      }
      if (statusFilter === 'pending') {
        return d.actor_pending_reward > 0;
      }

      return true;
    });
  }, [deals, search, statusFilter]);

  const roleNameMap: Record<string, string> = {
    promoter: 'Affiliate Promoter',
    owner: 'Lead Originator',
    manager: 'Lead Manager (Closer)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>💼</span> {roleTitle}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '2px' }}>
            Real-time ledger of your closed paying institutions, client contract values, and earned commission payouts.
          </p>
        </div>

        <button
          onClick={fetchBusinessData}
          className="btn-secondary"
          style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>🔄</span> Refresh Rewards
        </button>
      </div>

      {/* KPI Cards Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. Paying Clients */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: `4px solid ${roleColor}` }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            My Paying Clients
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#ffffff' }}>
            {summary?.totalClients || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Active closed contracts
          </div>
        </div>

        {/* 2. Total Business Generated */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
            Total Client Value
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#ffffff' }}>
            ₹{(summary?.totalContractValue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Paid: ₹{(summary?.totalClearedCash || 0).toLocaleString('en-IN')} • Pend: ₹{(summary?.totalPendingCash || 0).toLocaleString('en-IN')}
          </div>
        </div>

        {/* 3. Cleared Commission (Earned) */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
            Cleared Commission (Earned)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#34d399' }}>
            ₹{(summary?.myRewardsPaid || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            ✓ Verified bank cash • Ready for payout
          </div>
        </div>

        {/* 4. Pending Commission */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
            Pending Commission
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#fbbf24' }}>
            ₹{(summary?.myRewardsPending || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {(summary?.myRewardsPendingInvoice || 0) > 0 ? (
              <span>₹{(summary?.myRewardsPendingInvoice || 0).toLocaleString('en-IN')} invoice due • </span>
            ) : null}
            <span>₹{(summary?.myRewardsUnbilled || 0).toLocaleString('en-IN')} unbilled</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            placeholder="🔍 Search my client institutions or lead codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ maxWidth: '380px', fontSize: '0.86rem' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'cleared', 'pending'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              style={{
                padding: '5px 12px',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === filterKey ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)',
                background: statusFilter === filterKey ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === filterKey ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {filterKey === 'all' && `All Clients (${deals.length})`}
              {filterKey === 'cleared' && '✓ Cleared Rewards'}
              {filterKey === 'pending' && '⏳ Pending Rewards'}
            </button>
          ))}
        </div>
      </div>

      {/* Client Accounts & Rewards Ledger Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Client Institution
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Your Role
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Commission Rate
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Client Contract Value
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Cash Collections
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Your Earned Reward
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Payout Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '44px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading Your Client Business Ledger...
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '44px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No client business records found.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => {
                  const isEligibleForPayout = deal.actor_paid_reward > 0;
                  const isFullyCleared = deal.actor_pending_reward === 0 && deal.actor_paid_reward > 0;

                  return (
                    <tr
                      key={deal.lead_id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                    >
                      {/* 1. Client Institution */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.92rem' }}>
                          {deal.institute_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span className="user-code-pill" style={{ color: '#818cf8', fontSize: '0.72rem' }}>
                            {deal.lead_code}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            • {deal.city}, {deal.country}
                          </span>
                        </div>
                      </td>

                      {/* 2. Your Role */}
                      <td style={{ padding: '16px 18px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#ffffff',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {deal.actor_role ? roleNameMap[deal.actor_role] : 'Contributor'}
                        </span>
                      </td>

                      {/* 3. Commission Rate */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#818cf8' }}>
                          {deal.actor_rate}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Snapshotted
                        </div>
                      </td>

                      {/* 4. Client Contract Value */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>
                          ₹{deal.contract_value.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Term: {deal.duration_months} Mos
                        </div>
                      </td>

                      {/* 5. Cash Collections */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: deal.cleared_cash > 0 ? '#34d399' : 'var(--text-muted)' }}>
                          ₹{deal.cleared_cash.toLocaleString('en-IN')}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 400 }}>
                            cleared
                          </span>
                        </div>
                        {(deal.pending_invoice_cash || 0) > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                            ₹{(deal.pending_invoice_cash || 0).toLocaleString('en-IN')} invoice due
                          </div>
                        )}
                        {(deal.unbilled_cash || 0) > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                            ₹{(deal.unbilled_cash || 0).toLocaleString('en-IN')} unbilled
                          </div>
                        )}
                      </td>

                      {/* 6. Your Earned Reward */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#34d399' }}>
                          ₹{deal.actor_paid_reward.toLocaleString('en-IN')}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 400 }}>
                            cleared
                          </span>
                        </div>
                        {(deal.actor_pending_invoice_reward || 0) > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                            Due: ₹{(deal.actor_pending_invoice_reward || 0).toLocaleString('en-IN')}
                          </div>
                        )}
                        {(deal.actor_unbilled_reward || 0) > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            Unbilled: ₹{(deal.actor_unbilled_reward || 0).toLocaleString('en-IN')}
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Total: ₹{deal.actor_total_reward.toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* 7. Payout Status */}
                      <td style={{ padding: '16px 18px' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            background: isFullyCleared
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isEligibleForPayout
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                            color: isFullyCleared ? '#34d399' : isEligibleForPayout ? '#38bdf8' : '#fbbf24',
                            border: '1px solid var(--border-subtle)',
                            display: 'inline-flex',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isFullyCleared
                            ? '✓ Fully Cleared'
                            : isEligibleForPayout
                            ? '⚡ Eligible for Payout'
                            : '⏳ Awaiting Client Payment'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
