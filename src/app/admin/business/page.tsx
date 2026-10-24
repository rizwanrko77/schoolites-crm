'use client';

import React, { useState, useEffect, useMemo } from 'react';
import LeadDetailModal from '@/components/LeadDetailModal';

interface SplitInfo {
  id: string | null;
  name: string | null;
  code: string | null;
  role?: string;
  rate: number;
  isWaivedCloserDuplicate?: boolean;
  paid: number;
  pending_invoice?: number;
  unbilled?: number;
  pending: number;
  total: number;
}

interface DealItem {
  lead_id: string;
  lead_code: string;
  institute_name: string;
  institute_type: string;
  city: string;
  country: string;
  contract_id: string | null;
  contract_value: number;
  duration_months: number;
  start_date: string | null;
  end_date: string | null;
  contract_status: string;
  cleared_cash: number;
  pending_invoice_cash: number;
  unbilled_cash: number;
  pending_cash: number;
  invoice_count: number;
  promoter: SplitInfo;
  owner: SplitInfo;
  manager: SplitInfo;
  total_rewards_paid: number;
  total_rewards_pending_invoice: number;
  total_rewards_unbilled: number;
  total_rewards_pending: number;
  total_rewards: number;
}

interface BusinessSummary {
  totalDeals: number;
  totalContractValue: number;
  totalClearedCash: number;
  totalPendingInvoiceCash?: number;
  totalUnbilledCash?: number;
  totalPendingCash: number;
  totalRewardsPaid: number;
  totalRewardsPendingInvoice?: number;
  totalRewardsUnbilled?: number;
  totalRewardsPending: number;
  netRealizedRevenue: number;
}

