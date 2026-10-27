'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

interface PricingData {
  template: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
  } | null;
  variables: Array<{
    id: string;
    key: string;
    label: string;
  }>;
  countries: string[];
  countryRates: Record<string, {
    id: string;
    country: string;
    data: Record<string, string>;
    updated_at: string;
  }>;
}

export default function PricingModal({ isOpen, onClose, isAdmin = false }: PricingModalProps) {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadPricing() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/pricing');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load pricing information');
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
          // Default to first available country if none selected
          if (json.countries && json.countries.length > 0 && !selectedCountry) {
            setSelectedCountry(json.countries[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error loading pricing data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPricing();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filter countries for dropdown search
  const filteredCountries = useMemo(() => {
    if (!data?.countries) return [];
    if (!countrySearch.trim()) return data.countries;
    const q = countrySearch.toLowerCase();
    return data.countries.filter((c) => c.toLowerCase().includes(q));
  }, [data?.countries, countrySearch]);

  // Current country data
  const currentRateData = useMemo(() => {
    if (!data?.countryRates || !selectedCountry) return null;
    return data.countryRates[selectedCountry]?.data || null;
  }, [data?.countryRates, selectedCountry]);

  // Interpolate template with selected country data
  const interpolatedContent = useMemo(() => {
    if (!data?.template?.content) return '';
    if (!currentRateData) return data.template.content;

    let result = data.template.content;

    // Replace each {{variable}} with value from country data
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    result = result.replace(regex, (match, key) => {
      const lowerKey = key.toLowerCase();
      if (currentRateData[lowerKey] !== undefined && currentRateData[lowerKey] !== null && currentRateData[lowerKey] !== '') {
        return currentRateData[lowerKey];
      }
      return match; // Keep unresolved variables intact
    });

    return result;
  }, [data?.template?.content, currentRateData]);

  // Copy rendered terms to clipboard
  const handleCopy = () => {
    if (!interpolatedContent) return;
    navigator.clipboard.writeText(interpolatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1322',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-lg, 14px)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 24px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
          animation: 'scaleUp 0.15s ease',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              🏷️
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Enterprise Commercial & Pricing Guide
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Standard rate guidelines and contractual baseline terms by country
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  border: '3px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              Loading pricing baseline...
            </div>
          ) : error ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ {error}
            </div>
          ) : (
            <div>
              {/* Country Selection Toolbar */}
              <div
                style={{
                  marginBottom: '20px',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Target Country:
                  </span>
                  {/* Searchable Select Popover */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid #818cf8',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: '180px',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>🌍 {selectedCountry || 'Select Country...'}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                        {isCountryDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {isCountryDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          zIndex: 1000,
                          width: '240px',
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.75)',
                          padding: '10px',
                          animation: 'fadeIn 0.15s ease',
                        }}
                      >
                        {/* Search Input */}
                        <input
                          type="text"
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            outline: 'none',
                            marginBottom: '8px',
                          }}
                        />

                        {/* Country List */}
                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {filteredCountries.length === 0 ? (
                            <div style={{ padding: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                              No countries found
                            </div>
                          ) : (
                            filteredCountries.map((c) => {
                              const isSelected = selectedCountry === c;
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountry(c);
                                    setIsCountryDropdownOpen(false);
                                    setCountrySearch('');
                                  }}
                                  style={{
                                    textAlign: 'left',
                                    padding: '7px 10px',
                                    borderRadius: '4px',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: isSelected ? 600 : 400,
                                    transition: 'background 0.12s',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {c}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Copy Terms Action */}
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: copied ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                    color: copied ? '#34d399' : 'var(--text-secondary)',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{copied ? '✓ Copied!' : '📋 Copy Terms'}</span>
                </button>
              </div>

              {/* Rendered Template View */}
              {currentRateData ? (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '22px 24px',
                    lineHeight: '1.7',
                    fontSize: '0.92rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                    }}
                  >
                    {interpolatedContent}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    No rate matrix details found for <strong>{selectedCountry}</strong>.
                  </p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem' }}>
                    Please contact an administrator to upload pricing details for this region.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            All quotes must adhere strictly to Directorate baseline policies.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && (
              <Link
                href="/admin/pricing"
                onClick={onClose}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#818cf8',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⚙️ Manage Pricing Engine →
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '6px 16px', fontSize: '0.85rem' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
