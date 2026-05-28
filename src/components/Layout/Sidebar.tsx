import React, { useState, useEffect } from 'react';
import { 
  Database, ShieldAlert, Settings, Save, Trash2, 
  MessageSquare, FileSpreadsheet, Sparkles, ArrowLeftRight, History, BookOpen, Lock,
  Download, Upload, CheckCircle2, AlertTriangle, LogOut, Sun, Moon, Cloud
} from 'lucide-react';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';
import firebaseService from '../../services/FirebaseService';
import type { FirebaseUser } from '../../services/FirebaseService';
import agentManager from '../../services/AgentManager';
import type { ApiSettings, AgentId } from '../../services/AgentManager';
import vaultService from '../../services/VaultService';
import { COMPLIANCE_DOCS } from '../../data/complianceDocs';
import type { ComplianceDoc } from '../../data/complianceDocs';
import { PersonaLogo } from './PersonaLogo';
import { showAlert, showConfirm } from '../../services/DialogService';

const palettes = [
  { id: 'indigo', name: 'Classic Indigo', primary: '#4f46e5', accent: '#a5b4fc' },
  { id: 'emerald', name: 'Emerald Mint', primary: '#059669', accent: '#6ee7b7' },
  { id: 'violet', name: 'Royal Violet', primary: '#7c3aed', accent: '#c4b5fd' },
  { id: 'amber', name: 'Cyber Amber', primary: '#d97706', accent: '#fcd34d' },
  { id: 'rose', name: 'Crimson Rose', primary: '#e11d48', accent: '#fda4af' },
  { id: 'blue', name: 'Oceanic Cobalt', primary: '#2563eb', accent: '#93c5fd' },
  { id: 'green', name: 'Forest Moss', primary: '#16a34a', accent: '#86efac' },
  { id: 'orange', name: 'Sunset Orange', primary: '#ea580c', accent: '#fdbb74' },
  { id: 'slate', name: 'Midnight Slate', primary: '#475569', accent: '#cbd5e1' },
  { id: 'pink', name: 'Hot Pink', primary: '#db2777', accent: '#f9a8d4' },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  palette: string;
  setPalette: (palette: string) => void;
  width?: number;
  activeDoc: ComplianceDoc | null;
  setActiveDoc: (doc: ComplianceDoc | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, theme, setTheme, isOpen, setIsOpen, palette, setPalette, width = 320, setActiveDoc }) => {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [activeAgent, setActiveAgent] = useState(() => agentManager.getActiveAgent());
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaletteDropdown, setShowPaletteDropdown] = useState(false);
  const [savingTableId, setSavingTableId] = useState<string | null>(null);
  const activePal = palettes.find(p => p.id === palette) || palettes[0];

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // API Settings State
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    geminiKey: '',
    mistralKey: '',
    groqKey: '',
    selectedProvider: 'local',
  });

  // Upgraded production settings states
  const [settingsTab, setSettingsTab] = useState<'llm' | 'agents' | 'backup' | 'docs'>('llm');
  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>(() => agentManager.getEnabledAgents());

  // Backup import/validation states
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    tablesCount: number;
    tablesDetail: string;
    verified: boolean;
    payload?: any;
    error?: string;
  } | null>(null);

  useEffect(() => {
    // 1. Sync files list
    const sync = () => {
      setTables(duckDbService.getActiveTables());
    };
    sync();
    const unsubTables = eventBus.on('TABLES_UPDATED', sync);

    // 2. Sync user profile
    setCurrentUser(firebaseService.getCurrentUser());
    const unsubAuth = eventBus.on('AUTH_STATE_CHANGED', (user) => {
      setCurrentUser(user);
    });

    // 3. Sync API Key settings
    setApiSettings(agentManager.getSettings());
    const unsubSettings = eventBus.on('SETTINGS_UPDATED', (settings) => {
      setApiSettings(settings);
    });

    const unsubAgents = eventBus.on('ENABLED_AGENTS_CHANGED', (agents) => {
      setEnabledAgents(agents);
    });

    const unsubActiveAgent = eventBus.on('ACTIVE_AGENT_CHANGED', (agent) => {
      setActiveAgent(agent);
    });

    return () => {
      unsubTables();
      unsubAuth();
      unsubSettings();
      unsubAgents();
      unsubActiveAgent();
    };
  }, []);

  const handleSaveToVault = async (tableName: string) => {
    setSavingTableId(tableName);
    try {
      await duckDbService.saveTableToVault(tableName);
    } catch (err) {
      console.error('[Sidebar] Save to Vault failed:', err);
    } finally {
      setSavingTableId(null);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    if (await showConfirm(`Are you certain you want to purge table '${tableName}' from the workspace?`, "Purge Table confirmation")) {
      try {
        await duckDbService.deleteTable(tableName);
      } catch (err) {
        console.error('[Sidebar] Delete table failed:', err);
      }
    }
  };


  const handleSaveApiSettings = (key: keyof ApiSettings, val: string) => {
    agentManager.saveSettings({ [key]: val });
  };

  // Export backup function
  const handleExportBackup = async () => {
    try {
      const backupJson = await vaultService.exportBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const backupOrgName = currentUser?.organizationId || 'sandbox';
      link.download = `${backupOrgName.toLowerCase()}_workspace_backup_${Date.now()}.datums`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      eventBus.emit('AUDIT_LOG', {
        action: 'EXPORT_BACKUP',
        details: `Exported workspace backup successfully with SHA-256 integrity seal.`,
        status: 'success'
      });
    } catch (err: any) {
      console.error('[Sidebar] Export backup failed:', err);
      await showAlert(`Export failed: ${err.message || err}`, "Export Failed");
    }
  };

  // Import backup file handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await vaultService.importBackup(text);
        setImportResult(result);
      } catch (err: any) {
        setImportResult({
          success: false,
          tablesCount: 0,
          tablesDetail: '',
          verified: false,
          error: `Failed to parse file: ${err.message || err}`
        });
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImportResult({
        success: false,
        tablesCount: 0,
        tablesDetail: '',
        verified: false,
        error: 'Failed to read file from disk.'
      });
      setImporting(false);
    };
    reader.readAsText(file);
  };

  // Action restore function
  const handleRestoreBackup = async () => {
    if (!importResult?.payload) return;
    if (await showConfirm('WARNING: Restoring this backup will overwrite ALL tables in your current workspace database. Are you absolutely sure?', 'Restore Overwrite Warning')) {
      try {
        await vaultService.restoreBackup(importResult.payload);
        await duckDbService.reloadVault();
        
        // Notify any listeners
        eventBus.emit('TABLES_UPDATED', duckDbService.getActiveTables());
        
        eventBus.emit('AUDIT_LOG', {
          action: 'RESTORE_BACKUP',
          details: `Workspace restored from secure backup containing ${importResult.tablesCount} tables.`,
          status: 'success'
        });

        await showAlert('Workspace restored successfully! DuckDB database tables reloaded.', 'Restore Complete');
        
        // Clean up
        setImportResult(null);
        setShowSettings(false);
      } catch (err: any) {
        console.error('[Sidebar] Restore backup failed:', err);
        await showAlert(`Restore failed: ${err.message || err}`, 'Restore Failure');
      }
    }
  };

  const handleResetImport = () => {
    setImportResult(null);
  };

  const navItems = [
    { id: 'chat', label: 'Chat Analytics', icon: MessageSquare },
    { id: 'ingest', label: 'Ingest Spreadsheets', icon: FileSpreadsheet },
    { id: 'neural', label: 'Neural Ingestion', icon: Sparkles },
    { id: 'join', label: 'Relational Join Lab', icon: ArrowLeftRight },
    { id: 'privacy', label: 'Compliance Privacy Lab', icon: ShieldAlert },
    { id: 'audit', label: 'Audit Dossier', icon: History },
    { id: 'spatial', label: 'SpatialBook Compiler', icon: BookOpen },
    { id: 'library', label: 'Strategic Library', icon: Cloud },
  ];

  const compactWidth = 72;
  const sidebarWidth = isMobile ? (isOpen ? 280 : 0) : (isOpen ? width : compactWidth);

  return (
    <div 
      id="sidebar-panel"
      className={`fixed md:relative left-0 top-0 h-full bg-white dark:bg-slate-950/90 md:bg-white md:dark:bg-slate-950/70 border-r border-slate-200 dark:border-slate-900 flex flex-col select-none z-50 md:z-10 transition-[transform,opacity,width] duration-300 ease-out shadow-xl ${
        isMobile
          ? (isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none w-0 border-r-0')
          : 'translate-x-0 opacity-100'
      }`}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth
      }}
    >
      {/* Top Banner & Header */}
      <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
        <div className="relative overflow-hidden p-5 border-b border-slate-150 dark:border-slate-900 bg-gradient-to-br from-slate-50/60 to-slate-100/40 dark:from-slate-955/60 dark:to-slate-900/30 transition-all duration-300">
          {/* Dynamic Animated Geometrical Background Elements */}
          <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-35 select-none overflow-hidden z-0">
            {/* Style Injection */}
            <style>{`
              @keyframes float-geom-1 {
                0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                50% { transform: translate(18px, -12px) rotate(180deg) scale(1.15); }
                100% { transform: translate(0px, 0px) rotate(360deg) scale(1); }
              }
              @keyframes float-geom-2 {
                0% { transform: translate(0px, 0px) rotate(360deg) scale(1.2); }
                50% { transform: translate(-22px, 18px) rotate(180deg) scale(0.9); }
                100% { transform: translate(0px, 0px) rotate(0deg) scale(1.2); }
              }
              @keyframes float-geom-3 {
                0% { transform: translate(0px, 0px) rotate(0deg) scale(0.85); }
                50% { transform: translate(12px, 22px) rotate(-180deg) scale(1.12); }
                100% { transform: translate(0px, 0px) rotate(-360deg) scale(0.85); }
              }
              @keyframes float-geom-slow {
                0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                50% { transform: translate(-10px, -15px) rotate(90deg) scale(1.05); }
                100% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
              }
            `}</style>

            {/* Shape 1: Primary glowing circle (left-top) */}
            <div 
              className="absolute rounded-full filter blur-[2px]" 
              style={{
                width: '42px',
                height: '42px',
                left: '6%',
                top: '12%',
                background: `radial-gradient(circle, ${activePal.primary} 0%, transparent 80%)`,
                animation: 'float-geom-1 12s infinite ease-in-out'
              }}
            />

            {/* Shape 2: Accent glowing circle (right-bottom) */}
            <div 
              className="absolute rounded-full filter blur-[3px]" 
              style={{
                width: '38px',
                height: '38px',
                right: '12%',
                bottom: '10%',
                background: `radial-gradient(circle, ${activePal.accent} 0%, transparent 80%)`,
                animation: 'float-geom-2 15s infinite ease-in-out'
              }}
            />

            {/* Shape 3: Micro pulsing center-top glow */}
            <div 
              className="absolute rounded-full filter blur-[1px]" 
              style={{
                width: '18px',
                height: '18px',
                left: '52%',
                top: '8%',
                background: `radial-gradient(circle, ${activePal.primary} 0%, transparent 85%)`,
                animation: 'float-geom-3 8s infinite ease-in-out'
              }}
            />

            {/* Shape 4: Rotating border-only square (right-middle) */}
            <div 
              className="absolute border-[1.5px] filter blur-[0.2px]" 
              style={{
                width: '24px',
                height: '24px',
                right: '6%',
                top: '25%',
                borderColor: activePal.accent,
                opacity: 0.8,
                borderRadius: '5px',
                animation: 'float-geom-2 16s infinite ease-in-out'
              }}
            />

            {/* Shape 5: Rotating small border square (left-bottom) */}
            <div 
              className="absolute border-[1px] filter blur-[0.1px]" 
              style={{
                width: '16px',
                height: '16px',
                left: '12%',
                bottom: '18%',
                borderColor: activePal.primary,
                opacity: 0.6,
                borderRadius: '4px',
                animation: 'float-geom-1 20s infinite ease-in-out'
              }}
            />

            {/* Shape 6: Soft glowing outline triangle (center-bottom) */}
            <svg 
              className="absolute animate-[spin_25s_linear_infinite]" 
              style={{
                width: '26px',
                height: '26px',
                left: '44%',
                bottom: '22%',
                fill: 'none',
                stroke: activePal.primary,
                strokeWidth: 2,
                opacity: 0.7,
                animation: 'float-geom-3 14s infinite ease-in-out'
              }}
              viewBox="0 0 24 24"
            >
              <polygon points="12,2 22,22 2,22" />
            </svg>

            {/* Shape 7: Tiny accent triangle (top-right) */}
            <svg 
              className="absolute" 
              style={{
                width: '14px',
                height: '14px',
                right: '25%',
                top: '12%',
                fill: 'none',
                stroke: activePal.accent,
                strokeWidth: 1.5,
                opacity: 0.5,
                animation: 'float-geom-2 18s infinite ease-in-out'
              }}
              viewBox="0 0 24 24"
            >
              <polygon points="12,2 22,22 2,22" />
            </svg>

            {/* Shape 8: Glowing dynamic cross node (left-middle) */}
            <div 
              className="absolute flex items-center justify-center"
              style={{
                left: '25%',
                top: '40%',
                opacity: 0.6,
                animation: 'float-geom-slow 22s infinite ease-in-out'
              }}
            >
              <div className="absolute w-3 h-0.5" style={{ backgroundColor: activePal.primary }} />
              <div className="absolute w-0.5 h-3" style={{ backgroundColor: activePal.primary }} />
            </div>

            {/* Shape 9: Floating micro dot (left-middle) */}
            <div 
              className="absolute w-1.5 h-1.5 rounded-full" 
              style={{
                left: '18%',
                top: '28%',
                backgroundColor: activePal.accent,
                opacity: 0.8,
                animation: 'float-geom-1 9s infinite ease-in-out'
              }}
            />

            {/* Shape 10: Floating micro dot (right-middle) */}
            <div 
              className="absolute w-1.5 h-1.5 rounded-full" 
              style={{
                right: '32%',
                bottom: '15%',
                backgroundColor: activePal.primary,
                opacity: 0.9,
                animation: 'float-geom-2 11s infinite ease-in-out'
              }}
            />

            {/* Shape 11: Extra micro dot (center-right) */}
            <div 
              className="absolute w-1 h-1 rounded-full" 
              style={{
                right: '18%',
                top: '45%',
                backgroundColor: activePal.accent,
                opacity: 0.7,
                animation: 'float-geom-3 13s infinite ease-in-out'
              }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-2">
            {!isOpen ? (
              <div className="flex flex-col items-center w-full" title={`${activeAgent?.name} (${activeAgent?.title})`}>
                <span className="text-[7.5px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-widest block mb-1">Active</span>
                {activeAgent && (
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-855 flex items-center justify-center shadow-xs">
                    <PersonaLogo agentId={activeAgent.id} className="w-7 h-7" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 select-none">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest leading-none">Active Agent</span>
                {activeAgent && (
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 flex items-center justify-center shadow-2xs flex-shrink-0">
                      <PersonaLogo agentId={activeAgent.id} className="w-6.5 h-6.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 leading-none truncate">{activeAgent.name}</p>
                      <p className="text-[8.5px] text-slate-455 dark:text-slate-550 uppercase font-bold tracking-wider leading-none mt-1 truncate max-w-[150px]">{activeAgent.title}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Close Button using Left Collapser Icon custom inline SVG */}
            {isOpen && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-lg text-slate-500 hover:text-slate-855 transition-all shrink-0"
                title="Close Sidebar"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                  <rect width="18" height="18" x="3" y="3" rx="2.5" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Primary Workspace Navigation */}
        <nav className={`p-4 ${isOpen ? 'space-y-1' : 'space-y-3'}`}>
          {isOpen && (
            <span className="px-3 text-[9px] font-bold text-slate-400 dark:text-slate-650 uppercase tracking-widest block mb-2">
              Workspace Nav
            </span>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center transition-all duration-150 ${
                  isOpen 
                    ? `gap-3 px-3 py-2 text-xs font-semibold rounded-lg ${
                        isActive
                          ? 'bg-slate-100/70 dark:bg-slate-900/60 text-brand-650 dark:text-brand-400 font-bold border-l-2 border-brand-500 pl-2.5 rounded-l-none'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/20'
                      }`
                    : `justify-center py-2.5 px-1 rounded-xl ${
                        isActive
                          ? 'bg-slate-100/75 dark:bg-slate-900/80 text-brand-650 dark:text-brand-400 border border-slate-205 dark:border-slate-850 shadow-2xs scale-105'
                          : 'text-slate-455 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/20'
                      }`
                }`}
                title={item.label}
              >
                <Icon className={`flex-shrink-0 ${isOpen ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isActive ? 'text-brand-605 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                {isOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Active Database Sandbox (DuckDB-Wasm) */}
        {isOpen && (
          <div className="px-4 py-2 border-t border-slate-150 dark:border-slate-900/80 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="w-3 h-3 text-slate-400 dark:text-slate-650" />
                DuckDB Sandbox Tables ({tables.length})
              </span>
            </div>

            {tables.length === 0 ? (
              <div className="px-3 py-4 border border-slate-200 dark:border-slate-900 border-dashed rounded-lg text-center text-[9.5px] text-slate-455 dark:text-slate-600 leading-normal font-sans bg-transparent">
                No datasets loaded in memory.
              </div>
            ) : (
              <div className="space-y-1">
                {tables.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/25 rounded-lg transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <Database className="w-3 h-3 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-[11px] font-mono text-slate-700 dark:text-slate-350 truncate">{t.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Narrative Scan Button */}
                      <button
                        onClick={() => {
                          setActiveTab('chat');
                          agentManager.scanTableAsHuman(t.name);
                        }}
                        title="Read table narratively (Human visual scan)"
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 rounded text-slate-400 dark:text-slate-500 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>

                      {/* Vault Persistence Status */}
                      {t.isSaved ? (
                        <button 
                          title="Saved in browser local Vault (IndexedDB)"
                          className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-emerald-500"
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveToVault(t.name)}
                          disabled={savingTableId === t.name}
                          title="Compress to Parquet & save in browser local Vault"
                          className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-650 dark:hover:text-brand-400 rounded text-slate-400 dark:text-slate-500 transition-colors"
                        >
                          {savingTableId === t.name ? (
                            <span className="w-2.5 h-2.5 border border-brand-400 border-t-transparent animate-spin rounded-full block" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                        </button>
                      )}


                      {/* Purge Table */}
                      <button
                        onClick={() => handleDeleteTable(t.name)}
                        title="Drop table from local database"
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-655 dark:hover:text-red-400 rounded text-slate-450 dark:text-slate-555 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Identity Manager & API Settings Footer */}
      <div className="border-t border-slate-100 dark:border-slate-900/60 bg-transparent p-4 space-y-3">
        {!isOpen ? (
          <div className="flex flex-col items-center gap-3.5 pt-1.5 select-none w-full">
            {/* Profile Avatar */}
            {currentUser && (
              <div title={`${currentUser.displayName} (${currentUser.role})`} className="cursor-pointer">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-900/80 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-[10px]">
                    {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            
            {/* Compact Settings Button */}
            <button
              onClick={() => {
                setIsOpen(true);
                setShowSettings(true);
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900/40 rounded-xl text-slate-455 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 transition-all flex items-center justify-center"
              title="Configure Settings"
            >
              <Settings className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        ) : (
          <>
            {/* Swappable Tenant & Role Identity Manager */}
            {currentUser && (
              <div className="space-y-3">
                {/* Beautiful Profile Card showing Avatar, Name, Email, Org & Role */}
                <div className="flex items-center gap-2.5 p-1.5 bg-transparent rounded-lg">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName}
                      className="w-7 h-7 rounded-full border border-slate-100 dark:border-slate-900/80 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-[9px] select-none">
                      {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                      {currentUser.displayName}
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    </h4>
                    <p className="text-[9px] text-slate-455 dark:text-slate-500 truncate leading-none">{currentUser.email}</p>
                    <p className="text-[8px] text-brand-505 dark:text-brand-400 font-bold uppercase tracking-wider mt-1 select-none">
                      {currentUser.organizationId || 'No Org'} • {currentUser.role}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Consolidated Actions Bar */}
            <div className="flex items-center gap-2 select-none relative">
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowPaletteDropdown(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.8 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium transition-all"
                title="Configure BYOK LLM and Workspace Backups"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400 dark:text-slate-550" />
                <span>Settings</span>
              </button>

              {/* Theme & Palette Switcher Dropdown Button */}
              <button
                type="button"
                onClick={() => {
                  setShowPaletteDropdown(!showPaletteDropdown);
                  setShowSettings(false);
                }}
                className="p-1.8 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-all flex items-center justify-center"
                title="Customize Theme & Color Palette"
              >
                {(() => {
                  const activePal = palettes.find(p => p.id === palette) || palettes[0];
                  return (
                    <div 
                      className="w-3.5 h-3.5 rounded border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer transition-transform hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${activePal.primary} 50%, ${activePal.accent} 50%)`
                      }}
                    />
                  );
                })()}
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={() => firebaseService.logout()}
                className="p-1.8 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-slate-500 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

        {/* Floating Customizer dropdown popup */}
        {showPaletteDropdown && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 absolute bottom-20 left-4 right-4 z-20 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2 select-none">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-250 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                🎨 Theme Customizer
              </span>
              <button 
                onClick={() => setShowPaletteDropdown(false)}
                className="text-[10px] text-slate-550 hover:text-slate-700 dark:hover:text-slate-300 font-bold"
              >
                Close
              </button>
            </div>

            {/* Mode Switcher inside dropdown */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest block">
                Workspace Theme Mode
              </span>
              <div className="flex bg-slate-100 dark:bg-slate-955 p-1 rounded-xl gap-1 text-[10px] font-bold select-none border border-slate-150 dark:border-slate-900">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                    theme === 'light'
                      ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                    theme === 'dark'
                      ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Mode</span>
                </button>
              </div>
            </div>

            {/* Palettes Grid */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest block">
                Color Palettes
              </span>
              <div className="grid grid-cols-5 gap-3 p-1">
                {palettes.map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => setPalette(pal.id)}
                    className={`w-9 h-9 rounded-xl border relative transition-all duration-200 shadow-sm flex items-center justify-center focus:outline-none group ${
                      palette === pal.id
                        ? 'border-brand-600 ring-2 ring-brand-500/25 scale-105'
                        : 'border-slate-200 dark:border-slate-800 hover:scale-105'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${pal.primary} 50%, ${pal.accent} 50%)`
                    }}
                    title={pal.name}
                  >
                    {palette === pal.id && (
                      <div className="w-4 h-4 bg-white/95 dark:bg-slate-950/95 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-[9px] font-extrabold text-brand-600 leading-none">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Floating Settings popup */}
        {showSettings && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 absolute bottom-20 left-4 right-4 z-20 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-250 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Settings className="w-3.5 h-3.5 text-brand-500" />
                BYOK Cloud Settings
              </span>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-[10px] text-slate-550 hover:text-slate-700 dark:hover:text-slate-300 font-bold"
              >
                Close
              </button>
            </div>

            {/* Tab Selectors */}
            <div className="flex bg-slate-100 dark:bg-slate-955 p-1 rounded-xl gap-1 text-[9px] font-bold select-none border border-slate-150 dark:border-slate-900">
              <button
                onClick={() => setSettingsTab('llm')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                  settingsTab === 'llm'
                    ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-205 dark:border-slate-850 shadow-xs'
                    : 'text-slate-505 hover:text-slate-800 dark:hover:text-slate-350'
                }`}
              >
                🤖 LLM
              </button>
              <button
                onClick={() => setSettingsTab('agents')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                  settingsTab === 'agents'
                    ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-205 dark:border-slate-850 shadow-xs'
                    : 'text-slate-505 hover:text-slate-800 dark:hover:text-slate-350'
                }`}
              >
                👥 Agents
              </button>
              <button
                onClick={() => setSettingsTab('backup')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                  settingsTab === 'backup'
                    ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-205 dark:border-slate-850 shadow-xs'
                    : 'text-slate-505 hover:text-slate-800 dark:hover:text-slate-350'
                }`}
              >
                💾 Backup
              </button>
              <button
                onClick={() => setSettingsTab('docs')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                  settingsTab === 'docs'
                    ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-205 dark:border-slate-850 shadow-xs'
                    : 'text-slate-505 hover:text-slate-800 dark:hover:text-slate-350'
                }`}
              >
                📖 Compliance
              </button>
            </div>

            {/* Content Tabs */}
            {settingsTab === 'agents' && (() => {
              const ALL_AGENTS: Array<{ id: AgentId; icon: string; name: string; title: string; color: string }> = [
                { id: 'analyst', icon: '📊', name: 'Ada', title: 'Senior Data Analyst', color: '#6366f1' },
                { id: 'cso', icon: '🎯', name: 'Marcus Vance', title: 'Business Strategist', color: '#10b981' },
                { id: 'logistics', icon: '🚚', name: 'Rajesh & Tareq', title: 'Supply Chain', color: '#f59e0b' },
                { id: 'auditor', icon: '🔎', name: 'Inspector Vance', title: 'Forensic Auditor', color: '#ef4444' },
                { id: 'growth', icon: '🚀', name: 'Zoe', title: 'Growth Partner', color: '#ec4899' },
                { id: 'engineer', icon: '⚙️', name: 'Silas', title: 'Data Engineer', color: '#06b6d4' },
                { id: 'compliance', icon: '🛡️', name: 'Elena Rostova', title: 'Compliance Officer', color: '#a855f7' },
                { id: 'product', icon: '📱', name: 'Kenji Sato', title: 'Product & UX Analyst', color: '#3b82f6' },
                { id: 'finance', icon: '💵', name: 'Sarah Jenkins', title: 'Chief Financial Officer', color: '#22c55e' },
                { id: 'marketing', icon: '📢', name: 'Maya Lin', title: 'Marketing Director', color: '#f43f5e' },
                { id: 'hr', icon: '🤝', name: 'Olivia Sterling', title: 'Chief HR Officer', color: '#f97316' },
              ];

              const handleToggleAgent = async (id: AgentId) => {
                let nextEnabled = [...enabledAgents];
                if (enabledAgents.includes(id)) {
                  if (enabledAgents.length === 1) return; // Prevent disabling all
                  nextEnabled = enabledAgents.filter(a => a !== id);
                } else {
                  if (enabledAgents.length >= 6) {
                    await showAlert("A maximum of 6 agents can be active at a time to optimize workspace performance. Please disable an agent before enabling another one.", "Agent Capacity Reached");
                    return;
                  }
                  nextEnabled = [...enabledAgents, id];
                }
                setEnabledAgents(nextEnabled);
                agentManager.setEnabledAgents(nextEnabled);
              };

              return (
                <div className="space-y-2 text-[10px] max-h-[220px] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-2 select-none">
                    {ALL_AGENTS.map((agent) => {
                      const isActive = enabledAgents.includes(agent.id);
                      const isLast = isActive && enabledAgents.length === 1;

                      return (
                        <div 
                          key={agent.id}
                          onClick={() => !isLast && handleToggleAgent(agent.id)}
                          className={`p-2 border rounded-xl flex items-center justify-between transition-all select-none ${
                            isActive 
                              ? 'bg-slate-50/50 dark:bg-slate-900/40 border-brand-500/20' 
                              : 'bg-transparent border-slate-200 dark:border-slate-900 opacity-60'
                          } ${isLast ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-1 h-5 rounded"
                              style={{ backgroundColor: agent.color }}
                            />
                            <div className="text-left">
                              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-250 uppercase tracking-wider block leading-none">
                                {agent.icon} {agent.name}
                              </span>
                              <span className="text-[7.5px] text-slate-500 font-medium font-sans">
                                {agent.title}
                              </span>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                            isActive 
                              ? 'bg-brand-500/10 border-brand-500 text-brand-500 shadow-sm' 
                              : 'border-slate-250 dark:border-slate-800 text-transparent'
                          }`}>
                            <span className="text-[10px] font-bold leading-none">✓</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {settingsTab === 'llm' && (
              <div className="space-y-2.5 text-[10px]">
                {/* Select Engine */}
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-semibold uppercase">Analytical Engine</label>
                  <select
                    value={apiSettings.selectedProvider}
                    onChange={(e) => handleSaveApiSettings('selectedProvider', e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
                  >
                    <option value="datums">Datums AI (Mistral - Free Shared)</option>
                    <option value="local">Local Smart Engine (Offline RAG)</option>
                    <option value="gemini">Google Gemini AI (BYOK)</option>
                    <option value="mistral">Mistral Cloud AI (BYOK)</option>
                    <option value="groq">Groq Cloud (Llama3)</option>
                  </select>
                </div>

                {apiSettings.selectedProvider !== 'local' && apiSettings.selectedProvider !== 'datums' && (
                  <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-slate-800/80">
                    {apiSettings.selectedProvider === 'gemini' && (
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-500 font-semibold uppercase">Gemini Cloud Key</label>
                        <input
                          type="password"
                          placeholder="AIzaSy..."
                          value={apiSettings.geminiKey}
                          onChange={(e) => handleSaveApiSettings('geminiKey', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 outline-none font-mono"
                        />
                      </div>
                    )}

                    {apiSettings.selectedProvider === 'mistral' && (
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-500 font-semibold uppercase">Mistral API Key</label>
                        <input
                          type="password"
                          placeholder="mistral-key..."
                          value={apiSettings.mistralKey}
                          onChange={(e) => handleSaveApiSettings('mistralKey', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 outline-none font-mono"
                        />
                      </div>
                    )}

                    {apiSettings.selectedProvider === 'groq' && (
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-500 font-semibold uppercase">Groq Cloud Key</label>
                        <input
                          type="password"
                          placeholder="gsk_..."
                          value={apiSettings.groqKey}
                          onChange={(e) => handleSaveApiSettings('groqKey', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 outline-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {settingsTab === 'backup' && (
              <div className="space-y-3.5 text-[10px] max-h-[250px] overflow-y-auto pr-1">
                {/* Export Section */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-880 rounded-xl space-y-2">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-1.5 uppercase tracking-wider text-[9px]">
                    <Download className="w-3 h-3 text-brand-500" /> Export Workspace
                  </h3>
                  <p className="text-slate-500 dark:text-slate-550 leading-relaxed">
                    Download your entire local database state (all tables saved in Vault) as a secure <code>.datums</code> project file.
                  </p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full py-1.5 bg-brand-600 hover:bg-brand-555 text-white rounded-lg text-[9px] font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Export Workspace File
                  </button>
                </div>

                {/* Import Section */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-1.5 uppercase tracking-wider text-[9px]">
                    <Upload className="w-3 h-3 text-brand-500" /> Restore Backup
                  </h3>
                  
                  {!importResult ? (
                    <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-4 transition-all duration-200 bg-white dark:bg-slate-950 text-center cursor-pointer group">
                      <input
                        type="file"
                        accept=".datums"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={importing}
                      />
                      <Upload className="w-5 h-5 text-slate-400 dark:text-slate-600 mx-auto mb-1.5 group-hover:scale-105 transition-transform" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">
                        {importing ? 'Processing File...' : 'Select Workspace File'}
                      </p>
                      <p className="text-[8.5px] text-slate-400 dark:text-slate-555 mt-0.5">
                        Accepts only <code>.datums</code> files
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* State Pills */}
                      {importResult.success ? (
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-500/20 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tamper-Evident Seal Verified
                          </div>
                          <div className="text-[8.5px] text-slate-550 dark:text-slate-455 font-medium leading-relaxed">
                            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Tables found ({importResult.tablesCount}):</div>
                            <div className="font-mono bg-white dark:bg-slate-955 p-1.5 border border-slate-150 dark:border-slate-900 rounded max-h-[60px] overflow-y-auto whitespace-pre-wrap select-text">
                              {importResult.tablesDetail}
                            </div>
                          </div>
                          
                          <div className="flex gap-1.5 pt-1">
                            <button
                              onClick={handleRestoreBackup}
                              className="flex-1 py-1.2 bg-emerald-650 hover:bg-emerald-600 text-white rounded-md text-[8.5px] font-bold shadow-xs transition-all flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Restore Workspace
                            </button>
                            <button
                              onClick={handleResetImport}
                              className="py-1.2 px-2 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md text-[8.5px] font-bold transition-all"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100 dark:border-rose-500/20 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-455 font-bold text-[9px] uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Tamper-Evident Validation Failure
                          </div>
                          <p className="text-[8.5px] text-rose-650 dark:text-rose-400 font-medium leading-relaxed font-mono select-text bg-white dark:bg-slate-955 p-1.5 border border-rose-100 dark:border-rose-900/50 rounded">
                            {importResult.error}
                          </p>
                          <button
                            onClick={handleResetImport}
                            className="w-full py-1.2 bg-rose-55 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-150 dark:border-rose-900/50 text-rose-650 dark:text-rose-400 rounded-md text-[8.5px] font-bold transition-all"
                          >
                            Reset & Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {settingsTab === 'docs' && (
              <div className="space-y-2 text-[10px] max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                <div className="flex flex-col gap-2 select-none">
                  {COMPLIANCE_DOCS.map((doc) => (
                    <div 
                      key={doc.id} 
                      onClick={() => setActiveDoc(doc)}
                      className="p-2.5 bg-slate-50 dark:bg-slate-955/60 border border-slate-200 dark:border-slate-850 hover:border-brand-500/30 rounded-xl space-y-1 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-extrabold text-slate-700 dark:text-slate-250 text-[9px] uppercase tracking-wider group-hover:text-brand-650 dark:group-hover:text-brand-400 transition-colors truncate">
                          {doc.title}
                        </span>
                        <span className="text-[6.5px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 shrink-0">
                          {doc.category.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-[8.5px] text-slate-550 dark:text-slate-500 leading-relaxed truncate">
                        {doc.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default Sidebar;
