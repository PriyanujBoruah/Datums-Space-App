import React, { useState, useEffect } from 'react';
import { 
  History, Save, Trash2, Cloud, Database, Activity, User, Sparkles, FolderOpen, AlertTriangle, Layers
} from 'lucide-react';
import libraryService from '../../services/LibraryService';
import type { LibrarySession } from '../../services/LibraryService';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import firebaseService from '../../services/FirebaseService';
import eventBus from '../../services/EventBus';
import { showConfirm } from '../../services/DialogService';

export const Library: React.FC = () => {
  const [sessions, setSessions] = useState<LibrarySession[]>([]);
  const [activeTables, setActiveTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [newSessionName, setNewSessionName] = useState('');
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const syncLibrary = async () => {
    try {
      setError(null);
      const list = await libraryService.loadAllSessions();
      setSessions(list);
      
      const tables = duckDbService.getActiveTables();
      setActiveTables(tables);
      if (tables.length > 0 && !selectedTable) {
        setSelectedTable(tables[0].name);
      }
    } catch (err: any) {
      console.error('[LibraryUI] Failed to sync library list:', err);
      setError(err.message || String(err));
    }
  };

  useEffect(() => {
    syncLibrary();
    const unsub = eventBus.on('LIBRARY_SESSIONS_UPDATED', syncLibrary);
    const unsubTables = eventBus.on('TABLES_UPDATED', syncLibrary);
    return () => {
      unsub();
      unsubTables();
    };
  }, [selectedTable]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim() || !selectedTable) return;

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLoadingText('Compressing current active workspace and uploading to vault...');

    try {
      await libraryService.saveSession(newSessionName.trim(), selectedTable);
      setSuccessMsg(`Session '${newSessionName.trim()}' successfully committed to your Library!`);
      setNewSessionName('');
      await syncLibrary();
    } catch (err: any) {
      console.error('[LibraryUI] Save failed:', err);
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };

  const handleRestore = async (session: LibrarySession) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLoadingText(`Downloading dataset Parquet payload & re-constructing DuckDB schemas...`);

    try {
      // 1. Fetch full payload (Parquet base64, chat, audit logs)
      const fullSession = await libraryService.loadSessionPayload(session.id);
      
      // 2. Restore inside local database & states
      await libraryService.restoreSession(fullSession);
      
      setSuccessMsg(`Workspace session restored successfully!`);
      
      // 3. Seamlessly switch tabs to Chat interface
      setTimeout(() => {
        eventBus.emit('SWITCH_TAB', 'chat');
      }, 800);
    } catch (err: any) {
      console.error('[LibraryUI] Restore failed:', err);
      setError(err.message || String(err));
      setIsLoading(false);
      setLoadingText('');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!await showConfirm(`Are you absolutely certain you want to purge session slot '${name}'? This action cannot be undone.`, 'Purge Session Slot')) return;

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLoadingText(`Purging session data structures...`);

    try {
      await libraryService.deleteSession(id);
      setSuccessMsg(`Session slot purged successfully.`);
      await syncLibrary();
    } catch (err: any) {
      console.error('[LibraryUI] Delete failed:', err);
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };

  // Quota Calculations
  const maxSlots = 10;
  const maxBytes = 50 * 1024 * 1024; // 50MB
  const slotsUsed = sessions.length;
  const bytesUsed = sessions.reduce((sum, s) => sum + s.datasetSize, 0);
  const slotsPercent = Math.min(100, (slotsUsed / maxSlots) * 100);
  const bytesPercent = Math.min(100, (bytesUsed / maxBytes) * 100);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0.00 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const isCloud = firebaseService.isFirebaseConfigured();

  return (
    <div className="space-y-6 select-none max-w-5xl mx-auto pb-12 print:hidden">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2 tracking-tight">
            <Cloud className="w-5 h-5 text-brand-500" />
            Strategic Workspace Library
          </h2>
          <p className="text-xs text-slate-500 leading-normal">
            Save select local database sessions along with their chat history, audit logs, and committee goals for continuing later.
          </p>
        </div>
        
        <div className={`p-2.5 rounded-xl border text-[9px] font-bold tracking-wider flex items-center gap-2 uppercase ${
          isCloud 
            ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100/60 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100/60 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
        }`}>
          <span>{isCloud ? '🛡️' : '⚠️'}</span>
          <span>{isCloud ? 'Cloud Custody Sync Online' : 'Local Sandbox Offline Mode'}</span>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50/60 dark:bg-rose-950/10 border border-rose-200/50 dark:border-rose-900/35 rounded-2xl flex items-start gap-3 text-xs text-rose-800 dark:text-rose-400 select-text animate-[fadeIn_0.2s_ease-out]">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-500 mt-0.5 shrink-0" />
          <div className="space-y-1 leading-relaxed">
            <strong className="font-bold text-[9px] uppercase tracking-wider block">System Storage Failure</strong>
            {error.includes('SLOT_LIMIT_EXCEEDED') ? (
              <span>Your Library has utilized all 10 saved sessions. Please clear an old session to save this workspace.</span>
            ) : error.includes('SIZE_LIMIT_EXCEEDED') ? (
              <span>Total library storage limit (50MB) reached. Please purge old datasets to free up space.</span>
            ) : (
              <span>{error}</span>
            )}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-955/10 border border-emerald-200/50 dark:border-emerald-900/35 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-400 select-text animate-[fadeIn_0.2s_ease-out]">
          <span className="text-emerald-500 font-bold shrink-0">✓</span>
          <div className="space-y-0.5">
            <strong className="font-bold text-[9px] uppercase tracking-wider block">Operation Success</strong>
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* Storage & Limits Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slots Quota Card */}
        <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-5 rounded-2xl backdrop-blur-xl shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Account Save Slots</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
              {slotsUsed} / {maxSlots} files
            </span>
          </div>
          
          <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-900">
            <div 
              className={`h-full transition-all duration-500 ${
                slotsPercent > 80 ? 'bg-rose-500' : slotsPercent > 50 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${slotsPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Each workspace profile is allocated 10 concurrent slots. Delete old sessions to make room for new models.
          </p>
        </div>

        {/* Space Capacity Card */}
        <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-5 rounded-2xl backdrop-blur-xl shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-brand-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Storage Footprint Used</span>
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
              {formatSize(bytesUsed)} / 50.00 MB
            </span>
          </div>
          
          <div className="w-full bg-slate-100 dark:bg-slate-955 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-900">
            <div 
              className={`h-full transition-all duration-500 ${
                bytesPercent > 80 ? 'bg-rose-500' : bytesPercent > 50 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${bytesPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Max dataset storage footprint limit is 50MB. Dataset tables are compressed to optimized Parquet format to save space.
          </p>
        </div>
      </div>

      {/* Save Session Form */}
      {activeTables.length > 0 ? (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg space-y-5">
          <div className="flex items-center gap-2 text-slate-850 dark:text-slate-100 pb-2 border-b border-slate-150 dark:border-slate-900/50">
            <Save className="w-4 h-4 text-brand-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Save Current Session Context</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                Session Name / Analysis Tag *
              </label>
              <input
                type="text"
                required
                disabled={isLoading}
                placeholder="e.g. Logistics SKU Velocity Audit Q1"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-855 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                Select Active Dataset Table
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-855 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700 dark:text-slate-350 cursor-pointer"
              >
                {activeTables.map(t => (
                  <option key={t.name} value={t.name} className="bg-white dark:bg-slate-950 text-slate-800">
                    {t.name} ({t.rowCount.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading || !newSessionName.trim()}
              className="px-5 py-2.5 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Active Workspace Session
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl text-center space-y-2 select-none">
          <Database className="w-8 h-8 text-slate-400 dark:text-slate-650 mx-auto" />
          <h4 className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-widest">No Active Datasets Loaded</h4>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto leading-normal">
            You must import a spreadsheet (Excel or CSV) and populate active database tables before you can save a workspace context.
          </p>
        </div>
      )}

      {/* Session List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-900 select-none">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-550 flex items-center gap-1.5">
            <FolderOpen className="w-4.5 h-4.5 text-slate-400 dark:text-slate-650" />
            Saved Analysis Slots ({sessions.length})
          </h3>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-900 rounded-2xl text-center space-y-3 bg-transparent">
            <History className="w-9 h-9 text-slate-400 dark:text-slate-750 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">Library Archive Empty</h4>
              <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Save an active session profile to commit and secure it. Restoring a slot will re-ingest all schemas, chats, goals, and logs immediately.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <div 
                key={session.id}
                className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-5 rounded-2xl hover:border-brand-500/35 transition-all duration-300 relative group flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  {/* Slot Title */}
                  <div className="flex justify-between items-start gap-2 select-text">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-650 dark:group-hover:text-brand-400 transition-colors leading-snug">
                      {session.name}
                    </h4>
                    <span className="text-[7.5px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded-md shrink-0 font-mono">
                      {formatSize(session.datasetSize)}
                    </span>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-b border-slate-150 dark:border-slate-900/60 py-3 text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-400 uppercase font-bold text-[9px]">
                        {session.datasetName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{session.rowCount.toLocaleString()} rows</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{session.createdBy.split('@')[0]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate uppercase font-bold text-[8.5px] text-brand-500">
                        {session.organizationId}
                      </span>
                    </div>
                  </div>

                  {/* Strategic Goal Quote Preview */}
                  {session.strategicGoal && (
                    <div className="p-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl select-text">
                      <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest block mb-0.5">
                        Strategic Goal Mandate
                      </span>
                      <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-normal line-clamp-2">
                        {session.strategicGoal}
                      </p>
                    </div>
                  )}

                  <p className="text-[9px] text-slate-450 text-right">
                    Saved: {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Slot Actions Toolbar */}
                <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-900/60 select-none">
                  <button
                    onClick={() => handleRestore(session)}
                    disabled={isLoading}
                    className="flex-1 py-1.8 bg-transparent hover:bg-brand-50 dark:bg-transparent dark:hover:bg-brand-950/20 text-brand-650 dark:text-brand-400 hover:text-brand-600 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Resume Session Context
                  </button>
                  
                  <button
                    onClick={() => handleDelete(session.id, session.name)}
                    disabled={isLoading}
                    className="p-1.8 hover:bg-rose-50 dark:hover:bg-rose-955/20 border border-transparent hover:border-rose-150 dark:hover:border-rose-500/10 text-slate-400 hover:text-rose-650 dark:hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                    title="Delete saved slot permanently"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Glowing Loader Modal during saves/downloads */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 animate-[fadeIn_0.15s_ease-out] select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* HSL pulsing core */}
            <div className="absolute top-0 -left-4 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute bottom-0 -right-4 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />

            <div className="relative space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-brand-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <Cloud className="w-6 h-6 text-brand-400 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-200">
                  Securing Analytical Core
                </h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-mono">
                  {loadingText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Library;
