import React, { useState, useEffect } from 'react';
import { History, Download, Trash2, Search, Filter, ShieldCheck } from 'lucide-react';
import eventBus from '../../services/EventBus';
import { showConfirm } from '../../services/DialogService';

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  organizationId: string;
  status: 'success' | 'warning' | 'error';
}

export const AuditDossier: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    // 1. Restore previous compliance records from browser storage
    const restored = localStorage.getItem('datum_s_compliance_audit_logs');
    if (restored) {
      setLogs(JSON.parse(restored));
    }

    // 2. Subscribe to EventBus notifications to update log entries reactively
    const unsub = eventBus.on('AUDIT_LOG', (eventData: { action: string; details: string; status?: 'success' | 'warning' | 'error' }) => {
      // Fetch current active user profile cached context
      let email = 'system.sandbox@local';
      let org = 'LocalSandbox';
      
      const session = localStorage.getItem('datum_s_firebase_session');
      if (session) {
        const user = JSON.parse(session);
        email = user.email;
        org = user.organizationId;
      }

      const newRecord: AuditRecord = {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        action: eventData.action,
        details: eventData.details,
        user: email,
        organizationId: org,
        status: eventData.status || 'success',
      };

      setLogs((prev) => {
        const updated = [newRecord, ...prev].slice(0, 500); // Limit log list buffer to latest 500 items
        localStorage.setItem('datum_s_compliance_audit_logs', JSON.stringify(updated));
        return updated;
      });
    });

    return () => unsub();
  }, []);

  const handleClearLogs = async () => {
    if (await showConfirm('Are you absolutely certain you want to purge the compliance audit dossier? This action is permanent and cannot be undone.', 'Purge Audit Dossier')) {
      setLogs([]);
      localStorage.removeItem('datum_s_compliance_audit_logs');
    }
  };

  const handleExport = () => {
    if (logs.length === 0) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datum_s_audit_dossier_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Compile list filtering
  const filtered = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(search.toLowerCase()) || 
                          log.action.toLowerCase().includes(search.toLowerCase()) ||
                          log.user.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterAction === 'ALL' || log.action.toUpperCase() === filterAction.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  const actionsSet = Array.from(new Set(logs.map(l => l.action.toUpperCase())));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            GDPR Compliance & Audit Dossier
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A comprehensive, tamper-evident log capturing all actions, SQL runs, joins, and PII updates. Retained fully locally.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-950/20 disabled:text-slate-650 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Dossier JSON
          </button>
          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-red-650 dark:text-red-400 disabled:text-slate-400 dark:disabled:text-slate-650 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search audit trail details, actors, or events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 placeholder-slate-500 shadow-xs"
          />
        </div>

        {/* Action Filters */}
        <div className="relative">
          <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-705 dark:text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Event Classifications</option>
            {actionsSet.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
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
                left: '30%',
                top: '18%',
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
                right: '18%',
                top: '22%',
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
                right: '12%',
                bottom: '28%',
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
                left: '22%',
                bottom: '15%',
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
                left: '55%',
                bottom: '20%',
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
                left: '38%',
                top: '12%',
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
                right: '35%',
                top: '30%',
                opacity: 0.65,
                animation: 'float-geom-upload-2 10s infinite ease-in-out'
              }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            <ShieldCheck className="w-10 h-10 text-slate-500 dark:text-slate-650" />
            <div className="space-y-1 font-sans">
              <h4 className="text-sm font-semibold text-slate-750 dark:text-slate-350">Dossier Log Empty</h4>
              <p className="text-xs text-slate-555 dark:text-slate-500 max-w-sm leading-relaxed">
                No administrative operations recorded yet. Import sheets, run relational joins, or execute SQL workbench queries to populate the compliance log.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900/30 overflow-hidden shadow-lg transition-colors duration-300">
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-855 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 w-[150px]">ISO Timestamp</th>
                  <th className="px-4 py-3 w-[110px]">Action Type</th>
                  <th className="px-4 py-3 w-[120px]">Organization Scope</th>
                  <th className="px-4 py-3">Granular Audit Narrative</th>
                  <th className="px-4 py-3 w-[180px]">Responsible Actor</th>
                  <th className="px-4 py-3 w-[80px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-955/20 font-mono text-[11px] leading-relaxed">
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-brand-650 dark:text-brand-400 shadow-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-medium">{log.organizationId}</td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-300 font-sans text-xs">{log.details}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{log.user}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          log.status === 'success'
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                            : log.status === 'warning'
                            ? 'bg-amber-500 shadow-sm shadow-amber-500/30'
                            : 'bg-red-500 shadow-sm shadow-red-500/30'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditDossier;
