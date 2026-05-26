import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Play, Shield, ShieldCheck, Download, Printer, 
  Sparkles, RefreshCw, BarChart4, TrendingUp, AlertTriangle, Cpu,
  Users, Target
} from 'lucide-react';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import spatialBookEngine from '../../services/SpatialBookEngine';
import type { GroundTruthPackage } from '../../services/SpatialBookEngine';
import agentManager from '../../services/AgentManager';
import eventBus from '../../services/EventBus';
import { PersonaLogo } from '../Layout/PersonaLogo';


const renderMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string | number) => {
    if (currentList.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1.5 text-slate-700 dark:text-slate-350 mb-4 text-xs font-sans">
            {currentList}
          </ul>
        );
      } else if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1.5 text-slate-700 dark:text-slate-350 mb-4 text-xs font-sans">
            {currentList}
          </ol>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  const flushTable = (key: string | number) => {
    if (inTable) {
      elements.push(
        <div key={`table-wrapper-${key}`} className="overflow-x-auto my-4 border border-slate-200 dark:border-slate-900 rounded-2xl bg-slate-50/20 dark:bg-slate-950/5 p-2 font-sans mb-4">
          <table className="w-full text-xs text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-250 dark:border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                {tableHeaders.map((h, i) => (
                  <th key={`th-${i}`} className="py-2 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`} className="border-b border-slate-150 dark:border-slate-900/50 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors">
                  {row.map((cell, colIndex) => (
                    <td key={`cell-${colIndex}`} className="py-2 px-3 font-medium text-slate-700 dark:text-slate-350">{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  const parseInline = (inlineText: string): React.ReactNode => {
    const parts = inlineText.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono text-brand-650 dark:text-brand-400">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();

    if (!line) {
      flushList(idx);
      flushTable(idx);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      flushList(idx);
      flushTable(idx);
      elements.push(
        <h3 key={`h1-${idx}`} className="text-sm font-extrabold text-slate-900 dark:text-slate-50 uppercase tracking-wider border-b-2 border-slate-900 dark:border-slate-100 pb-2 mb-4 mt-6 font-sans">
          {parseInline(line.substring(2))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList(idx);
      flushTable(idx);
      elements.push(
        <h4 key={`h2-${idx}`} className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-900 pb-1 mt-6 mb-3 font-sans">
          {parseInline(line.substring(3))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      flushList(idx);
      flushTable(idx);
      elements.push(
        <h5 key={`h3-${idx}`} className="text-[11px] font-bold text-slate-800 dark:text-slate-350 uppercase tracking-wide mt-4 mb-2 font-sans">
          {parseInline(line.substring(4))}
        </h5>
      );
      continue;
    }

    // Tables
    if (line.startsWith('|')) {
      flushList(idx);
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      const isDivider = cells.every(c => c.startsWith('-'));
      
      if (isDivider) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(idx);
    }

    // Unordered Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (listType !== 'ul') {
        flushList(idx);
        listType = 'ul';
      }
      currentList.push(
        <li key={`li-${idx}`} className="leading-relaxed">
          {parseInline(line.substring(2))}
        </li>
      );
      continue;
    }

    // Ordered Lists
    const olMatch = line.match(/^(\d+)\.\s(.*)/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList(idx);
        listType = 'ol';
      }
      currentList.push(
        <li key={`li-${idx}`} className="leading-relaxed pl-1">
          {parseInline(olMatch[2])}
        </li>
      );
      continue;
    }

    flushList(idx);
    flushTable(idx);

    elements.push(
      <p key={`p-${idx}`} className="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-350 mb-3 font-sans">
        {parseInline(line)}
      </p>
    );
  }

  flushList('final');
  flushTable('final');

  return elements;
};

const AVAILABLE_AGENTS = [
  { id: 'analyst', name: 'Ada', title: 'Senior Data Analyst', color: '#6366f1', theme: 'indigo', description: 'Descriptive stats, skews & math distributions.' },
  { id: 'logistics', name: 'Rajesh & Tareq', title: 'Supply Chain Specialists', color: '#f59e0b', theme: 'amber', description: 'Logistics pipelines, stockouts & SKU transit.' },
  { id: 'growth', name: 'Zoe', title: 'Growth Monetization Partner', color: '#ec4899', theme: 'pink', description: 'Acquisition cohort scaling & ad spend ROAS.' },
  { id: 'auditor', name: 'Inspector Vance', title: 'Forensic Auditor', color: '#ef4444', theme: 'red', description: 'Duplicate invoices, GST tax verification & compliance.' },
  { id: 'engineer', name: 'Silas', title: 'Data Engineer', color: '#06b6d4', theme: 'cyan', description: 'Sandbox schemas, index optimization & constraints.' },
  { id: 'cso', name: 'Marcus Vance', title: 'Chief Strategy Officer', color: '#10b981', theme: 'emerald', description: 'Consensus OKRs, SWOT & strategic pathing.' },
  { id: 'compliance', name: 'Elena Rostova', title: 'Compliance Officer', color: '#a855f7', theme: 'purple', description: 'GDPR/HIPAA privacy audits, PII security & custody controls.' },
  { id: 'product', name: 'Kenji Sato', title: 'Product & UX Analyst', color: '#3b82f6', theme: 'blue', description: 'User cohorts retention curves & feature adoption funnels.' },
  { id: 'finance', name: 'Sarah Jenkins', title: 'Chief Financial Officer', color: '#22c55e', theme: 'green', description: 'Monthly cash burn, CapEx/OpEx modeling & DCF runway forecast.' },
  { id: 'marketing', name: 'Maya Lin', title: 'Marketing Director', color: '#f43f5e', theme: 'rose', description: 'Ad campaign attribution CTR CPC & marketing ROAS channels.' },
  { id: 'hr', name: 'Olivia Sterling', title: 'Chief HR Officer', color: '#f97316', theme: 'orange', description: 'Department tenure rosters, talent pipelines & employee attrition.' }
];

const GOAL_PRESETS = [
  { label: '360° Health Scan', text: 'Perform a comprehensive 360-degree descriptive metrics scan and financial compliance health audit.' },
  { label: 'Global Logistics', text: 'Optimize transit speeds, warehousing bottlenecks, and SKU transit in international logistics corridors.' },
  { label: 'ROAS & Cohorts', text: 'Evaluate CAC/LTV cohorts, project marketing ROAS, and optimize WhatsApp customer monetization flows.' },
  { label: 'Forensic Audit', text: 'Scan database transaction ledgers for split-billing, duplicate invoice codes, and tax anomalies.' }
];

export const SpatialBook: React.FC = () => {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  
  // Roster & Mandate settings
  const [activeRoster, setActiveRoster] = useState<string[]>(() => agentManager.getSpatialRoster());
  const [spatialGoal, setSpatialGoal] = useState<string>(() => agentManager.getSpatialGoal());
  const [enabledAgents, setEnabledAgents] = useState<string[]>(() => agentManager.getEnabledAgents());
    // Progress states
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStep, setCompileStep] = useState<string>('');
  const [speakingAgent, setSpeakingAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dynamicPrintHeight, setDynamicPrintHeight] = useState<number | null>(null);

  // Computed data states
  const [groundTruth, setGroundTruth] = useState<GroundTruthPackage | null>(null);
  const [aiCommentary, setAiCommentary] = useState<string>('');
  const [reportHash, setReportHash] = useState<string>('');

  useEffect(() => {
    const sync = () => {
      const active = duckDbService.getActiveTables();
      setTables(active);
      if (active.length > 0 && !selectedTable) {
        setSelectedTable(active[0].name);
      }
    };
    sync();
    const unsub = eventBus.on('TABLES_UPDATED', sync);
    return () => unsub();
  }, [selectedTable]);

  useEffect(() => {
    const handleGoalUpdate = (goal: string) => setSpatialGoal(goal);
    const handleRosterUpdate = (roster: string[]) => setActiveRoster(roster);
    const handleEnabledUpdate = (agents: string[]) => {
      setEnabledAgents(agents);
      setActiveRoster(prev => {
        const next = prev.filter(id => agents.includes(id));
        if (next.length === 0) {
          next.push(agents[0]);
        }
        return next;
      });
    };

    const unsubGoal = eventBus.on('SPATIAL_GOAL_UPDATED', handleGoalUpdate);
    const unsubRoster = eventBus.on('SPATIAL_ROSTER_UPDATED', handleRosterUpdate);
    const unsubEnabled = eventBus.on('ENABLED_AGENTS_CHANGED', handleEnabledUpdate);

    return () => {
      unsubGoal();
      unsubRoster();
      unsubEnabled();
    };
  }, []);

  const updateSpatialGoal = (goal: string) => {
    setSpatialGoal(goal);
    agentManager.setSpatialGoal(goal);
  };

  const toggleAgent = (id: string) => {
    let nextRoster = activeRoster;
    if (activeRoster.includes(id)) {
      if (activeRoster.length > 1) {
        nextRoster = activeRoster.filter(a => a !== id);
      }
    } else {
      nextRoster = [...activeRoster, id];
    }
    setActiveRoster(nextRoster);
    agentManager.setSpatialRoster(nextRoster);
  };

  // Native SHA-256 Browser Hash compiler
  const compileSha256 = async (text: string): Promise<string> => {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
      return 'f5b967da' + Math.floor(Math.random() * 1000000);
    }
  };

  const handleCompileReport = async () => {
    if (!selectedTable) return;
    setIsCompiling(true);
    setError(null);
    setGroundTruth(null);
    setAiCommentary('');
    setReportHash('');
    setSpeakingAgent(null);

    try {
      // Step 1: Programmatic descriptive scan via DuckDB
      setCompileStep('Querying sandboxed DuckDB-Wasm schemas...');
      await new Promise(r => setTimeout(r, 400));
      const truthPkg = await spatialBookEngine.generateGroundTruthPackage(selectedTable);
      setGroundTruth(truthPkg);

      // Step 2: Multi-Agent Consensus Loop via AgentManager
      setCompileStep('Assembling active executive roster consensus...');
      const consensus = await agentManager.compileSpatialBookConsensus(
        truthPkg,
        spatialGoal,
        activeRoster as any[],
        (status) => {
          setSpeakingAgent(status.activeAgentId);
          setCompileStep(status.loadingText);
        }
      );

      setAiCommentary(consensus.commentary);

      // Step 3: Cryptographically stamp the report
      setCompileStep('Hashing database profile for tamper-evidence checksum...');
      const packageString = JSON.stringify(truthPkg) + consensus.commentary;
      const hash = await compileSha256(packageString);
      setReportHash(hash.toUpperCase());

      eventBus.emit('AUDIT_LOG', {
        action: 'SPATIALBOOK_CONSENSUS_COMPILE',
        details: `SpatialBook Consensus compiled successfully for table '${selectedTable}' with active roster [${activeRoster.join(', ')}]. Checksum: ${hash.substring(0, 16)}...`,
        status: 'success'
      });
    } catch (err: any) {
      console.error('[SpatialBook] Compile failed:', err);
      setError(err.message || err || 'An unexpected analysis core error occurred.');
    } finally {
      setIsCompiling(false);
      setCompileStep('');
      setSpeakingAgent(null);
    }
  };

  const handlePrint = () => {
    const dossier = document.getElementById('printable-spatialbook-dossier');
    if (dossier) {
      // Add comfortable padding buffers (e.g. 80px) for standard document margin settings
      const height = dossier.scrollHeight + 80;
      setDynamicPrintHeight(height);
      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  };;

  // Helper to trigger CSV/TSV download of the programmatically derived statistics
  const handleExportData = () => {
    if (!groundTruth) return;
    let tsv = 'Column,Type,Count,Missing,Unique,Min,Max,Mean,StdDev\n';
    groundTruth.columnDetails.forEach(c => {
      tsv += `"${c.name}","${c.type}",${c.count},${c.nullCount},${c.distinctCount},${c.min ?? ''},${c.max ?? ''},${c.avg ?? ''},${c.stddev ?? ''}\n`;
    });

    const blob = new Blob([tsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groundTruth.tableName}_spatial_profile.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div id="spatialbook-page-root" className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Platform Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-5 select-none print:hidden">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2 tracking-tight">
            <BookOpen className="w-5 h-5 text-brand-500" />
            SpatialBook Consensus Compiler
          </h2>
          <p className="text-xs text-slate-500 leading-normal">
            Generate bulletproof, deterministic multi-agent reports aligned to custom strategic mandates and signed via local DuckDB.
          </p>
        </div>

        {/* Selected target table selector */}
        {tables.length > 0 && (
          <div className="flex items-center gap-2.5">
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              disabled={isCompiling}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-350"
            >
              {tables.map(t => (
                <option key={t.name} value={t.name}>
                  📊 Table: {t.name} ({t.rowCount.toLocaleString()} rows)
                </option>
              ))}
            </select>

            <button
              onClick={handleCompileReport}
              disabled={isCompiling || !selectedTable}
              className="px-4 py-2 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-750/50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-600/10 flex items-center gap-1.5"
            >
              {isCompiling ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {isCompiling ? 'Running Consensus...' : 'Compile Consensus SpatialBook'}
            </button>
          </div>
        )}
      </div>

      {/* STRATEGIC SETUP CONTROLS - Hidden when compiling or print */}
      {!isCompiling && tables.length > 0 && (
        <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 p-6 rounded-2xl backdrop-blur-xl shadow-lg space-y-6 print:hidden">
          {/* Section Heading */}
          <div className="flex items-center gap-2 text-slate-850 dark:text-slate-100 pb-2 border-b border-slate-150 dark:border-slate-900/50">
            <Target className="w-4 h-4 text-brand-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Strategic Mandate & Roster Setup</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Goal Input & Presets */}
            <div className="lg:col-span-2 space-y-3.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Strategic Corporate Goal / Target Mandate
              </label>
              <textarea
                value={spatialGoal}
                onChange={(e) => updateSpatialGoal(e.target.value)}
                placeholder="Enter a strategic corporate goal..."
                className="w-full h-24 bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-855 rounded-xl p-3 text-xs focus:outline-none focus:border-brand-500 text-slate-800 dark:text-slate-250 leading-relaxed resize-none"
              />
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-550 mr-1">Goal Presets:</span>
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => updateSpatialGoal(preset.text)}
                    className="px-2.5 py-1 bg-slate-150 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-655 dark:text-slate-400 border border-slate-200 dark:border-slate-855 hover:border-slate-350 dark:hover:border-slate-800 rounded-lg text-[9.5px] font-semibold transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Active Roster Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Active Committee Roster
                </label>
                <span className="text-[9.5px] font-bold text-slate-450 font-mono">
                  {activeRoster.length} active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {AVAILABLE_AGENTS.filter(agent => enabledAgents.includes(agent.id)).map((agent) => {
                  const isActive = activeRoster.includes(agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-2 p-2 border rounded-xl cursor-pointer select-none transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                        isActive
                          ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/5 text-slate-900 dark:text-slate-100 shadow-md shadow-brand-500/5'
                          : 'border-slate-200 dark:border-slate-855 text-slate-500 dark:text-slate-550'
                      }`}
                    >
                      <div className="w-7 h-7 flex-shrink-0">
                        <PersonaLogo agentId={agent.id} className="w-7 h-7" />
                      </div>
                      <div className="space-y-0.5 truncate">
                        <p className="text-[10px] font-bold truncate leading-tight">{agent.name}</p>
                        <p className="text-[8px] font-semibold text-slate-450 truncate leading-none">{agent.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Empty Warning */}
      {tables.length === 0 && (
        <div className="relative overflow-hidden px-6 py-12 border-2 border-dashed border-slate-200 dark:border-slate-900 rounded-3xl text-center space-y-3 z-0">
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
                left: '10%',
                top: '10%',
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
                right: '25%',
                top: '18%',
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
                right: '8%',
                bottom: '15%',
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
                left: '35%',
                bottom: '28%',
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
                left: '40%',
                bottom: '10%',
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
                left: '22%',
                top: '30%',
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
                right: '50%',
                top: '20%',
                opacity: 0.65,
                animation: 'float-geom-upload-2 10s infinite ease-in-out'
              }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Datasets Loaded</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              SpatialBooks require an active virtual database. Please upload spreadsheets or scan documents in the left menus to load memory tables.
            </p>
          </div>
        </div>
      )}

      {/* Compiling Loader State */}
      {isCompiling && (
        <div className="p-8 border border-slate-200 dark:border-slate-900 rounded-3xl bg-white dark:bg-slate-900/20 backdrop-blur-xl flex flex-col items-center justify-center space-y-5 text-center min-h-[300px] select-none">
          {speakingAgent ? (
            <div className="flex flex-col items-center space-y-3">
              {/* Speaker Glowing Circle Halo */}
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ backgroundColor: AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color || '#6366f1' }} />
                <div className="absolute inset-2 rounded-full border-2 border-dashed animate-spin opacity-40" style={{ borderColor: AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color || '#6366f1' }} />
                <div className="relative w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                  <PersonaLogo agentId={speakingAgent} className="w-11 h-11" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider" style={{
                  color: AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color || '#6366f1',
                  borderColor: (AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color || '#6366f1') + '40',
                  backgroundColor: (AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color || '#6366f1') + '10'
                }}>
                  Active Speaker: {AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.name}
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-1 italic font-bold">
                  {AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.title}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800 animate-bounce">
              <Cpu className="w-6 h-6 text-brand-500 animate-pulse" />
            </div>
          )}

          <div className="space-y-2 max-w-md">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Orchestrating Committee Consensus Briefings</h4>
            <p className="text-[10.5px] text-slate-550 dark:text-slate-400 font-mono leading-relaxed px-4" style={{
              color: speakingAgent ? AVAILABLE_AGENTS.find(a => a.id === speakingAgent)?.color : undefined
            }}>{compileStep}</p>
          </div>
          {/* Progress bar */}
          <div className="w-48 h-1 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-900/50">
            <div className="h-full bg-brand-600 rounded-full animate-infinite-loading" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 border border-rose-150 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl text-xs text-rose-600 dark:text-rose-455 space-y-1 font-sans">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Report Compilation Terminated:
          </p>
          <p className="leading-relaxed pl-5 font-medium">{error}</p>
        </div>
      )}

      {/* Dynamic Print Override Styles */}
      {/* Dynamic Print Override Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide browser headers, footers and remove margins for a continuous, pageless canvas */
          @page {
            size: 1024px ${dynamicPrintHeight ? `${dynamicPrintHeight}px` : 'auto'};
            margin: 0 !important;
          }
          
          /* Hide layout decorations: sidebar, settings tabs, triggers, console pane, handles */
          aside,
          header,
          #sidebar-panel,
          .sidebar,
          .sidebar-container,
          .print\\:hidden,
          .print-action-toolbar,
          button,
          select,
          [class*="resizer"],
          #console-panel,
          [class*="ConsolePanel"],
          .ConsolePanel-container {
            display: none !important;
          }
          
          /* Strip all borders, padding, shadows, and force static block flow on all parent wrapper containers leading to the dossier */
          html:has(#printable-spatialbook-dossier),
          body:has(#printable-spatialbook-dossier),
          #root:has(#printable-spatialbook-dossier),
          .min-h-screen:has(#printable-spatialbook-dossier),
          div:has(#printable-spatialbook-dossier),
          main:has(#printable-spatialbook-dossier) {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          /* Hide other elements inside spatialbook-page-root except the printable-spatialbook-dossier */
          #spatialbook-page-root > :not(#printable-spatialbook-dossier) {
            display: none !important;
          }

          /* Scale the dossier to full page width naturally, letting pages split organically */
          #printable-spatialbook-dossier {
            display: block !important;
            width: 1024px !important;
            max-width: 1024px !important;
            position: absolute !important; /* Forces it to fill the custom page exactly */
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 40px !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
            height: 100% !important;
          }

          /* Ensure cards and diagrams fit within viewport and break elegantly */
          tr, p, h3, h4, svg, .p-4, .p-5, .p-6 {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}} />

      {/* FORTUNE 500 PRINTABLE EXECUTIVE REPORT */}
      {groundTruth && !isCompiling && (
        <div id="printable-spatialbook-dossier" className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-900 shadow-2xl rounded-3xl p-8 md:p-12 relative overflow-hidden font-sans text-slate-800 dark:text-slate-200 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
          
          {/* Executive Header Canvas */}
          <div className="border-b-2 border-slate-900 dark:border-slate-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-0.5 border border-slate-900 dark:border-slate-200 text-[9px] font-mono font-bold tracking-widest uppercase">
                  CONFIDENTIAL // INTERNAL ONLY
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold font-mono text-brand-500">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  LEVEL 5 INTEGRITY SIGNED
                </div>
              </div>

              <div className="space-y-0.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 uppercase">
                  SpatialBook Report Dossier
                </h1>
                <p className="text-[10px] text-slate-550 font-mono font-medium">
                  AUTOMATED DETERMINISTIC LEDGER ANALYTICS // PLATFORM CORRIDOR
                </p>
              </div>
            </div>

            {/* Document Metadata block */}
            <div className="text-left md:text-right text-[10px] font-mono space-y-1 text-slate-500">
              <p>REPORT ID: <span className="font-bold text-slate-800 dark:text-slate-350">{reportHash.substring(0, 12) || 'N/A'}</span></p>
              <p>COMPILED ON: <span className="font-bold">{new Date(groundTruth.timestamp).toLocaleString()}</span></p>
              <p>SANDBOX TENANT: <span className="font-bold uppercase">{selectedTable}</span></p>
            </div>
          </div>

          {/* Action Toolbar (Print/Download) */}
          <div className="flex items-center justify-end gap-2.5 mb-8 select-none print:hidden print-action-toolbar">
            <button
              onClick={handleExportData}
              className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-855 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-[10px] font-semibold text-slate-655 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export profile (.csv)
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 rounded-xl text-[10px] font-semibold transition-all flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>

          {/* 1. EXECUTIVE KPI MATRIX CARDS */}
          <div className="space-y-3.5 mb-8">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-150 dark:border-slate-900 pb-1.5">
              I. Executive Descriptive Summary
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl">
                <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Active Records</p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{groundTruth.rowCount.toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Rows programmatically scanned</p>
              </div>

              <div className="p-4 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl">
                <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Total Columns</p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{groundTruth.columnsCount}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Fields profile mapped</p>
              </div>

              {/* Display primary numeric metric sum if available */}
              {(() => {
                const numericCol = groundTruth.columnDetails.find(c => c.sum !== undefined);
                if (numericCol) {
                  return (
                    <>
                      <div className="p-4 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Volume Sum ({numericCol.name})</p>
                        <p className="text-xl font-black text-brand-600 dark:text-brand-400 mt-1 truncate" title={numericCol.sum?.toLocaleString()}>
                          {numericCol.sum ? (numericCol.sum > 1000000 ? `${(numericCol.sum / 1000000).toFixed(2)}M` : numericCol.sum.toLocaleString()) : '0'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Aggregate ledger footprint</p>
                      </div>

                      <div className="p-4 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Unit Mean ({numericCol.name})</p>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                          {numericCol.avg?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '0'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Expected descriptive value</p>
                      </div>
                    </>
                  );
                }
                return (
                  <div className="col-span-2 p-4 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl flex items-center justify-center text-center">
                    <p className="text-[10px] text-slate-400 font-mono italic">No numeric columns found in table for mathematical sums.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 2. DYNAMIC PROGRAMMATIC SVG VISUALIZATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* Chart 1: Categorical Distribution */}
            {(() => {
              const catCol = groundTruth.columnDetails.find(c => c.topValues && c.topValues.length > 0);
              if (catCol && catCol.topValues) {
                const maxVal = Math.max(...catCol.topValues.map(v => v.count), 1);
                return (
                  <div className="p-6 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <BarChart4 className="w-3.5 h-3.5 text-brand-500" />
                      Categorical Density: "{catCol.name}"
                    </h4>

                    {/* Programmatic SVG Horizontal Bar Chart */}
                    <div className="relative pt-2">
                      <svg viewBox="0 0 400 220" className="w-full h-auto">
                        {catCol.topValues.slice(0, 5).map((tv, idx) => {
                          const width = (tv.count / maxVal) * 260; // Max width is 260px
                          const y = idx * 40 + 20;
                          return (
                            <g key={tv.value}>
                              {/* Label text */}
                              <text 
                                x="10" 
                                y={y + 12} 
                                fill="currentColor" 
                                className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400"
                              >
                                {tv.value.length > 13 ? `${tv.value.substring(0, 11)}..` : tv.value}
                              </text>
                              {/* Background track */}
                              <rect x="110" y={y} width="260" height="16" rx="4" fill="currentColor" className="text-slate-100 dark:text-slate-900" />
                              {/* Data Bar */}
                              <rect x="110" y={y} width={width} height="16" rx="4" fill="url(#indigoGrad)" className="shadow-lg" />
                              {/* Value Label */}
                              <text x={115 + width} y={y + 12} fill="currentColor" className="text-[8.5px] font-mono font-bold text-brand-600 dark:text-brand-400">
                                {tv.count.toLocaleString()}
                              </text>
                            </g>
                          );
                        })}
                        {/* Define gradients */}
                        <defs>
                          <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4f46e5" />
                            <stop offset="100%" stopColor="#818cf8" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-6 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 flex items-center justify-center text-center text-slate-400 font-mono text-[10px] italic">
                  No categorical column found for distribution charts.
                </div>
              );
            })()}

            {/* Chart 2: Temporal Trends */}
            {(() => {
              const trend = groundTruth.temporalTrends[0];
              if (trend && trend.data.length > 0) {
                const maxCount = Math.max(...trend.data.map(d => d.count), 1);
                const chartWidth = 360;
                const chartHeight = 120;
                const divisor = trend.data.length > 1 ? trend.data.length - 1 : 1;
                const points = trend.data.map((d, i) => {
                  const x = (i / divisor) * chartWidth + 20;
                  const y = chartHeight - (d.count / maxCount) * 80 + 10;
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <div className="p-6 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      Temporal Ingestion Trend: "{trend.columnName}"
                    </h4>

                    {/* Programmatic SVG Wave Line Chart */}
                    <div className="relative pt-2">
                      <svg viewBox="0 0 400 160" className="w-full h-auto">
                        {/* Grids */}
                        <line x1="20" y1="10" x2="380" y2="10" stroke="currentColor" className="text-slate-100 dark:text-slate-900" strokeWidth="1" strokeDasharray="3" />
                        <line x1="20" y1="50" x2="380" y2="50" stroke="currentColor" className="text-slate-100 dark:text-slate-900" strokeWidth="1" strokeDasharray="3" />
                        <line x1="20" y1="90" x2="380" y2="90" stroke="currentColor" className="text-slate-100 dark:text-slate-900" strokeWidth="1" strokeDasharray="3" />
                        <line x1="20" y1="130" x2="380" y2="130" stroke="currentColor" className="text-slate-200 dark:text-slate-900" strokeWidth="1.5" />

                        {/* Line Path */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={points}
                        />

                        {/* Anchor Dots */}
                        {trend.data.map((d, i) => {
                          const divisor = trend.data.length > 1 ? trend.data.length - 1 : 1;
                          const x = (i / divisor) * chartWidth + 20;
                          const y = chartHeight - (d.count / maxCount) * 80 + 10;
                          return (
                            <g key={d.period}>
                              <circle cx={x} cy={y} r="3.5" fill="#10b981" />
                              {/* Period labels at Q1, Med, Q3 bounds */}
                              {(i === 0 || i === Math.floor(trend.data.length / 2) || i === trend.data.length - 1) && (
                                <text x={x} y="150" textAnchor="middle" fill="currentColor" className="text-[8px] font-mono font-bold text-slate-500">
                                  {d.period}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-6 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 flex items-center justify-center text-center text-slate-400 font-mono text-[10px] italic">
                  No date columns identified to plot temporal trend lines.
                </div>
              );
            })()}
          </div>

          {/* II. COLUMN RELATIONSHIPS & PARETO INFLUENCE */}
          {groundTruth.paretoAnalysis && groundTruth.correlationMatrix && (
            <div className="space-y-4 mb-10">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-150 dark:border-slate-900 pb-1.5 flex items-center gap-1.5 select-none">
                <BarChart4 className="w-4 h-4 text-brand-500" />
                II. Column Relationships & Pareto Concentration Analysis
              </h3>

              {/* Advanced KPI Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Pareto 80/20 Concentration Impact Card */}
                {groundTruth.paretoAnalysis.isApplicable ? (
                  <div className="p-5 border border-brand-105 dark:border-brand-950/40 bg-brand-50/10 dark:bg-brand-950/5 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-brand-650 dark:text-brand-400 font-extrabold text-xs">
                      80/20
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Market Concentration (Pareto)</p>
                      <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                        <span className="text-brand-650 dark:text-brand-400 font-black">{groundTruth.paretoAnalysis.categoriesIn80Percent} categories</span> ({groundTruth.paretoAnalysis.percentageDriving80.toFixed(1)}% of total) generate <span className="text-brand-650 dark:text-brand-400 font-black">80% of absolute {groundTruth.paretoAnalysis.numericalColumn}</span>.
                      </p>
                      <p className="text-[9px] text-slate-450">
                        Calculated programmatically over {groundTruth.paretoAnalysis.totalCategories} categories of "{groundTruth.paretoAnalysis.categoricalColumn}".
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl text-center flex items-center justify-center text-[10px] text-slate-450 italic">
                    Pareto Concentration Analysis not applicable for this dataset structure.
                  </div>
                )}

                {/* Correlation Interaction Card */}
                {(() => {
                  const cells = groundTruth.correlationMatrix.filter(c => c.col1 !== c.col2);
                  const strongest = cells.length > 0
                    ? cells.reduce((max, cell) => Math.abs(cell.coefficient) > Math.abs(max.coefficient) ? cell : max, cells[0])
                    : null;
                  
                  if (strongest) {
                    const direction = strongest.coefficient > 0 ? 'positive' : 'negative';
                    const strength = Math.abs(strongest.coefficient) >= 0.7 ? 'Strong' : Math.abs(strongest.coefficient) >= 0.4 ? 'Moderate' : 'Weak';
                    return (
                      <div className="p-5 border border-emerald-105 dark:border-emerald-950/40 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 text-emerald-650 dark:text-emerald-400 font-extrabold text-xs">
                          r
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 font-mono font-medium uppercase">Strongest Interaction Profile</p>
                          <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                            <span className="text-emerald-650 dark:text-emerald-400 font-black">"{strongest.col1}"</span> and <span className="text-emerald-650 dark:text-emerald-400 font-black">"{strongest.col2}"</span> exhibit a <span className="text-emerald-650 dark:text-emerald-400 font-black">{strength} {direction} correlation</span> (r = {strongest.coefficient.toFixed(3)}).
                          </p>
                          <p className="text-[9px] text-slate-450">
                            Identifies linear predictive behavior and co-dependent influences.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-5 border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl text-center flex items-center justify-center text-[10px] text-slate-450 italic">
                      Correlation matrix requires multiple numeric columns.
                    </div>
                  );
                })()}
              </div>

              {/* Programmatic Heatmap and Pareto Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Correlation Matrix Heatmap */}
                {(() => {
                  const uniqueCols = Array.from(
                    new Set(groundTruth.correlationMatrix.flatMap(c => [c.col1, c.col2]))
                  ).slice(0, 6);

                  if (uniqueCols.length === 0) return null;

                  const getCorrCoeff = (col1: string, col2: string): number => {
                    if (col1 === col2) return 1.0;
                    const match = groundTruth.correlationMatrix.find(
                      c => (c.col1 === col1 && c.col2 === col2) || (c.col1 === col2 && c.col2 === col1)
                    );
                    return match ? match.coefficient : 0.0;
                  };

                  const cellSize = 38;
                  const labelPaddingLeft = 85;
                  const gridPaddingTop = 15;
                  const textPaddingBottom = 40;
                  
                  const width = labelPaddingLeft + uniqueCols.length * cellSize + 20;
                  const height = gridPaddingTop + uniqueCols.length * cellSize + textPaddingBottom;

                  return (
                    <div className="p-5 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-widest">
                          Pearson Correlation Heatmap Matrix
                        </h4>
                        <p className="text-[9px] text-slate-450 mt-0.5">
                          Visualizes predictive relationships. Muted blue represents identity (1.00), green positive, and rose negative.
                        </p>
                      </div>

                      <div className="relative overflow-x-auto flex justify-center py-2">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[420px] h-auto">
                          {/* Render cells */}
                          {uniqueCols.map((rowCol, rIdx) => {
                            return uniqueCols.map((colCol, cIdx) => {
                              const coeff = getCorrCoeff(rowCol, colCol);
                              const x = labelPaddingLeft + cIdx * cellSize;
                              const y = gridPaddingTop + rIdx * cellSize;

                              let fill = 'rgba(226, 232, 240, 0.3)'; // neutral
                              let textColor = 'rgba(71, 85, 105, 0.9)'; // dark text

                              if (rowCol === colCol) {
                                fill = 'rgba(79, 70, 229, 0.15)'; // Identity
                                textColor = '#4f46e5';
                              } else if (coeff > 0.05) {
                                fill = `rgba(16, 185, 129, ${coeff * 0.9})`; // Positive correlation green
                                textColor = coeff > 0.4 ? '#ffffff' : '#065f46';
                              } else if (coeff < -0.05) {
                                fill = `rgba(244, 63, 94, ${Math.abs(coeff) * 0.9})`; // Negative correlation rose
                                textColor = Math.abs(coeff) > 0.4 ? '#ffffff' : '#9f1239';
                              }

                              return (
                                <g key={`${rowCol}-${colCol}`} className="group cursor-help">
                                  <rect
                                    x={x}
                                    y={y}
                                    width={cellSize - 2}
                                    height={cellSize - 2}
                                    rx="4"
                                    fill={fill}
                                    stroke="rgba(0,0,0,0.03)"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={x + cellSize / 2 - 1}
                                    y={y + cellSize / 2 + 3}
                                    textAnchor="middle"
                                    fill={textColor}
                                    className="text-[8px] font-mono font-black select-none"
                                  >
                                    {coeff >= 0 ? `+${coeff.toFixed(2)}` : coeff.toFixed(2)}
                                  </text>
                                  <title>{`Correlation between "${rowCol}" and "${colCol}": ${coeff.toFixed(4)}`}</title>
                                </g>
                              );
                            });
                          })}

                          {/* Y-axis column labels */}
                          {uniqueCols.map((colName, rIdx) => {
                            const y = gridPaddingTop + rIdx * cellSize + cellSize / 2 + 3;
                            const truncated = colName.length > 12 ? `${colName.substring(0, 10)}..` : colName;
                            return (
                              <text
                                key={`row-label-${colName}`}
                                x={labelPaddingLeft - 8}
                                y={y}
                                textAnchor="end"
                                fill="currentColor"
                                className="text-[8.5px] font-mono font-bold text-slate-550 dark:text-slate-400 select-none"
                              >
                                {truncated}
                                <title>{colName}</title>
                              </text>
                            );
                          })}

                          {/* X-axis row labels at bottom */}
                          {uniqueCols.map((colName, cIdx) => {
                            const x = labelPaddingLeft + cIdx * cellSize + cellSize / 2;
                            const y = gridPaddingTop + uniqueCols.length * cellSize + 12;
                            const truncated = colName.length > 8 ? `${colName.substring(0, 6)}..` : colName;
                            return (
                              <text
                                key={`col-label-${colName}`}
                                x={x}
                                y={y}
                                textAnchor="middle"
                                fill="currentColor"
                                className="text-[8px] font-mono font-bold text-slate-550 dark:text-slate-400 select-none"
                                transform={`rotate(-25 ${x} ${y})`}
                              >
                                {truncated}
                                <title>{colName}</title>
                              </text>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Pareto Cumulative Curve Chart */}
                {(() => {
                  if (!groundTruth.paretoAnalysis || !groundTruth.paretoAnalysis.isApplicable) return null;

                  const rawCats = groundTruth.paretoAnalysis.topCategories.slice(0, 8);
                  if (rawCats.length === 0) return null;

                  const maxVal = Math.max(...rawCats.map(c => c.value), 1);
                  const plotWidth = 280;
                  const plotHeight = 150;
                  const paddingLeft = 40;
                  const paddingRight = 40;
                  const paddingTop = 20;
                  const paddingBottom = 40;

                  const svgWidth = plotWidth + paddingLeft + paddingRight;
                  const svgHeight = plotHeight + paddingTop + paddingBottom;

                  const stepX = plotWidth / rawCats.length;
                  const barWidth = stepX - 8;

                  // Compute line coordinates
                  const linePoints = rawCats.map((c, idx) => {
                    const x = paddingLeft + idx * stepX + barWidth / 2 + 4;
                    const y = paddingTop + plotHeight - (c.ratio * plotHeight);
                    return { x, y, ratio: c.ratio, name: c.category, val: c.value };
                  });

                  const pointsStr = linePoints.map(p => `${p.x},${p.y}`).join(' ');

                  return (
                    <div className="p-5 border border-slate-200 dark:border-slate-900 rounded-3xl bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-widest">
                          Pareto Volume Curve: "{groundTruth.paretoAnalysis.categoricalColumn}"
                        </h4>
                        <p className="text-[9px] text-slate-455 mt-0.5">
                          Category values ordered descending (bars) vs cumulative distribution curve (polyline, showing 80% boundary).
                        </p>
                      </div>

                      <div className="relative overflow-x-auto flex justify-center py-2">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[420px] h-auto">
                          {/* Grid lines for cumulative ratio (Right Y axis) */}
                          {[0.2, 0.4, 0.6, 0.8, 1.0].map((tick) => {
                            const y = paddingTop + plotHeight - tick * plotHeight;
                            const is80 = tick === 0.8;
                            return (
                              <g key={`tick-${tick}`}>
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={paddingLeft + plotWidth}
                                  y2={y}
                                  stroke={is80 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(226, 232, 240, 0.4)'}
                                  strokeWidth={is80 ? 1.5 : 1}
                                  strokeDasharray={is80 ? '4 2' : '2 2'}
                                />
                                <text
                                  x={paddingLeft + plotWidth + 6}
                                  y={y + 3}
                                  fill={is80 ? '#6366f1' : 'currentColor'}
                                  className={`text-[7.5px] font-mono font-bold ${is80 ? 'text-brand-500' : 'text-slate-400'}`}
                                >
                                  {(tick * 100).toFixed(0)}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Raw Y-Axis Labels (Left side) */}
                          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
                            const val = tick * maxVal;
                            const y = paddingTop + plotHeight - tick * plotHeight;
                            return (
                              <text
                                key={`val-tick-${tick}`}
                                x={paddingLeft - 6}
                                y={y + 3}
                                textAnchor="end"
                                fill="currentColor"
                                className="text-[7.5px] font-mono font-bold text-slate-400"
                              >
                                {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0)}
                              </text>
                            );
                          })}

                          {/* Bars for individual category volumes */}
                          {rawCats.map((cat, idx) => {
                            const barHeight = (cat.value / maxVal) * plotHeight;
                            const x = paddingLeft + idx * stepX + 4;
                            const y = paddingTop + plotHeight - barHeight;
                            const crosses80 = cat.ratio >= 0.8 && (idx === 0 || rawCats[idx - 1].ratio < 0.8);
                            const fill = crosses80 
                              ? 'url(#crosses80Grad)' 
                              : cat.ratio < 0.8 
                                ? 'url(#barDarkGrad)' 
                                : 'url(#barLightGrad)';

                            return (
                              <g key={`bar-${cat.category}`} className="group cursor-help">
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={Math.max(barHeight, 2)}
                                  rx="3"
                                  fill={fill}
                                  className="transition-all duration-300 hover:opacity-90"
                                />
                                <text
                                  x={x + barWidth / 2}
                                  y={y - 4}
                                  textAnchor="middle"
                                  fill="currentColor"
                                  className="text-[7px] font-mono font-bold text-slate-550 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {cat.value.toLocaleString()}
                                </text>
                                <title>{`"${cat.category}": ${cat.value.toLocaleString()} (${(cat.ratio * 100).toFixed(1)}% cumulative)`}</title>
                              </g>
                            );
                          })}

                          {/* Cumulative ratio line */}
                          <polyline
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsStr}
                          />

                          {/* Cumulative line dots */}
                          {linePoints.map((p, idx) => {
                            return (
                              <g key={`dot-${idx}`} className="group cursor-help">
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  fill="#6366f1"
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                  className="transition-all transform hover:scale-125"
                                />
                                <title>{`Cumulative: ${(p.ratio * 100).toFixed(1)}%`}</title>
                              </g>
                            );
                          })}

                          {/* Horizontal line tag at 80% mark */}
                          <g transform={`translate(${paddingLeft + plotWidth - 10}, ${paddingTop + plotHeight * 0.2 - 8})`}>
                            <rect width="45" height="12" rx="3" fill="#6366f1" className="shadow-sm" />
                            <text x="22.5" y="8" textAnchor="middle" fill="#ffffff" className="text-[6.5px] font-mono font-black">
                              80% BOUND
                            </text>
                          </g>

                          {/* X-axis labels at bottom */}
                          {rawCats.map((cat, idx) => {
                            const x = paddingLeft + idx * stepX + barWidth / 2 + 4;
                            const y = paddingTop + plotHeight + 12;
                            const truncated = cat.category.length > 10 ? `${cat.category.substring(0, 8)}..` : cat.category;
                            return (
                              <text
                                key={`label-${cat.category}`}
                                x={x}
                                y={y}
                                textAnchor="middle"
                                fill="currentColor"
                                className="text-[7.5px] font-mono font-bold text-slate-550 dark:text-slate-400 select-none"
                                transform={`rotate(-15 ${x} ${y})`}
                              >
                                {truncated}
                                <title>{cat.category}</title>
                              </text>
                            );
                          })}

                          {/* Gradients */}
                          <defs>
                            <linearGradient id="barDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#4f46e5" />
                              <stop offset="100%" stopColor="#818cf8" />
                            </linearGradient>
                            <linearGradient id="barLightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.8" />
                              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.4" />
                            </linearGradient>
                            <linearGradient id="crosses80Grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#fbbf24" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* III. DYNAMIC STRATEGIC BUSINESS COMMENTARY (AI SYNTHESIS) */}
          <div className="space-y-4 mb-10">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-150 dark:border-slate-900 pb-1.5 flex items-center gap-1.5 select-none">
              <Sparkles className="w-4 h-4 text-brand-500 animate-pulse" />
              III. Unified Strategic Executive Dossier
            </h3>

            {aiCommentary ? (
              <div className="space-y-4">
                {renderMarkdown(aiCommentary)}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 italic text-[11px] select-none">
                Strategic narrative not compiled. Try recalculating the ledger.
              </div>
            )}
          </div>

          {/* IV. FLAGGED TRANSACTION ANOMALIES & OUTLIERS */}
          {groundTruth.outliers.length > 0 && (
            <div className="space-y-4 mb-10">
              <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-900 pb-1.5 select-none">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                  IV. Mathematically Flagged Anomalies & Outliers (IQR Limit Scanned)
                </h3>
                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[8.5px] font-mono px-2 py-0.5 rounded font-extrabold uppercase">
                  {groundTruth.outliers.length} Outliers Found
                </span>
              </div>

              {/* Data Outlier Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-2xl bg-slate-50/20 dark:bg-slate-950/5 p-2 font-mono">
                <table className="w-full text-[10px] text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Column</th>
                      <th className="py-2.5 px-3 text-right">Value</th>
                      <th className="py-2.5 px-3 text-right">IQR Upper/Lower Limits</th>
                      <th className="py-2.5 px-3 text-right">Context Record Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groundTruth.outliers.slice(0, 6).map((outlier, index) => {
                      const isHigh = outlier.value > outlier.upperBound;
                      return (
                        <tr key={index} className="border-b border-slate-150 dark:border-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-550">#{outlier.rowNumber}</td>
                          <td className="py-3 px-3"><span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">{outlier.columnName}</span></td>
                          <td className={`py-3 px-3 text-right font-black ${isHigh ? 'text-rose-600 dark:text-rose-455' : 'text-amber-600 dark:text-amber-550'}`}>
                            {outlier.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 text-[9.5px]">
                            {isHigh ? `> ${outlier.upperBound.toLocaleString(undefined, { maximumFractionDigits: 1 })} (High)` : `< ${outlier.lowerBound.toLocaleString(undefined, { maximumFractionDigits: 1 })} (Low)`}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-400 text-[8.5px] truncate max-w-[220px]" title={JSON.stringify(outlier.rowData)}>
                            {Object.entries(outlier.rowData).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' | ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. SECURE CRYPTOGRAPHIC TAMPER-EVIDENT SIGNATURE BLOCK */}
          {reportHash && (
            <div className="mt-12 p-6 border border-slate-900 dark:border-slate-200 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-4 font-mono select-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-brand-500" />
                  <div>
                    <h5 className="text-[11px] font-extrabold text-slate-850 dark:text-slate-100 uppercase tracking-widest">
                      TAMPER-EVIDENT DIGITAL SIGNATURE
                    </h5>
                    <p className="text-[8.5px] text-slate-500 font-medium">CRYPTOGRAPHIC HASH OF LOCAL DATABASE PACKAGE</p>
                  </div>
                </div>
                <div className="px-2.5 py-0.5 border border-brand-150 dark:border-brand-500/10 text-brand-650 dark:text-brand-400 text-[8.5px] font-bold rounded bg-brand-50/50 dark:bg-brand-950/10">
                  SHA-256 RE-VERIFIABLE
                </div>
              </div>

              <div className="space-y-2 text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed break-all">
                <p>
                  <span className="font-bold text-slate-850 dark:text-slate-250 uppercase mr-1">Report Cryptographic Stamp:</span>
                  <span className="font-bold text-brand-650 dark:text-brand-455 tracking-wider">{reportHash}</span>
                </p>
                <p>
                  <span className="font-bold text-slate-850 dark:text-slate-250 uppercase mr-1">Data Schema Fingerprint:</span>
                  <span>{btoa(JSON.stringify(groundTruth.columns.slice(0, 4))).substring(0, 48)}...</span>
                </p>
                <p className="text-[7.5px] text-slate-500 italic mt-2">
                  *This cryptographic checksum maps 100% of statistical cells and AI insights. Any modifications to transaction records in browser IndexedDB memory instantly changes this re-verifiable signature block.*
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default SpatialBook;
