'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAdminReady } from '../admin-session';

interface PricingVariable {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface PricingTemplate {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

interface CountryRateRow {
  country: string;
  data: Record<string, string>;
  isNew?: boolean;
}

export default function AdminPricingPage() {
  const adminReady = useAdminReady();

  // Tab State: 'variables' | 'template' | 'matrix'
  const [activeTab, setActiveTab] = useState<'variables' | 'template' | 'matrix'>('matrix');

  // Core Data
  const [variables, setVariables] = useState<PricingVariable[]>([]);
  const [template, setTemplate] = useState<PricingTemplate | null>(null);
  const [tableRows, setTableRows] = useState<CountryRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tab 1: Variables Form
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [isSubmittingVar, setIsSubmittingVar] = useState(false);

  // Tab 2: Template Editor Form
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [previewCountry, setPreviewCountry] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Tab 3: Spreadsheet Matrix Editor
  const [matrixSearch, setMatrixSearch] = useState('');
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<{ index: number; country: string } | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteMode, setPasteMode] = useState<'append' | 'replace'>('append');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Fetch Pricing Data
  const fetchPricingData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load pricing engine data');
      }
      const json = await res.json();
      setVariables(json.variables || []);

      // Format table rows
      const rows: CountryRateRow[] = (json.rates || []).map((r: any) => ({
        country: r.country,
        data: r.data || {},
      }));
      setTableRows(rows);
      setHasUnsavedChanges(false);

      if (json.template) {
        setTemplate(json.template);
        setTemplateTitle(json.template.title || 'Standard Pricing Template');
        setTemplateContent(json.template.content || '');
      }

