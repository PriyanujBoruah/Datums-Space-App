import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertCircle, ShieldCheck, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';
import firebaseService from '../../services/FirebaseService';
import { showAlert } from '../../services/DialogService';

interface FlaggedRecord {
  id: string;
  columnName: string;
  originalValue: string;
  piiType: 'EMAIL' | 'PHONE' | 'CREDIT_CARD';
  rowIndex: number;
}

export const PrivacyLab: React.FC = () => {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isRedacting, setIsRedacting] = useState(false);
  const [flaggedEntries, setFlaggedEntries] = useState<FlaggedRecord[]>([]);
  const [scanExecuted, setScanExecuted] = useState(false);
  const [redactedCount, setRedactedCount] = useState<number | null>(null);

  useEffect(() => {
    const syncTables = () => {
      const active = duckDbService.getActiveTables();
      setTables(active);
      if (active.length > 0 && !selectedTable) {
        setSelectedTable(active[0].name);
      }
    };
    syncTables();
    const unsub = eventBus.on('TABLES_UPDATED', syncTables);
    return () => unsub();
  }, [selectedTable]);

  const runPIIScan = async () => {
    if (!selectedTable) return;
    setIsScanning(true);
    setScanExecuted(false);
    setFlaggedEntries([]);
    setRedactedCount(null);

    try {
      // 1. Fetch raw table records from DuckDB-Wasm
      const { rows } = await duckDbService.query(`SELECT * FROM ${selectedTable}`);
      
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const phoneRegex = /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/;
      const ccRegex = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/;

      const detected: FlaggedRecord[] = [];

      rows.forEach((row, rIdx) => {
        Object.keys(row).forEach((colName) => {
          const val = String(row[colName] || '').trim();
          if (!val) return;

          if (emailRegex.test(val)) {
            detected.push({
              id: `pii-${rIdx}-${colName}-email`,
              columnName: colName,
              originalValue: val,
              piiType: 'EMAIL',
              rowIndex: rIdx,
            });
          } else if (ccRegex.test(val)) {
            detected.push({
              id: `pii-${rIdx}-${colName}-cc`,
              columnName: colName,
              originalValue: val,
              piiType: 'CREDIT_CARD',
              rowIndex: rIdx,
            });
          } else if (phoneRegex.test(val) && val.length >= 7 && /\d/.test(val)) {
            detected.push({
              id: `pii-${rIdx}-${colName}-phone`,
              columnName: colName,
              originalValue: val,
              piiType: 'PHONE',
              rowIndex: rIdx,
            });
          }
        });
      });

      setFlaggedEntries(detected);
      setScanExecuted(true);
      
      eventBus.emit('AUDIT_LOG', {
        action: 'PII_SCAN',
        details: `PII Compliance scan completed on table '${selectedTable}'. Flagged ${detected.length} anomalies.`,
        status: 'success'
      });
    } catch (err: any) {
      console.error('[PrivacyLab] Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRedact = async () => {
    if (flaggedEntries.length === 0 || !selectedTable) return;

    // Check Role Clearance: Viewer role cannot redact ledger data!
    if (!firebaseService.hasRole(['Admin', 'Auditor'])) {
      await showAlert('Security Clearance Denied: Your assigned persona role does not possess permissions to write updates to database ledger files.', 'Security Clearance Denied');
      return;
    }

    setIsRedacting(true);
    let successCount = 0;

    try {
      // Group redactions by column to combine SQL queries efficiently
      const grouped: { [col: string]: string[] } = {};
      flaggedEntries.forEach(entry => {
        if (!grouped[entry.columnName]) grouped[entry.columnName] = [];
        grouped[entry.columnName].push(entry.originalValue);
      });

      // Execute a target UPDATE SQL statement for each flagged field to mask values
      for (const colName of Object.keys(grouped)) {
        const uniqueValues = Array.from(new Set(grouped[colName]));
        
        for (const rawVal of uniqueValues) {
          let maskedVal = '[REDACTED_PII]';
          if (rawVal.includes('@')) {
            // Mask Email username
            const parts = rawVal.split('@');
            maskedVal = `${parts[0].slice(0, 2)}***@${parts[1]}`;
          } else if (rawVal.replace(/[- ]/g, '').length >= 12) {
            // Mask Credit Card
            maskedVal = `****-****-****-${rawVal.slice(-4)}`;
          } else {
            // Mask Phone
            maskedVal = `${rawVal.slice(0, 3)}******${rawVal.slice(-3)}`;
          }

          const escapedRawVal = rawVal.replace(/'/g, "''");
          const updateSql = `UPDATE ${selectedTable} 
            SET ${colName} = '${maskedVal}' 
            WHERE ${colName} = '${escapedRawVal}'`;
          
          await duckDbService.query(updateSql);
          successCount += flaggedEntries.filter(e => e.columnName === colName && e.originalValue === rawVal).length;
        }
      }

      setRedactedCount(successCount);
      setFlaggedEntries([]);
      
      // Update the active schema row metadata counts in case properties mutated
      const tableMeta = duckDbService.getActiveTables().find(t => t.name === selectedTable);
      if (tableMeta) {
        eventBus.emit('TABLES_UPDATED', duckDbService.getActiveTables());
      }

      eventBus.emit('AUDIT_LOG', {
        action: 'PII_REDACTION',
        details: `Redacted ${successCount} sensitive field instances inside table '${selectedTable}'. Ledger sanitized.`,
        status: 'success'
      });
    } catch (err: any) {
      console.error('[PrivacyLab] Redaction compilation failed:', err);
    } finally {
      setIsRedacting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
          Automated Privacy Lab (PII Scan)
        </h3>
        <p className="text-xs text-slate-400">
          Enforce GDPR, HIPAA, or financial security instantly. Scan and mask email, phone numbers, or credit cards completely locally before exporting.
        </p>
      </div>

      {tables.length === 0 ? (
        <div className="relative overflow-hidden flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-center space-y-4 z-0">
          {/* Dynamic Animated Geometrical Background Elements */}
          <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-40 select-none overflow-hidden z-0">
            <style>{`
              @keyframes float-geom-upload-1 {
                0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                50% { transform: translate(15px, -10px) rotate(180deg) scale(1.15); }
                100% { transform: translate(0px, 0px) rotate(360deg) scale(1); }
              }
              @keyframes float-geom-upload-2 {
                0% { transform: translate(0px, 0px) rotate(360deg) scale(1.2); }
                50% { transform: translate(-18px, 12px) rotate(180deg) scale(0.9); }
                100% { transform: translate(0px, 0px) rotate(0deg) scale(1.2); }
              }
              @keyframes float-geom-upload-3 {
                0% { transform: translate(0px, 0px) rotate(0deg) scale(0.9); }
                50% { transform: translate(-10px, -15px) rotate(-180deg) scale(1.1); }
                100% { transform: translate(0px, 0px) rotate(-360deg) scale(0.9); }
              }
            `}</style>

            {/* Element 1: Large Blur Sphere */}
            <div 
              className="absolute rounded-full filter blur-[1.5px]" 
              style={{
                width: '42px',
                height: '42px',
                left: '15%',
                top: '20%',
                background: 'radial-gradient(circle, var(--color-brand-500) 0%, transparent 80%)',
                animation: 'float-geom-upload-1 12s infinite ease-in-out'
              }}
            />

            {/* Element 2: Small Blur Sphere */}
            <div 
              className="absolute rounded-full filter blur-[1px]" 
              style={{
                width: '28px',
                height: '28px',
                right: '22%',
                top: '28%',
                background: 'radial-gradient(circle, var(--color-brand-500) 0%, transparent 80%)',
                animation: 'float-geom-upload-3 9s infinite ease-in-out'
              }}
            />

            {/* Element 3: Large Square */}
            <div 
              className="absolute border-[1px] filter blur-[0.1px]" 
              style={{
                width: '22px',
                height: '22px',
                right: '30%',
                bottom: '12%',
                borderColor: 'var(--color-brand-500)',
                opacity: 0.7,
                borderRadius: '4px',
                animation: 'float-geom-upload-2 14s infinite ease-in-out'
              }}
            />

            {/* Element 4: Small Square */}
            <div 
              className="absolute border-[1px] filter blur-[0.1px]" 
              style={{
                width: '14px',
                height: '14px',
                left: '8%',
                bottom: '30%',
                borderColor: 'var(--color-brand-500)',
                opacity: 0.6,
                borderRadius: '2px',
                animation: 'float-geom-upload-1 11s infinite ease-in-out'
              }}
            />

            {/* Element 5: Wireframe Triangle */}
            <svg 
              className="absolute" 
              style={{
                width: '22px',
                height: '22px',
                left: '48%',
                bottom: '22%',
                fill: 'none',
                stroke: 'var(--color-brand-500)',
                strokeWidth: 1.5,
                opacity: 0.6,
                animation: 'float-geom-upload-3 15s infinite ease-in-out'
              }}
              viewBox="0 0 24 24"
            >
              <polygon points="12,2 22,22 2,22" />
            </svg>

            {/* Element 6: Wireframe Diamond */}
            <svg 
              className="absolute" 
              style={{
                width: '18px',
                height: '18px',
                left: '28%',
                top: '15%',
                fill: 'none',
                stroke: 'var(--color-brand-500)',
                strokeWidth: 1.5,
                opacity: 0.5,
                animation: 'float-geom-upload-1 13s infinite ease-in-out'
              }}
              viewBox="0 0 24 24"
            >
              <polygon points="12,2 22,12 12,22 2,12" />
            </svg>

            {/* Element 7: Plus Sign / Cross */}
            <div 
              className="absolute filter blur-[0.1px]" 
              style={{
                width: '12px',
                height: '12px',
                right: '15%',
                top: '35%',
                opacity: 0.65,
                animation: 'float-geom-upload-2 10s infinite ease-in-out'
              }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="w-10 h-10 text-slate-500 dark:text-slate-650" />
            <div className="space-y-1 font-sans">
              <h4 className="text-sm font-semibold text-slate-750 dark:text-slate-350">No Datasets Found</h4>
              <p className="text-xs text-slate-550 dark:text-slate-500 max-w-sm leading-relaxed">
                Please ingest a structured CSV or Excel workbook to unlock the compliance scanner.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-lg transition-colors duration-300">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Select Compliance Target Table
              </label>
              <select
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setScanExecuted(false);
                  setFlaggedEntries([]);
                  setRedactedCount(null);
                }}
                className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-xs"
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runPIIScan}
              disabled={isScanning}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-700/50 text-white font-semibold text-xs rounded-lg shadow-md transition-colors flex items-center gap-2 mt-5"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Auditing Rows...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Scan Sensitive PII
                </>
              )}
            </button>
          </div>

          {scanExecuted && flaggedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-500/20 rounded-xl text-center shadow-xs">
              <ShieldCheck className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Ledger Status: Fully Compliant</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md">
                  A high-speed scan completed on table **'{selectedTable}'** and found zero occurrences of exposed email, telephone, or card details.
                </p>
              </div>
            </div>
          )}

          {redactedCount !== null && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 bg-brand-50/30 dark:bg-brand-950/10 border border-brand-150 dark:border-brand-500/20 rounded-xl text-center shadow-xs">
              <ShieldCheck className="w-12 h-12 text-brand-500 dark:text-brand-400" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-855 dark:text-slate-100 text-sm">PII Redaction Succeeded</p>
                <p className="text-slate-550 dark:text-slate-400 text-xs max-w-sm">
                  Sanitization complete. Successfully masked **{redactedCount}** field records inside table **'{selectedTable}'**.
                </p>
              </div>
            </div>
          )}

          {flaggedEntries.length > 0 && (
            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4 shadow-lg transition-colors duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400" />
                    Sensitive Record Flags ({flaggedEntries.length})
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500">
                    The local compliance engines detected exposed contact or credit card footprints. Review below:
                  </p>
                </div>

                <button
                  onClick={handleRedact}
                  disabled={isRedacting}
                  className="px-4 py-2 bg-red-650 hover:bg-red-600 disabled:bg-red-800 text-white font-semibold text-xs rounded-lg shadow transition-colors flex items-center gap-1.5"
                >
                  {isRedacting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  One-Click Mask Ledger
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-850 rounded-lg bg-white dark:bg-slate-950/50 max-h-[300px] shadow-inner">
                <table className="w-full text-left border-collapse text-xs text-slate-700 dark:text-slate-300">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-855 text-slate-550 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2.5 w-[80px]">Row #</th>
                      <th className="px-4 py-2.5">Database Column</th>
                      <th className="px-4 py-2.5">PII Classification</th>
                      <th className="px-4 py-2.5">Granular Expose String</th>
                      <th className="px-4 py-2.5">Mask Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                    {flaggedEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 font-mono text-[11px]">
                        <td className="px-4 py-2 text-slate-455 dark:text-slate-500">#{entry.rowIndex + 1}</td>
                        <td className="px-4 py-2 text-brand-650 dark:text-brand-400">{entry.columnName}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              entry.piiType === 'EMAIL'
                                ? 'bg-brand-50 dark:bg-brand-950 text-brand-650 dark:text-brand-400 border border-brand-150 dark:border-brand-500/20'
                                : entry.piiType === 'CREDIT_CARD'
                                ? 'bg-red-50 dark:bg-red-950 text-red-650 dark:text-red-400 border border-red-150 dark:border-red-500/20'
                                : 'bg-amber-50 dark:bg-amber-950 text-amber-650 dark:text-amber-400 border border-amber-150 dark:border-amber-500/20'
                            }`}
                          >
                            {entry.piiType}
                          </span>
                        </td>
                        <td className="px-4 py-2 truncate max-w-[200px] text-slate-600 dark:text-slate-300">{entry.originalValue}</td>
                        <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-655" />
                          {entry.piiType === 'EMAIL'
                            ? `${entry.originalValue.split('@')[0].slice(0, 2)}***@${entry.originalValue.split('@')[1]}`
                            : entry.piiType === 'CREDIT_CARD'
                            ? `****-****-****-${entry.originalValue.slice(-4)}`
                            : `${entry.originalValue.slice(0, 3)}******${entry.originalValue.slice(-3)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrivacyLab;