export default function AdminBusinessPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'cleared' | 'partial' | 'pending'>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchBusinessData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to load business data');
      const data = await res.json();
      setSummary(data.summary || null);
      setDeals(data.deals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
    fetchBusinessData();
  }, []);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      // Search check
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        d.lead_code.toLowerCase().includes(q) ||
        d.institute_name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        (d.promoter.name && d.promoter.name.toLowerCase().includes(q)) ||
        (d.promoter.code && d.promoter.code.toLowerCase().includes(q)) ||
        (d.owner.name && d.owner.name.toLowerCase().includes(q)) ||
        (d.owner.code && d.owner.code.toLowerCase().includes(q)) ||
        (d.manager.name && d.manager.name.toLowerCase().includes(q)) ||
        (d.manager.code && d.manager.code.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Status filter
      if (statusFilter === 'cleared') {
        return (d.pending_invoice_cash || 0) === 0 && (d.unbilled_cash || 0) === 0 && d.contract_value > 0;
      }
      if (statusFilter === 'partial') {
        return d.cleared_cash > 0 && ((d.pending_invoice_cash || 0) > 0 || (d.unbilled_cash || 0) > 0);
      }
      if (statusFilter === 'pending') {
        return d.cleared_cash === 0;
      }

      return true;
    });
  }, [deals, search, statusFilter]);

  const handleOpenLead = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  return (
    <div className="workspace-container">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>💼</span> Whole Pipeline Business & Splits
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Organization-wide revenue realization, signed paying client contracts, cash collections, and actor incentive splits.
          </p>
        </div>

        <button
          onClick={fetchBusinessData}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>🔄</span> Refresh Business
        </button>
      </div>

      {/* KPI Overview Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Card 1: Total Signed Business */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Agreed Business
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            ₹{(summary?.totalContractValue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across <strong>{summary?.totalDeals || 0}</strong> paying client accounts
          </div>
        </div>

        {/* Card 2: Cash Collected */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
            Cleared Cash Received
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#34d399' }}>
            ₹{(summary?.totalClearedCash || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Verified bank receipts from client invoices
          </div>
        </div>

        {/* Card 3: Pending Receivables */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
            Pending Client Invoices
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>
            ₹{(summary?.totalPendingInvoiceCash || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {(summary?.totalUnbilledCash || 0) > 0 ? (
              <span>₹{(summary?.totalUnbilledCash || 0).toLocaleString('en-IN')} unbilled contract milestones</span>
            ) : (
              <span>All contract milestones invoiced</span>
            )}
          </div>
        </div>

        {/* Card 4: Actor Commissions */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #ec4899' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ec4899', textTransform: 'uppercase' }}>
            Actor Commissions (Earned / Total)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#f472b6' }}>
            ₹{(summary?.totalRewardsPaid || 0).toLocaleString('en-IN')}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>
              {' '}/ ₹{((summary?.totalRewardsPaid || 0) + (summary?.totalRewardsPending || 0)).toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {(summary?.totalRewardsPendingInvoice || 0) > 0 ? (
              <span>₹{(summary?.totalRewardsPendingInvoice || 0).toLocaleString('en-IN')} invoice due • </span>
            ) : null}
            <span>₹{(summary?.totalRewardsUnbilled || 0).toLocaleString('en-IN')} unbilled potential</span>
          </div>
        </div>

        {/* Card 5: Net Realized Revenue */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            Net Realized Company Revenue
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#7dd3fc' }}>
            ₹{(summary?.netRealizedRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Cleared Cash minus cleared partner payouts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            placeholder="🔍 Search by lead code, school, city, or actor name/code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ maxWidth: '440px', fontSize: '0.88rem' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['all', 'cleared', 'partial', 'pending'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === filterKey ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)',
                background: statusFilter === filterKey ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === filterKey ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {filterKey === 'all' && `All Deals (${deals.length})`}
              {filterKey === 'cleared' && '✓ Fully Cleared'}
              {filterKey === 'partial' && '⚡ Partially Cleared'}
              {filterKey === 'pending' && '⏳ Payment Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table: Paying Clients & Split Breakdown */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Lead & Client
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Contract Value
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Cash Realized
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Promoter (PM)
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Lead Owner (Creator)
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Manager (Closer)
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  Total Payouts
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'center' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading Whole Pipeline Business Ledger...
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No paying client deals found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => {
                  const isFullyCleared = (deal.pending_invoice_cash || 0) === 0 && (deal.unbilled_cash || 0) === 0 && deal.contract_value > 0;
                  const hasPendingInvoice = (deal.pending_invoice_cash || 0) > 0;
                  const hasUnbilledScope = (deal.unbilled_cash || 0) > 0;

                  return (
                    <tr
                      key={deal.lead_id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                    >
                      {/* 1. Lead & Client */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.94rem' }}>
                          {deal.institute_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <span className="user-code-pill" style={{ color: '#818cf8', fontSize: '0.72rem' }}>
                            {deal.lead_code}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            • {deal.city}, {deal.country}
                          </span>
                        </div>
                        {deal.duration_months && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Term: {deal.duration_months} Months
                          </div>
                        )}
                      </td>

                      {/* 2. Contract Value */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff' }}>
                          ₹{deal.contract_value.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {deal.invoice_count} milestone invoice{deal.invoice_count === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* 3. Cash Realized (Paid vs Pending) */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: deal.cleared_cash > 0 ? '#34d399' : 'var(--text-muted)' }}>
                          ₹{deal.cleared_cash.toLocaleString('en-IN')}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 400 }}>
                            collected
                          </span>
                        </div>
                        {deal.pending_invoice_cash > 0 ? (
                          <div style={{ fontSize: '0.76rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                            ₹{deal.pending_invoice_cash.toLocaleString('en-IN')} invoice due
                          </div>
                        ) : null}
                        {deal.unbilled_cash > 0 ? (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                            ₹{deal.unbilled_cash.toLocaleString('en-IN')} unbilled
                          </div>
                        ) : null}
                        {deal.pending_invoice_cash === 0 && deal.unbilled_cash === 0 && deal.contract_value > 0 ? (
                          <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '2px' }}>
                            ✓ 100% Cleared
                          </div>
                        ) : null}
                      </td>

                      {/* 4. Promoter Share */}
                      <td style={{ padding: '16px 18px' }}>
                        {deal.promoter.name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>
                              {deal.promoter.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="user-code-pill" style={{ color: '#f43f5e', fontSize: '0.7rem' }}>
                                {deal.promoter.code}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ({deal.promoter.rate}%)
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                              <span style={{ color: '#34d399', fontWeight: 600 }}>₹{deal.promoter.paid.toLocaleString('en-IN')}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> / ₹{deal.promoter.total.toLocaleString('en-IN')}</span>
                            </div>
                            {(deal.promoter.unbilled || 0) > 0 && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                (₹{(deal.promoter.unbilled || 0).toLocaleString('en-IN')} unbilled)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct / None</span>
                        )}
                      </td>

                      {/* 5. Lead Owner Share */}
                      <td style={{ padding: '16px 18px' }}>
                        {deal.owner.name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>
                              {deal.owner.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="user-code-pill" style={{ color: '#38bdf8', fontSize: '0.7rem' }}>
                                {deal.owner.code}
                              </span>
                              {deal.owner.isWaivedCloserDuplicate ? (
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                                  0% (Closer Priority)
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  ({deal.owner.rate}%)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                              <span style={{ color: '#34d399', fontWeight: 600 }}>₹{deal.owner.paid.toLocaleString('en-IN')}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> / ₹{deal.owner.total.toLocaleString('en-IN')}</span>
                            </div>
                            {(deal.owner.unbilled || 0) > 0 && !deal.owner.isWaivedCloserDuplicate && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                (₹{(deal.owner.unbilled || 0).toLocaleString('en-IN')} unbilled)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>

                      {/* 6. Lead Manager Share (Closer) */}
                      <td style={{ padding: '16px 18px' }}>
                        {deal.manager.name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>
                              {deal.manager.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="user-code-pill" style={{ color: 'var(--role-business-color)', fontSize: '0.7rem' }}>
                                {deal.manager.code}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ({deal.manager.rate}%)
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                              <span style={{ color: '#34d399', fontWeight: 600 }}>₹{deal.manager.paid.toLocaleString('en-IN')}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> / ₹{deal.manager.total.toLocaleString('en-IN')}</span>
                            </div>
                            {(deal.manager.unbilled || 0) > 0 && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                (₹{(deal.manager.unbilled || 0).toLocaleString('en-IN')} unbilled)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unassigned</span>
                        )}
                      </td>

                      {/* 7. Total Payouts & Deal Status */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#f472b6' }}>
                          ₹{deal.total_rewards_paid.toLocaleString('en-IN')}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 400 }}>
                            earned
                          </span>
                        </div>
                        {deal.total_rewards_pending_invoice > 0 ? (
                          <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                            Due: ₹{deal.total_rewards_pending_invoice.toLocaleString('en-IN')}
                          </div>
                        ) : null}
                        {deal.total_rewards_unbilled > 0 ? (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Unbilled: ₹{deal.total_rewards_unbilled.toLocaleString('en-IN')}
                          </div>
                        ) : null}
                        <div style={{ marginTop: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              background: isFullyCleared
                                ? 'rgba(16, 185, 129, 0.15)'
                                : hasPendingInvoice
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(56, 189, 248, 0.15)',
                              color: isFullyCleared ? '#34d399' : hasPendingInvoice ? '#fbbf24' : '#38bdf8',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {isFullyCleared ? '✓ Cleared' : hasPendingInvoice ? '⚡ Invoice Due' : '⚡ In Progress'}
                          </span>
                        </div>
                      </td>

                      {/* 8. Action */}
                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleOpenLead(deal.lead_id)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          📄 Contract & Invoices
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Modal for Contract / Invoice Management */}
      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          onClose={() => {
            setSelectedLeadId(null);
            fetchBusinessData();
          }}
          currentUser={currentUser}
          onLeadUpdated={fetchBusinessData}
        />
      )}
    </div>
  );
}