      if (rows.length > 0 && !previewCountry) {
        setPreviewCountry(rows[0].country);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminReady) return;
    fetchPricingData();
  }, [adminReady]);

  // Ordered variable keys for table columns: country is always column 0
  const columnVariables = useMemo(() => {
    return variables.filter((v) => v.key !== 'country');
  }, [variables]);

  // =========================================================================
  // TAB 1: VARIABLE HANDLERS
  // =========================================================================
  const handleAddVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarKey.trim() || !newVarLabel.trim()) return;

    try {
      setIsSubmittingVar(true);
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_variable',
          key: newVarKey,
          label: newVarLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add variable');

      setNewVarKey('');
      setNewVarLabel('');
      showToast(`Variable {{${data.variable.key}}} created! Appended as table column.`);
      fetchPricingData();
    } catch (err: any) {
      alert(err.message || 'Error creating variable');
    } finally {
      setIsSubmittingVar(false);
    }
  };

  // Delete Column / Variable Confirmation Modal State
  const [variableToDelete, setVariableToDelete] = useState<{ key: string; label: string } | null>(null);
  const [isDeletingVariable, setIsDeletingVariable] = useState(false);

  const handleConfirmDeleteVariable = async () => {
    if (!variableToDelete) return;
    const { key, label } = variableToDelete;

    if (key === 'country') {
      alert('The "country" variable is the primary lookup key and cannot be removed.');
      setVariableToDelete(null);
      return;
    }

    try {
      setIsDeletingVariable(true);
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_variable', key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete variable');

      showToast(`Column "${label}" ({{${key}}}) successfully removed.`);
      setVariableToDelete(null);
      fetchPricingData();
    } catch (err: any) {
      alert(err.message || 'Error deleting variable');
    } finally {
      setIsDeletingVariable(false);
    }
  };

  // =========================================================================
  // TAB 2: TEMPLATE HANDLERS
  // =========================================================================
  const handleSaveTemplate = async () => {
    if (!templateContent.trim()) {
      alert('Template content cannot be empty.');
      return;
    }

    try {
      setIsSavingTemplate(true);
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_template',
          title: templateTitle,
          content: templateContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      setTemplate(data.template);
      showToast('Pricing template saved & deployed live to actors!');
    } catch (err: any) {
      alert(err.message || 'Error saving template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const insertVariableAtCursor = (varKey: string) => {
    const token = `{{${varKey}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setTemplateContent((prev) => prev + ' ' + token);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateContent;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setTemplateContent(before + token + after);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  const previewInterpolated = useMemo(() => {
    if (!templateContent) return '';
    const selectedRate = tableRows.find((r) => r.country === previewCountry);
    const dataMap = selectedRate?.data || {};

    let text = templateContent;
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    text = text.replace(regex, (match, key) => {
      const lower = key.toLowerCase();
      if (lower === 'country' && selectedRate?.country) {
        return selectedRate.country;
      }
      if (dataMap[lower] !== undefined && dataMap[lower] !== null && dataMap[lower] !== '') {
        return dataMap[lower];
      }
      return match;
    });
    return text;
  }, [templateContent, previewCountry, tableRows]);

  // =========================================================================
  // TAB 3: DIRECT SPREADSHEET TABLE EDITING & COPY-PASTE
  // =========================================================================

  // Update a single cell value directly in table state
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    setTableRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[rowIndex] };

      if (colKey === 'country') {
        target.country = value;
      } else {
        target.data = { ...target.data, [colKey]: value };
      }

      updated[rowIndex] = target;
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Add a clean new row directly to table (unlocks edit mode)
  const handleAddNewRow = () => {
    const newRow: CountryRateRow = {
      country: '',
      data: {},
      isNew: true,
    };
    setTableRows((prev) => [newRow, ...prev]);
    setIsEditingMatrix(true);
    setHasUnsavedChanges(true);
  };

  // Delete a row directly from table with confirmation
  const handleConfirmDeleteRow = () => {
    if (!rowToDelete) return;
    const { index, country } = rowToDelete;
    setTableRows((prev) => prev.filter((_, idx) => idx !== index));
    setHasUnsavedChanges(true);
    setRowToDelete(null);
    showToast(`Removed row for "${country}". Click "Save All Changes" to persist.`);
  };

  // Cancel edit mode and reset unsaved changes
  const handleCancelEditMatrix = () => {
    if (hasUnsavedChanges) {
      if (confirm('Discard all unsaved changes and exit edit mode?')) {
        fetchPricingData();
        setIsEditingMatrix(false);
      }
    } else {
      setIsEditingMatrix(false);
    }
  };

  // Direct In-Cell Paste (Intercepts Excel / Sheets Ctrl+V tab-separated data)
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIndex: number,
    startColKey: string
  ) => {
    const clipboardText = e.clipboardData.getData('text');
    if (!clipboardText) return;

    // Check if pasted content is multi-cell (contains tabs \t or newlines \n)
    if (clipboardText.includes('\t') || clipboardText.includes('\n')) {
      e.preventDefault(); // Intercept default input paste

      const allColKeys = ['country', ...columnVariables.map((v) => v.key)];
      const startColIndex = allColKeys.indexOf(startColKey);
      if (startColIndex === -1) return;

      // Helper to detect and filter out table headers or template variable tokens
      const isHeaderLine = (lineStr: string) => {
        const firstCell = (lineStr.split('\t')[0] || '').trim().toLowerCase();
        return (
          firstCell === 'country' ||
          firstCell === 'country *' ||
          firstCell.startsWith('country') ||
          firstCell.includes('{{') ||
          lineStr.includes('{{')
        );
      };

      const lines = clipboardText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => Boolean(l) && !isHeaderLine(l));

      if (lines.length === 0) {
        showToast('Header row detected and skipped. Please copy data rows.');
        return;
      }

      setTableRows((prev) => {
        const nextRows = [...prev];

        lines.forEach((line, lineOffset) => {
          const targetRowIndex = startRowIndex + lineOffset;
          const cellValues = line.split('\t');

          // If row doesn't exist yet, create a new one
          if (!nextRows[targetRowIndex]) {
            nextRows[targetRowIndex] = { country: '', data: {}, isNew: true };
          } else {
            nextRows[targetRowIndex] = {
              ...nextRows[targetRowIndex],
              data: { ...nextRows[targetRowIndex].data },
            };
          }

          cellValues.forEach((val, valOffset) => {
            const targetColIndex = startColIndex + valOffset;
            const targetCol = allColKeys[targetColIndex];
            if (!targetCol) return;

            const cleanVal = val.trim();
            if (targetCol === 'country') {
              nextRows[targetRowIndex].country = cleanVal;
            } else {
              nextRows[targetRowIndex].data[targetCol] = cleanVal;
            }
          });
        });

        return nextRows;
      });

      setHasUnsavedChanges(true);
      showToast(`Pasted ${lines.length} data row(s) (headers auto-filtered)!`);
    }
  };

  // Modal-based Spreadsheet Paste Parser
  const parsedPasteRows = useMemo(() => {
    if (!pasteRawText.trim()) return [];
    const allColKeys = ['country', ...columnVariables.map((v) => v.key)];

    const isHeaderLine = (lineStr: string) => {
      const delimiter = lineStr.includes('\t') ? '\t' : ',';
      const firstCell = (lineStr.split(delimiter)[0] || '').replace(/^["']|["']$/g, '').trim().toLowerCase();
      return (
        firstCell === 'country' ||
        firstCell === 'country *' ||
        firstCell.startsWith('country') ||
        firstCell.includes('{{') ||
        lineStr.includes('{{')
      );
    };

    const lines = pasteRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !isHeaderLine(l));

    const result: Array<{ country: string; data: Record<string, string> }> = [];

    lines.forEach((line) => {
      // Split by tab (Excel/Sheets) or comma (CSV)
      const delimiter = line.includes('\t') ? '\t' : ',';
      const cells = line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());

      const country = cells[0] || '';
      if (!country) return;

      const dataObj: Record<string, string> = {};
      columnVariables.forEach((v, idx) => {
        dataObj[v.key] = cells[idx + 1] || '';
      });

      result.push({ country, data: dataObj });
    });

    return result;
  }, [pasteRawText, columnVariables]);

  // Apply Modal Paste to Table
  const handleApplyModalPaste = () => {
    if (parsedPasteRows.length === 0) {
      alert('No valid rows found in paste content. Make sure country is in column 1.');
      return;
    }

    if (pasteMode === 'replace') {
      setTableRows(parsedPasteRows);
    } else {
      // Append: update existing countries or push new ones
      setTableRows((prev) => {
        const map = new Map<string, CountryRateRow>();
        prev.forEach((r) => map.set(r.country.toLowerCase(), r));

        parsedPasteRows.forEach((p) => {
          const key = p.country.toLowerCase();
          if (map.has(key)) {
            const existing = map.get(key)!;
            map.set(key, { country: p.country, data: { ...existing.data, ...p.data } });
          } else {
            map.set(key, { country: p.country, data: p.data, isNew: true });
          }
        });

        return Array.from(map.values());
      });
    }

    setHasUnsavedChanges(true);
    setIsEditingMatrix(true);
    setIsPasteModalOpen(false);
    setPasteRawText('');
    showToast(`Applied ${parsedPasteRows.length} rows to table! Click "Save All Changes" to persist.`);
  };

  // Save All Changes to Database
  const handleSaveAllChanges = async () => {
    // Validate that every row has a country name
    const validRows = tableRows.filter((r) => r.country.trim());
    if (validRows.length === 0 && tableRows.length > 0) {
      alert('Every row must have a country name filled.');
      return;
    }

    try {
      setIsSavingMatrix(true);
      const payloadRows = validRows.map((r) => ({
        country: r.country.trim(),
        ...r.data,
      }));

      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_matrix',
          rows: payloadRows,
          syncAll: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save matrix changes');

      setHasUnsavedChanges(false);
      setIsEditingMatrix(false);
      showToast(`Saved! ${data.summary.totalRows} countries live in the database.`);
      fetchPricingData();
    } catch (err: any) {
      alert(err.message || 'Error saving matrix');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Export Matrix as Backup CSV
  const handleExportCSV = () => {
    const allHeaders = ['country', ...columnVariables.map((v) => v.key)];
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

    const lines: string[] = [];
    lines.push(allHeaders.map(escapeCsv).join(','));

    tableRows.forEach((r) => {
      const vals = allHeaders.map((k) => (k === 'country' ? escapeCsv(r.country) : escapeCsv(r.data[k] || '')));
      lines.push(vals.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pricing_matrix_backup_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered rows for search bar
  const displayedRows = useMemo(() => {
    if (!matrixSearch.trim()) return tableRows;
    const q = matrixSearch.toLowerCase();
    return tableRows.filter((r) => r.country.toLowerCase().includes(q));
  }, [tableRows, matrixSearch]);

  return (
    <div className="workspace-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Pricing Management Engine
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Enterprise
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
            Direct in-table editing with spreadsheet copy-paste support, dynamic variables, and live contract templates
          </p>
          {errorMsg && <p style={{ color: '#fca5a5', fontSize: '0.88rem', marginTop: '6px' }}>⚠️ {errorMsg}</p>}
        </div>

        <Link
          href="/admin/users"
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.86rem', textDecoration: 'none' }}
        >
          ← Back to Users
        </Link>
      </div>

      {/* 3 Main Management Tabs */}
      <div
        className="glass-panel"
        style={{
          padding: '6px',
          display: 'inline-flex',
          gap: '6px',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '9px 18px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            border: activeTab === 'matrix' ? '1px solid #818cf8' : '1px solid transparent',
            background: activeTab === 'matrix' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: activeTab === 'matrix' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          📊 1. Rate Matrix Table ({tableRows.length} Countries)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('variables')}
          style={{
            padding: '9px 18px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            border: activeTab === 'variables' ? '1px solid #818cf8' : '1px solid transparent',
            background: activeTab === 'variables' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: activeTab === 'variables' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          ⚙️ 2. Create Variables ({variables.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('template')}
          style={{
            padding: '9px 18px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            border: activeTab === 'template' ? '1px solid #818cf8' : '1px solid transparent',
            background: activeTab === 'template' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: activeTab === 'template' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          📝 3. Rate Template & Preview
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DIRECT EDITABLE MATRIX TABLE WITH COPY-PASTE */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Toolbar */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {isEditingMatrix ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddNewRow}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>+</span>
                    <span>Add Country Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(true)}
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid #818cf8',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md, 6px)',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📋</span>
                    <span>Paste from Excel / Sheets</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingMatrix(true)}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: '1px solid #818cf8',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md, 6px)',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 0 16px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  <span>✏️</span>
                  <span>Edit Table</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCSV}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>⬇️</span>
                <span>Export Backup (CSV)</span>
              </button>

              <div style={{ width: '220px' }}>
                <input
                  type="text"
                  placeholder="Search country..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  className="input-field"
                  style={{ padding: '7px 12px', fontSize: '0.82rem', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isEditingMatrix ? (
                <>
                  {/* Unsaved indicator */}
                  {hasUnsavedChanges ? (
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: '#fbbf24',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                      Unsaved Changes
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
                      Edit Mode Active
                    </span>
                  )}

                  {/* Cancel / Discard Edit Mode */}
                  <button
                    type="button"
                    onClick={handleCancelEditMatrix}
                    className="btn-secondary"
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.84rem',
                      color: hasUnsavedChanges ? '#f87171' : 'var(--text-secondary)',
                      borderColor: hasUnsavedChanges ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {hasUnsavedChanges ? '↺ Discard & Exit' : 'Exit Edit Mode'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAllChanges}
                    disabled={isSavingMatrix || !hasUnsavedChanges}
                    style={{
                      background: hasUnsavedChanges
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: hasUnsavedChanges ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      color: hasUnsavedChanges ? '#ffffff' : 'var(--text-muted)',
                      padding: '9px 20px',
                      borderRadius: 'var(--radius-md, 6px)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: hasUnsavedChanges ? 'pointer' : 'default',
                      boxShadow: hasUnsavedChanges ? '0 0 16px rgba(16, 185, 129, 0.35)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSavingMatrix ? 'Saving...' : '💾 Save All Changes'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                  <span>{tableRows.length} Countries Live (Read Only)</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tip on Copy-Paste (only visible in edit mode) */}
          {isEditingMatrix && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                fontSize: '0.8rem',
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>
                💡 <strong>Edit Mode Active:</strong> You can edit cells directly or press <code>Ctrl + V</code> in any cell to paste rows from Excel / Google Sheets. <em>(Headers like &apos;Country *&apos; or variable tokens are automatically filtered out!)</em>
              </span>
            </div>
          )}

          {/* Direct Spreadsheet Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff', fontSize: '0.76rem', textTransform: 'uppercase', minWidth: '170px' }}>
                      Country *
                    </th>
                    {columnVariables.map((v) => (
                      <th
                        key={v.id}
                        style={{
                          padding: '10px 14px',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          fontSize: '0.74rem',
                          textTransform: 'uppercase',
                          minWidth: '155px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div>{v.label}</div>
                            <div style={{ fontSize: '0.68rem', color: '#818cf8', fontFamily: 'monospace', textTransform: 'none', fontWeight: 500 }}>
                              {`{{${v.key}}}`}
                            </div>
                          </div>
                          {isEditingMatrix && (
                            <button
                              type="button"
                              onClick={() => setVariableToDelete({ key: v.key, label: v.label })}
                              title={`Delete Column "${v.label}"`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                opacity: 0.45,
                                lineHeight: 1,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted)';
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.opacity = '0.45';
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    {isEditingMatrix && (
                      <th style={{ padding: '12px 16px', textAlign: 'center', width: '50px' }}>
                        🗑️
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columnVariables.length + (isEditingMatrix ? 2 : 1)} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {isEditingMatrix
                          ? 'No countries in matrix. Click "+ Add Country Row" or paste from a spreadsheet to start!'
                          : 'No countries in matrix. Click "✏️ Edit Table" to add or configure rates.'}
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, rIdx) => {
                      const actualIndex = tableRows.indexOf(row);
                      return (
                        <tr
                          key={rIdx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: row.isNew ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          }}
                        >
                          {/* Country Cell (Column 0) */}
                          <td style={{ padding: isEditingMatrix ? '6px 10px' : '12px 16px' }}>
                            {isEditingMatrix ? (
                              <input
                                type="text"
                                value={row.country}
                                onChange={(e) => handleCellChange(actualIndex, 'country', e.target.value)}
                                onPaste={(e) => handleCellPaste(e, actualIndex, 'country')}
                                placeholder="e.g. Canada"
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '4px',
                                  color: '#ffffff',
                                  fontSize: '0.86rem',
                                  fontWeight: 600,
                                  outline: 'none',
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = '#818cf8';
                                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 600, color: '#ffffff' }}>
                                {row.country || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </span>
                            )}
                          </td>

                          {/* Dynamic Variable Cells */}
                          {columnVariables.map((v) => (
                            <td key={v.id} style={{ padding: isEditingMatrix ? '6px 10px' : '12px 16px' }}>
                              {isEditingMatrix ? (
                                <input
                                  type="text"
                                  value={row.data[v.key] || ''}
                                  onChange={(e) => handleCellChange(actualIndex, v.key, e.target.value)}
                                  onPaste={(e) => handleCellPaste(e, actualIndex, v.key)}
                                  placeholder={`Enter ${v.label}...`}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#818cf8';
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                  }}
                                />
                              ) : (
                                <span style={{ color: 'var(--text-primary)' }}>
                                  {row.data[v.key] || <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                                </span>
                              )}
                            </td>
                          ))}

                          {/* Delete Action (only visible in edit mode) */}
                          {isEditingMatrix && (
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setRowToDelete({ index: actualIndex, country: row.country || 'Unnamed Country' })}
                                title={`Delete Row for ${row.country || 'country'}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  opacity: 0.7,
                                  transition: 'opacity 0.15s',
                                  padding: '4px 8px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                              >
                                ✕
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE & MANAGE VARIABLES */}
      {/* ========================================================================= */}
      {activeTab === 'variables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Add Variable Form */}
          <div className="glass-panel" style={{ padding: '22px 24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
              Define Pricing & Contract Variables
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Adding a variable here immediately creates a new column in the <strong>Rate Matrix Table</strong> and provides a token placeholder like <code>{`{{min_rate}}`}</code> for templates.
            </p>

            <form onSubmit={handleAddVariable} style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Variable Key (slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g. tax_percentage"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="input-field"
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                  required
                />
              </div>

              <div style={{ flex: '1 1 280px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Display Label (Description)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tax & VAT Percentage"
                  value={newVarLabel}
                  onChange={(e) => setNewVarLabel(e.target.value)}
                  className="input-field"
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingVar}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.88rem' }}
              >
                {isSubmittingVar ? 'Adding...' : '+ Create Variable'}
              </button>
            </form>
          </div>

          {/* Variables Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                Active Variable Dictionary ({variables.length})
              </span>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.015)' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Placeholder Token
                    </th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Display Label (Commercial Definition)
                    </th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Matrix Column Key
                    </th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr
                      key={v.id}
                      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', transition: 'background 0.12s' }}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <span
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${v.key}}}`);
                            showToast(`Copied {{${v.key}}} to clipboard!`);
                          }}
                          title="Click to copy placeholder token"
                          style={{
                            cursor: 'pointer',
                            display: 'inline-block',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#a5b4fc',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          {`{{${v.key}}}`} 📋
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: '#ffffff' }}>
                        {v.label}
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {v.key}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        {v.key === 'country' ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            🔒 Primary Key
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVariableToDelete({ key: v.key, label: v.label })}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#ef4444',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '4px',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                              e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                            }}
                          >
                            🗑️ Delete Column
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RATE TEMPLATE EDITOR & LIVE PREVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'template' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Editor Column */}
          <div className="glass-panel" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
              Draft Contractual Rate Template
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Click any variable button below to insert it at your cursor.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Template Title
              </label>
              <input
                type="text"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                className="input-field"
                style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                placeholder="e.g. Standard Enterprise Pricing Guide"
              />
            </div>

            {/* Quick Variable Insert Chips */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Insert Variable Chip:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {variables.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => insertVariableAtCursor(v.key)}
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      color: '#c7d2fe',
                      padding: '4px 9px',
                      borderRadius: '5px',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.28)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)')}
                  >
                    + {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Textarea */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Contractual Clauses & Pricing Text
              </label>
              <textarea
                ref={textareaRef}
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={16}
                className="input-field"
                style={{
                  padding: '12px',
                  fontSize: '0.88rem',
                  fontFamily: 'Consolas, monospace',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  width: '100%',
                }}
                placeholder="Type your pricing guidance and contractual clauses here..."
              />
            </div>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSavingTemplate}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }}
            >
              {isSavingTemplate ? 'Saving...' : '💾 Deploy Template Live to Actors'}
            </button>
          </div>

          {/* Real-time Preview Column */}
          <div className="glass-panel" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Live Actor Preview
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Simulate actor view with real country data
                </p>
              </div>

              {/* Test Country Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Country:</span>
                <select
                  value={previewCountry}
                  onChange={(e) => setPreviewCountry(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '5px 10px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {tableRows.map((r, idx) => (
                    <option key={idx} value={r.country} style={{ background: '#0f172a' }}>
                      {r.country || '(Unnamed Country)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Output Frame */}
            <div
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '20px',
                color: 'var(--text-secondary)',
                lineHeight: '1.7',
                fontSize: '0.9rem',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              {previewInterpolated || (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Enter template text on the left to see live preview...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SPREADSHEET PASTE MODAL */}
      {/* ========================================================================= */}
      {isPasteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPasteModalOpen(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#0f172a',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  📋 Paste Spreadsheet Cells
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Copy your table from Google Sheets or Excel and paste below (Ctrl+V).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Expected Column Order Helper */}
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--border-subtle)',
                marginBottom: '14px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>Expected Column Order:</strong> Country, {columnVariables.map((v) => v.label).join(', ')}
            </div>

            {/* Paste Box */}
            <textarea
              rows={8}
              value={pasteRawText}
              onChange={(e) => setPasteRawText(e.target.value)}
              placeholder="Paste copied cells from Google Sheets or Excel here (Ctrl+V)..."
              autoFocus
              className="input-field"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                marginBottom: '14px',
              }}
            />

            {/* Live Parsing Preview */}
            {parsedPasteRows.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                  ✓ Successfully recognized {parsedPasteRows.length} country row(s):
                </div>
                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '0.78rem',
                  }}
                >
                  {parsedPasteRows.map((r, i) => (
                    <div key={i} style={{ padding: '3px 6px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <strong style={{ color: '#ffffff' }}>{r.country}</strong>: {Object.entries(r.data).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paste Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'append'}
                  onChange={() => setPasteMode('append')}
                />
                Append to / update existing countries
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'replace'}
                  onChange={() => setPasteMode('replace')}
                />
                Replace entire matrix
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyModalPaste}
                disabled={parsedPasteRows.length === 0}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Apply to Table ({parsedPasteRows.length} Rows)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Column/Variable Deletion Confirmation Modal */}
      {variableToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingVariable) {
              setVariableToDelete(null);
            }
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px 28px',
              background: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.15)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Delete Column & Variable?
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 500 }}>
                  This action cannot be undone
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Are you sure you want to permanently delete the column for <strong>{variableToDelete.label}</strong> (<code style={{ color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>{`{{${variableToDelete.key}}}`}</code>)?
            </p>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.78rem',
                color: '#fca5a5',
                marginBottom: '20px',
              }}
            >
              Removing this variable will delete its column from the rate matrix table and detach it from active pricing templates.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeletingVariable}
                onClick={() => setVariableToDelete(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingVariable}
                onClick={handleConfirmDeleteVariable}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: '1px solid #ef4444',
                  color: '#ffffff',
                  cursor: isDeletingVariable ? 'default' : 'pointer',
                  boxShadow: '0 0 14px rgba(239, 68, 68, 0.35)',
                }}
              >
                {isDeletingVariable ? 'Deleting...' : 'Yes, Delete Column'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Row Deletion Confirmation Modal */}
      {rowToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRowToDelete(null);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px 28px',
              background: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.15)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Delete Country Row?
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 500 }}>
                  Confirm removing country from matrix
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Are you sure you want to remove the pricing row for <strong style={{ color: '#ffffff' }}>{rowToDelete.country}</strong>?
            </p>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.78rem',
                color: '#fca5a5',
                marginBottom: '20px',
              }}
            >
              This country will be removed from the matrix draft. Click &quot;Save All Changes&quot; afterward to permanently persist the updated matrix.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRow}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: '1px solid #ef4444',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 0 14px rgba(239, 68, 68, 0.35)',
                }}
              >
                Yes, Delete Row
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
