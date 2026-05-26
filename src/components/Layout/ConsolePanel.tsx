import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal, Database, LineChart, Play, Download, Loader2, AlertCircle, Sparkles, Search, Filter, X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';
import agentManager from '../../services/AgentManager';
import type { AgentId } from '../../services/AgentManager';
import VirtualTable from './VirtualTable';
import { showAlert } from '../../services/DialogService';

interface ConsolePanelProps {
  selectedTable: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  width?: number;
}

const getAgentSuggestions = (agentId: string, tableName: string | null): string[] => {
  const table = tableName || 'dataset';
  const hasTable = !!tableName;

  switch (agentId) {
    case 'analyst':
      return hasTable ? [
        `Perform a complete statistical correlation matrix on table '${table}'`,
        `Analyze the distribution profile of all numeric columns in table '${table}'`,
        `Identify outliers and extreme anomalies in table '${table}' columns`,
        `Compute the average deviation and variance profile for table '${table}'`,
        `Check for missing value ratios and data density across columns in table '${table}'`
      ] : [
        "How can I map statistical correlations between variables?",
        "Show me how to run standard deviations on high-variance metrics.",
        "Explain how Gini coefficient and Pareto concentration are calculated.",
        "Help me profile column data types and structural formats.",
        "What are best practices for handling missing/null records?"
      ];
    case 'cso':
      return hasTable ? [
        `Draft an executive OKR plan (3 key results) based on metrics in '${table}'`,
        `Synthesize table '${table}' data into a strategic SWOT matrix`,
        `Define 5 core performance KPIs using records in table '${table}'`,
        `Create an executive summary outlining the strategic risks in '${table}'`,
        `Propose a growth strategy using the primary vectors identified in '${table}'`
      ] : [
        "How do I define standard OKRs and corporate strategy frameworks?",
        "Draft a template for a comprehensive SWOT strategic matrix.",
        "Explain Porter's Five Forces and how to apply them to raw data.",
        "How can I translate granular statistics into business ROI?",
        "Propose a template for high-level executive dashboard summaries."
      ];
    case 'logistics':
      return hasTable ? [
        `Calculate SKU transit velocity and inventory turnovers from '${table}'`,
        `Analyze Return to Origin (RTO) rates and shipping corridors in '${table}'`,
        `Flag transit cycle bottlenecks and carrier delays using table '${table}'`,
        `Model stockout probabilities and buffer parameters using table '${table}'`,
        `Map warehouse distribution performance metrics inside table '${table}'`
      ] : [
        "How do you calculate SKU velocity and inventory turn ratios?",
        "Explain RTO (Return to Origin) factors in international logistics corridors.",
        "What are the common causes of transit bottleneck anomalies?",
        "How can I set safety stock and stockout alerts using SQL?",
        "Detail standard carrier efficiency metrics and delay profiling."
      ];
    case 'auditor':
      return hasTable ? [
        `Scan table '${table}' for duplicate billing entries and invoice codes`,
        `Audit GST/VAT calculations and identify mismatches in table '${table}'`,
        `Flag unusual round-figure transactions and weekend postings in '${table}'`,
        `Run a Benford's Law analysis check on numeric fields in '${table}'`,
        `Conduct a forensic ledger audit and assign risk levels on '${table}' records`
      ] : [
        "What forensic auditing red flags should I look for in ledgers?",
        "Explain how Benford's Law is used to detect accounting fraud.",
        "How can SQL be used to identify duplicate invoice anomalies?",
        "Explain typical tax reconciliation audits for VAT/GST systems.",
        "What characterizes out-of-policy transaction deviation audits?"
      ];
    case 'growth':
      return hasTable ? [
        `Model CAC to LTV monetization funnels using records in '${table}'`,
        `Optimize ad-spend ROI (ROAS) and channel conversions from '${table}'`,
        `Isolate high-value cohorts and user engagement clusters in '${table}'`,
        `Analyze WhatsApp conversion loops and social channel funnels in '${table}'`,
        `Draft a growth-hacking guide targeting customer retention in '${table}'`
      ] : [
        "Explain the ideal CAC-to-LTV ratio for digital startups.",
        "How do I optimize ROAS across WhatsApp and social ad channels?",
        "Detail the methodology for digital cohort retention analysis.",
        "What are the key levers for viral growth loops and conversions?",
        "How can I build monetization models from database statistics?"
      ];
    case 'engineer':
      return hasTable ? [
        `Propose a schema optimization and indexing layout for table '${table}'`,
        `Construct a safe DML clean-up script to remove nulls in '${table}'`,
        `Draft an ALTER TABLE query to optimize column data types in '${table}'`,
        `Write a script to deduplicate records in table '${table}' based on primary columns`,
        `Design a database backup table workflow for table '${table}' migrations`
      ] : [
        "What are the best practices for optimizing DuckDB table schemas?",
        "Explain how to write safe DDL migrations and rollback queries.",
        "How do I safely deduplicate a million-row table using SQL?",
        "Detail the difference between OLAP column-stores and OLTP row-stores.",
        "How can I establish transactional backups and schema locks?"
      ];
    case 'compliance':
      return hasTable ? [
        `Scan table '${table}' for sensitive PII leakages (emails, phones, keys)`,
        `Audit table '${table}' against GDPR user-deletion and privacy requirements`,
        `Draft a data custody and risk-mitigation charter for table '${table}'`,
        `Flag authorization access control weakpoints in table '${table}'`,
        `Map table '${table}' attributes to SOC2/HIPAA security control domains`
      ] : [
        "What is classified as PII (Personally Identifiable Information) in databases?",
        "Explain GDPR 'Right to be Forgotten' execution workflows in SQL.",
        "What are the key elements of a robust data custody risk charter?",
        "How do I enforce cell-level and column-level encryption protocols?",
        "Provide an overview of SOC2 and HIPAA compliance requirements."
      ];
    case 'product':
      return hasTable ? [
        `Map the user retention funnel and session drop-offs in table '${table}'`,
        `Segment user cohorts based on activity rates inside table '${table}'`,
        `Calculate product-market fit (PMF) score indicators from '${table}'`,
        `Profile session durations and user flow bottlenecks in '${table}'`,
        `Analyze feature adoption trends and UX health index in '${table}'`
      ] : [
        "How do you define and compute product cohort retention rates?",
        "What are standard KPIs for assessing product-market fit (PMF)?",
        "Explain the optimal layout of a product health funnel analysis.",
        "How can I identify UX bottlenecks and drop-offs using session logs?",
        "Detail best practices for feature adoption metrics tracking."
      ];
    case 'finance':
      return hasTable ? [
        `Build a CapEx / OpEx runway forecast using financials in '${table}'`,
        `Calculate cash burn rates and EBITDA margins from table '${table}'`,
        `Reconcile balance sheet discrepancies and credit matches in '${table}'`,
        `Model discount cash flow (DCF) expectations using table '${table}' data`,
        `Analyze cost-containment opportunities based on table '${table}' categories`
      ] : [
        "How do I build a dynamic cash burn rate and runway model?",
        "Explain how to calculate Discount Cash Flow (DCF) step-by-step.",
        "What are the key differences between CapEx and OpEx accounting?",
        "Detail standard financial ratio audits (e.g. Current Ratio, EBITDA).",
        "Provide a template for corporate cost-containment strategy."
      ];
    case 'marketing':
      return hasTable ? [
        `Analyze customer acquisition cost (CAC) efficiency by channel in '${table}'`,
        `Model digital campaign attribution and conversion weights from '${table}'`,
        `Segment customer demographics and brand affinity scores in '${table}'`,
        `Profile multi-channel marketing spend and ROAS indices in '${table}'`,
        `Draft a customer journey reactivation strategy using table '${table}' cohorts`
      ] : [
        "How do I calculate customer acquisition costs (CAC) across channels?",
        "Explain multi-touch marketing attribution models (e.g. First-Touch, Linear).",
        "What are key indicators of brand affinity and sentiment analytics?",
        "How can I map ROAS (Return on Ad Spend) curves in an executive summary?",
        "Detail standard reactivation strategies for dormant customer segments."
      ];
    case 'hr':
      return hasTable ? [
        `Analyze employee attrition patterns and retention scores in '${table}'`,
        `Segment talent performance bands and compensation ratios in '${table}'`,
        `Profile recruitment lead times and hiring velocities in table '${table}'`,
        `Examine headcount distribution across departments in '${table}'`,
        `Draft a talent pipeline optimization strategy using data in table '${table}'`
      ] : [
        "How do you calculate employee attrition risk and retention metrics?",
        "What are standard methods for performance-to-compensation benchmarking?",
        "Detail the key stages and KPIs of hiring funnel analytics.",
        "What indicators highlight organizational health and cultural alignment?",
        "Provide a template for strategic human resource capability audits."
      ];
    default:
      return [];
  }
};

export const ConsolePanel: React.FC<ConsolePanelProps> = ({ selectedTable, isOpen, setIsOpen, width = 384 }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'sql' | 'viz' | 'suggestions'>('schema');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>(() => agentManager.getEnabledAgents());
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>(() => {
    const active = agentManager.getActiveAgent();
    return active ? { [active.id]: true } : { analyst: true };
  });

  const toggleAgentExpand = (agId: string) => {
    setExpandedAgents(prev => ({
      ...prev,
      [agId]: !prev[agId]
    }));
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [customSql, setCustomSql] = useState('');

  // SQL Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<{ headers: string[]; rows: any[]; durationMs: number } | null>(null);

  // Inspector states (replaces old preview states)
  const [inspectorRows, setInspectorRows] = useState<any[]>([]);
  const [inspectorHeaders, setInspectorHeaders] = useState<string[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [inspectorTotalCount, setInspectorTotalCount] = useState(0);

  // Inspector sorting
  const [inspectorSortCol, setInspectorSortCol] = useState<string | null>(null);
  const [inspectorSortDir, setInspectorSortDir] = useState<'asc' | 'desc'>('asc');

  // Inspector per-column filtering
  const [inspectorFilters, setInspectorFilters] = useState<Record<string, string>>({});
  const [showInspectorFilters, setShowInspectorFilters] = useState(false);

  // Inspector find & search
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [showInspectorSearch, setShowInspectorSearch] = useState(false);

  // Debounce ref for filter queries
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI SQL states
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingSql, setIsGeneratingSql] = useState(false);

  // Column Visualizer Profile States
  const [colProfiles, setColProfiles] = useState<{[colName: string]: { avg?: number, min?: number, max?: number, categories?: {category: any, count: number}[] }}>({});

  // Create refs for state to avoid stale closures in event listeners
  const selectedTableRef = useRef(selectedTable);
  const inspectorSortColRef = useRef(inspectorSortCol);
  const inspectorSortDirRef = useRef(inspectorSortDir);
  const inspectorFiltersRef = useRef(inspectorFilters);

  useEffect(() => {
    selectedTableRef.current = selectedTable;
    inspectorSortColRef.current = inspectorSortCol;
    inspectorSortDirRef.current = inspectorSortDir;
    inspectorFiltersRef.current = inspectorFilters;
  }, [selectedTable, inspectorSortCol, inspectorSortDir, inspectorFilters]);

  useEffect(() => {
    const sync = () => {
      const active = duckDbService.getActiveTables();
      setTables(active);
      if (selectedTableRef.current) {
        fetchInspectorData(
          selectedTableRef.current,
          inspectorSortColRef.current,
          inspectorSortDirRef.current,
          inspectorFiltersRef.current
        );
      }
    };

    sync();
    const unsubTables = eventBus.on('TABLES_UPDATED', sync);
    
    // Automatically load worksheet template when table is imported
    const unsubImport = eventBus.on('TABLE_IMPORTED', (tableName: string) => {
      setCustomSql(`SELECT * FROM ${tableName} LIMIT 10;`);
    });

    const unsubEnabled = eventBus.on('ENABLED_AGENTS_CHANGED', (updatedAgents: any) => {
      setEnabledAgents(updatedAgents);
    });

    return () => {
      unsubTables();
      unsubImport();
      unsubEnabled();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update default SQL editor state on table selection change
  useEffect(() => {
    if (selectedTable) {
      setCustomSql(`SELECT * FROM ${selectedTable} LIMIT 10;`);
    }
  }, [selectedTable]);

  // Reset inspector state when table changes
  useEffect(() => {
    setInspectorSortCol(null);
    setInspectorSortDir('asc');
    setInspectorFilters({});
    setInspectorSearch('');
    setShowInspectorSearch(false);
    setShowInspectorFilters(false);
  }, [selectedTable]);

  const activeTableMeta = tables.find((t) => t.name === selectedTable);

  // ─── Inspector data fetcher (DuckDB-backed sort + filter) ───
  const fetchInspectorData = useCallback(async (
    table: string,
    sortCol: string | null,
    sortDir: 'asc' | 'desc',
    filters: Record<string, string>,
  ) => {
    setInspectorLoading(true);
    setInspectorError(null);

    try {
      // Get total count first (unfiltered)
      const countResult = await duckDbService.query(`SELECT COUNT(*) as cnt FROM ${table};`);
      const totalCount = Number(countResult.rows[0]?.cnt ?? 0);
      setInspectorTotalCount(totalCount);

      // Build WHERE clause from active filters
      const whereClauses: string[] = [];
      for (const [col, val] of Object.entries(filters)) {
        if (val.trim()) {
          // Escape single quotes in filter value
          const escaped = val.replace(/'/g, "''");
          whereClauses.push(`CAST("${col}" AS VARCHAR) ILIKE '%${escaped}%'`);
        }
      }
      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Build ORDER BY
      const orderStr = sortCol ? `ORDER BY "${sortCol}" ${sortDir.toUpperCase()}` : '';

      const sql = `SELECT * FROM ${table} ${whereStr} ${orderStr};`;
      const { rows } = await duckDbService.query(sql);

      if (rows.length > 0) {
        setInspectorHeaders(Object.keys(rows[0]));
        setInspectorRows(rows);
      } else {
        setInspectorHeaders([]);
        setInspectorRows([]);
      }
    } catch (err: any) {
      setInspectorError(err.message || String(err));
    } finally {
      setInspectorLoading(false);
    }
  }, []);

  // Trigger inspector fetch on table/sort/filter changes
  useEffect(() => {
    if (!selectedTable) return;
    fetchInspectorData(selectedTable, inspectorSortCol, inspectorSortDir, inspectorFilters);
  }, [selectedTable, inspectorSortCol, inspectorSortDir, fetchInspectorData]);

  // Debounced filter refetch
  useEffect(() => {
    if (!selectedTable) return;
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      fetchInspectorData(selectedTable, inspectorSortCol, inspectorSortDir, inspectorFilters);
    }, 300);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectorFilters]);

  // Sort handler
  const handleInspectorSort = useCallback((col: string) => {
    setInspectorSortCol(prev => {
      if (prev === col) {
        // Toggle direction
        setInspectorSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return col;
      }
      setInspectorSortDir('asc');
      return col;
    });
  }, []);

  // Filter handler
  const handleInspectorFilter = useCallback((col: string, value: string) => {
    setInspectorFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  // Keyboard shortcut for search (Ctrl+F when Inspector is active)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab === 'schema' && (e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowInspectorSearch(true);
      }
      if (e.key === 'Escape') {
        setShowInspectorSearch(false);
        setInspectorSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Dynamic Visualizer Profile compiler
  useEffect(() => {
    if (activeTab !== 'viz' || !selectedTable || !activeTableMeta) return;
    let active = true;
    const loadProfiles = async () => {
      const profiles: typeof colProfiles = {};
      for (const col of activeTableMeta.columns) {
        const isNum = ['DOUBLE', 'FLOAT', 'INTEGER', 'BIGINT', 'DECIMAL', 'HUGEINT'].includes(col.type.toUpperCase());
        try {
          if (isNum) {
            const { rows } = await duckDbService.query(`SELECT AVG("${col.name}") as avg, MIN("${col.name}") as min, MAX("${col.name}") as max FROM ${selectedTable};`);
            if (rows.length > 0) {
              profiles[col.name] = {
                avg: rows[0].avg !== null ? Number(rows[0].avg) : undefined,
                min: rows[0].min !== null ? Number(rows[0].min) : undefined,
                max: rows[0].max !== null ? Number(rows[0].max) : undefined,
              };
            }
          } else {
            const { rows } = await duckDbService.query(`SELECT "${col.name}" as category, COUNT(*) as count FROM ${selectedTable} GROUP BY 1 ORDER BY 2 DESC LIMIT 5;`);
            profiles[col.name] = {
              categories: rows.map(r => ({
                category: r.category === null ? 'NULL' : String(r.category),
                count: Number(r.count),
              })),
            };
          }
        } catch (err) {
          console.warn(`Failed to profile column ${col.name}:`, err);
        }
      }
      if (active) {
        setColProfiles(profiles);
      }
    };
    loadProfiles();
    return () => { active = false; };
  }, [selectedTable, activeTab, activeTableMeta]);

  const handleGenerateSql = async () => {
    if (!aiPrompt.trim() || !selectedTable) return;
    setIsGeneratingSql(true);
    try {
      const colsStr = activeTableMeta?.columns.map(c => ` - ${c.name}: ${c.type}`).join('\n') || '';
      const generated = await agentManager.generateSqlFromPrompt(selectedTable, colsStr, aiPrompt);
      setCustomSql(generated);
      setAiPrompt('');
    } catch (err: any) {
      await showAlert(err.message || String(err), "SQL Generation Failed");
    } finally {
      setIsGeneratingSql(false);
    }
  };

  const handleRunSql = async () => {
    if (!customSql.trim()) return;
    setIsExecuting(true);
    setSqlError(null);
    setSqlResult(null);

    try {
      const { rows, durationMs } = await duckDbService.query(customSql);
      
      // Refresh metadata cache in case the query made changes (DML/DDL)
      await duckDbService.refreshAllTablesMetadata();

      if (rows.length > 0) {
        setSqlResult({
          headers: Object.keys(rows[0]),
          rows,
          durationMs,
        });
      } else {
        setSqlResult({
          headers: [],
          rows: [],
          durationMs,
        });
        setSqlError('Query executed successfully but returned 0 results.');
      }
    } catch (err: any) {
      setSqlError(err.message || String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportCsv = () => {
    if (!sqlResult || sqlResult.rows.length === 0) return;
    
    const headers = sqlResult.headers.join(',');
    const rows = sqlResult.rows.map(row => 
      sqlResult.headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(',')
    );

    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `duckdb_query_result_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Count active filters for badge
  const activeFilterCount = Object.values(inspectorFilters).filter(v => v.trim()).length;

  const panelWidth = isMobile ? '100%' : (isOpen ? width : 0);

  return (
    <div 
      id="console-panel"
      className={`fixed md:relative right-0 top-0 h-full bg-white dark:bg-slate-950/90 md:bg-white md:dark:bg-slate-950/70 border-l border-slate-200 dark:border-slate-900 flex flex-col select-none z-50 md:z-10 transition-[transform,opacity] duration-300 ease-out shadow-xl ${
        isOpen 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0 pointer-events-none md:hidden w-0 border-l-0'
      }`}
      style={{
        width: panelWidth,
        minWidth: panelWidth,
        maxWidth: isMobile ? '100%' : panelWidth
      }}
    >
      {/* Tabs list with mobile close button */}
      <div className="flex border-b border-slate-100 dark:border-slate-900/60 bg-transparent p-2 gap-1.5 items-center justify-between">
        <div className="flex gap-1 flex-1">
          {(['schema', 'sql', 'viz', 'suggestions'] as const).map((tab) => {
            const isNarrow = width < 420;
            const isVeryNarrow = width < 360;
            
            let label = '';
            if (isMobile) {
              if (tab === 'schema') label = 'Inspect';
              if (tab === 'sql') label = 'SQL';
              if (tab === 'viz') label = 'Viz';
              if (tab === 'suggestions') label = 'Suggestions';
            } else {
              if (tab === 'schema') label = isVeryNarrow ? '' : (isNarrow ? 'Inspect' : 'Inspector');
              if (tab === 'sql') label = isVeryNarrow ? '' : (isNarrow ? 'SQL' : 'Worksheet');
              if (tab === 'viz') label = isVeryNarrow ? '' : (isNarrow ? 'Viz' : 'Visualizer');
              if (tab === 'suggestions') label = isVeryNarrow ? '' : (isNarrow ? 'Directives' : 'Suggestions');
            }

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-150 ${
                  activeTab === tab
                    ? 'text-brand-650 dark:text-brand-400 font-bold border-b-2 border-brand-500 rounded-none bg-transparent'
                    : 'text-slate-500 dark:text-slate-455 hover:text-slate-800 dark:hover:text-slate-300 font-medium'
                }`}
                title={tab === 'schema' ? 'Inspector' : tab === 'sql' ? 'Worksheet' : tab === 'viz' ? 'Visualizer' : 'Suggestions'}
              >
                {tab === 'schema' && <Database className="w-3.5 h-3.5" />}
                {tab === 'sql' && <Terminal className="w-3.5 h-3.5" />}
                {tab === 'viz' && <LineChart className="w-3.5 h-3.5" />}
                {tab === 'suggestions' && <Sparkles className="w-3.5 h-3.5" />}
                {label && <span className="ml-1">{label}</span>}
              </button>
            );
          })}
        </div>

        {/* Mobile close button inside panel using Right Collapser Icon custom inline SVG */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-500 hover:text-slate-855 transition-all flex-shrink-0"
          title="Close Panel"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
            <rect width="18" height="18" x="3" y="3" rx="2.5" />
            <path d="M15 3v18" />
          </svg>
        </button>
      </div>

      {/* Primary Tab content panel */}
      <div className="flex-1 overflow-hidden p-0 flex flex-col min-h-0 bg-slate-50/20 dark:bg-slate-955/20">
        
        {/* Tab 1: Inspector (Full virtual-scrolling table with sort/filter/search) */}
        {activeTab === 'schema' && (
          <div className="flex-1 flex flex-col min-h-0">
            {selectedTable ? (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Inspector toolbar */}
                <div className="flex-shrink-0 px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-mono text-brand-650 dark:text-brand-400">{selectedTable}</span>
                      </p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-500 font-medium">
                        {inspectorTotalCount.toLocaleString()} total rows · {inspectorHeaders.length} columns
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Filter toggle */}
                      <button
                        onClick={() => setShowInspectorFilters(p => !p)}
                        className={`p-1.5 rounded-lg border text-[9px] font-bold transition-all flex items-center gap-1 ${
                          showInspectorFilters || activeFilterCount > 0
                            ? 'bg-brand-50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-500/20 text-brand-600 dark:text-brand-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                        title="Toggle column filters"
                      >
                        <Filter className="w-3 h-3" />
                        {activeFilterCount > 0 && (
                          <span className="bg-brand-600 text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">{activeFilterCount}</span>
                        )}
                      </button>
                      {/* Search toggle */}
                      <button
                        onClick={() => {
                          setShowInspectorSearch(p => !p);
                          if (showInspectorSearch) setInspectorSearch('');
                        }}
                        className={`p-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                          showInspectorSearch
                            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                        title="Find in table (Ctrl+F)"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                      {/* Clear all filters */}
                      {(activeFilterCount > 0 || inspectorSearch) && (
                        <button
                          onClick={() => {
                            setInspectorFilters({});
                            setInspectorSearch('');
                            setShowInspectorSearch(false);
                          }}
                          className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                          title="Clear all filters & search"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search bar (collapsible) */}
                  {showInspectorSearch && (
                    <div className="flex items-center gap-1.5 animate-in slide-in-from-top-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          value={inspectorSearch}
                          onChange={(e) => setInspectorSearch(e.target.value)}
                          placeholder="Find in table…"
                          autoFocus
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-yellow-400 dark:focus:border-yellow-500 placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        onClick={() => { setShowInspectorSearch(false); setInspectorSearch(''); }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Table area */}
                {inspectorLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Loading table data...</span>
                  </div>
                ) : inspectorError ? (
                  <div className="p-3 m-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/15 text-red-650 dark:text-red-400 rounded-xl text-xs">
                    <p className="font-bold">Failed to load data:</p>
                    <p className="font-mono mt-1 text-[10px]">{inspectorError}</p>
                  </div>
                ) : inspectorRows.length > 0 ? (
                  <VirtualTable
                    headers={inspectorHeaders}
                    rows={inspectorRows}
                    totalRowCount={inspectorTotalCount}
                    height="100%"
                    sortColumn={inspectorSortCol}
                    sortDirection={inspectorSortDir}
                    onSort={handleInspectorSort}
                    searchTerm={inspectorSearch}
                    filters={inspectorFilters}
                    onFilterChange={handleInspectorFilter}
                    showFilters={showInspectorFilters}
                    showRowNumbers={true}
                    className="flex-1 rounded-none border-0 border-t-0"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500">
                    {activeFilterCount > 0 ? 'No rows match the current filters.' : 'Table is empty.'}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500">
                No active table selected. Upload database files in Ingestion.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: SQL Worksheet (with AI prompt generator) */}
        {activeTab === 'sql' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3.5 p-4">
            {/* AI prompt SQL query builder box */}
            {selectedTable && (
              <div className="p-3 bg-brand-50/30 dark:bg-brand-950/10 border border-brand-100/80 dark:border-brand-500/10 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-brand-650 dark:text-brand-400">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>AI Worksheet Assistant</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. show entries where price is above 50 sorted by rating"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateSql(); }}
                    className="flex-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-855 text-slate-855 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-500"
                    disabled={isGeneratingSql}
                  />
                  <button
                    onClick={handleGenerateSql}
                    disabled={isGeneratingSql || !aiPrompt.trim()}
                    className="px-3 bg-brand-650 hover:bg-brand-700 disabled:bg-brand-800/60 text-white rounded-lg font-bold text-[10px] uppercase transition-all shadow-xs flex items-center gap-1"
                  >
                    {isGeneratingSql ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>Write SQL</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 flex-1 flex flex-col min-h-[140px]">
              <label className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
                Raw SQL Query
              </label>
              
              <textarea
                value={customSql}
                onChange={(e) => setCustomSql(e.target.value)}
                placeholder="SELECT * FROM table_name LIMIT 10;"
                className="w-full flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-855 dark:text-slate-200 text-xs rounded-xl p-3 font-mono outline-none resize-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/25 shadow-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunSql}
                disabled={isExecuting || !customSql.trim()}
                className="px-4 py-2 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-brand-600/10"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Worksheet SQL
              </button>
            </div>

            {sqlError && (
              <div className="flex gap-2.5 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/15 text-red-650 dark:text-red-400 rounded-xl text-xs font-medium">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <p>{sqlError}</p>
              </div>
            )}

            {sqlResult && (
              <div className="space-y-2 flex-1 flex flex-col min-h-0 border-t border-slate-200 dark:border-slate-900/80 pt-4">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                  <span className="font-mono">Compiled in: {sqlResult.durationMs}ms · {sqlResult.rows.length.toLocaleString()} rows</span>
                  {sqlResult.rows.length > 0 && (
                    <button
                      onClick={handleExportCsv}
                      className="text-brand-650 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Export CSV
                    </button>
                  )}
                </div>

                {sqlResult.rows.length > 0 ? (
                  <VirtualTable
                    headers={sqlResult.headers}
                    rows={sqlResult.rows}
                    totalRowCount={sqlResult.rows.length}
                    height="220px"
                    showRowNumbers={false}
                    className="rounded-lg"
                  />
                ) : (
                  !sqlError && (
                    <div className="py-8 text-center text-slate-550 text-xs font-semibold">
                      Empty Result Grid
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sandbox Visualizer (dynamic columns-profiler) */}
        {activeTab === 'viz' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 p-4 overflow-y-auto">
            {activeTableMeta ? (
              <div className="space-y-4 flex flex-col flex-1 min-h-0">
                <div className="bg-slate-50 dark:bg-slate-900/15 border border-slate-200 dark:border-slate-855 p-3 rounded-xl text-xs space-y-1 shadow-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Table: <span className="font-mono text-brand-650 dark:text-brand-400">{activeTableMeta.name}</span></p>
                  <p className="text-slate-505 dark:text-slate-400 font-medium">Column-specific aggregates queried locally via DuckDB.</p>
                </div>

                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest block">
                  Column Profiler Insights
                </span>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {activeTableMeta.columns.map((c) => {
                    const profile = colProfiles[c.name];
                    const isNum = ['DOUBLE', 'FLOAT', 'INTEGER', 'BIGINT', 'DECIMAL', 'HUGEINT'].includes(c.type.toUpperCase());
                    
                    return (
                      <div key={c.name} className="p-3 border border-slate-200 dark:border-slate-855 rounded-xl bg-white dark:bg-slate-955/40 space-y-3 text-xs shadow-xs">
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-slate-750 dark:text-slate-350 font-bold">{c.name}</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-550 bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-150 dark:border-slate-900">{c.type.toLowerCase()}</span>
                        </div>
                        
                        {!profile ? (
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Computing metrics...</span>
                          </div>
                        ) : isNum ? (
                          // Numerical Column Profile (Avg, Min, Max cards + Relative Dial Slider)
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-1.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-900 rounded-lg text-center">
                                <p className="text-[8px] text-slate-500 uppercase font-semibold">Min</p>
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 font-mono truncate">{profile.min !== undefined ? profile.min.toLocaleString() : 'N/A'}</p>
                              </div>
                              <div className="p-1.5 bg-brand-50/30 dark:bg-brand-950/20 border border-brand-100/50 dark:border-brand-500/10 rounded-lg text-center">
                                <p className="text-[8px] text-brand-500 uppercase font-semibold">Average</p>
                                <p className="text-[10px] font-bold text-brand-650 dark:text-brand-400 font-mono truncate">{profile.avg !== undefined ? profile.avg.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}</p>
                              </div>
                              <div className="p-1.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-900 rounded-lg text-center">
                                <p className="text-[8px] text-slate-500 uppercase font-semibold">Max</p>
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 font-mono truncate">{profile.max !== undefined ? profile.max.toLocaleString() : 'N/A'}</p>
                              </div>
                            </div>

                            {/* Relative Distribution Gauge */}
                            {profile.min !== undefined && profile.max !== undefined && profile.avg !== undefined && profile.max !== profile.min && (
                              <div className="space-y-1 pt-1 select-none">
                                <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                  <span>Outlier Bound</span>
                                  <span>Avg Relative Position</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 border border-slate-150 dark:border-slate-900 overflow-hidden relative">
                                  <div 
                                    className="bg-brand-600 h-full rounded-full transition-all duration-300" 
                                    style={{ width: `${Math.max(0, Math.min(100, ((profile.avg - profile.min) / (profile.max - profile.min)) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Categorical Column Profile (Top 5 SVG Horizontal Bar Chart)
                          <div className="space-y-2">
                            <p className="text-[8px] text-slate-500 dark:text-slate-550 uppercase font-bold tracking-wider">Top 5 Category Distribution:</p>
                            {profile.categories && profile.categories.length > 0 ? (
                              <div className="space-y-1.5">
                                {profile.categories.map((cat, idx) => {
                                  const maxCount = profile.categories ? profile.categories[0].count : 1;
                                  const ratio = (cat.count / maxCount) * 100;
                                  
                                  return (
                                    <div key={idx} className="space-y-0.5">
                                      <div className="flex justify-between text-[9px] font-medium font-mono text-slate-655 dark:text-slate-400">
                                        <span className="truncate max-w-[150px]">{cat.category}</span>
                                        <span>{cat.count.toLocaleString()} rows</span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-955 rounded-md h-2 border border-slate-150 dark:border-slate-900 overflow-hidden relative">
                                        <div 
                                          className="bg-gradient-to-r from-brand-600 to-purple-500 h-full rounded-r-sm transition-all duration-500" 
                                          style={{ width: `${ratio}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-455 italic">All values are NULL or Empty.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500 h-full">
                No active table selected. Upload database files in Ingestion.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Suggestions (Multi-agent strategic recommendations) */}
        {activeTab === 'suggestions' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 p-4 overflow-y-auto">
            <div className="p-3 bg-brand-50/30 dark:bg-brand-950/10 border border-brand-100/80 dark:border-brand-500/10 rounded-xl space-y-1 text-xs shadow-2xs select-none">
              <div className="flex items-center gap-1.5 font-bold text-brand-650 dark:text-brand-400">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Strategic Persona Directives</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Tailored directives from active boardroom personas. Click a suggestion to write it to chat, or send it immediately.
              </p>
            </div>

            <div className="space-y-3 pr-1">
              {enabledAgents.map((agId) => {
                const persona = agentManager.getPersona(agId);
                if (!persona) return null;
                const isExpanded = !!expandedAgents[agId];
                const suggestions = getAgentSuggestions(agId, selectedTable);

                return (
                  <div 
                    key={agId}
                    className="border border-slate-200 dark:border-slate-855 rounded-xl bg-white dark:bg-slate-955/40 overflow-hidden transition-all shadow-xs"
                  >
                    {/* Header */}
                    <div 
                      onClick={() => toggleAgentExpand(agId)}
                      className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                      style={{ borderLeft: `3px solid ${persona.themeColor}` }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm flex-shrink-0" role="img" aria-label={persona.name}>
                          {persona.avatar}
                        </span>
                        <div className="min-w-0">
                          <p className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 truncate">
                            {persona.name}
                          </p>
                          <p className="text-[8.5px] text-slate-450 dark:text-slate-500 uppercase font-bold tracking-wider truncate">
                            {persona.title}
                          </p>
                        </div>
                      </div>
                      <div className="text-slate-400 dark:text-slate-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50/30 dark:bg-slate-950/20 border-t border-slate-150 dark:border-slate-855/80 space-y-2 animate-[fadeIn_0.15s_ease-out]">
                        {suggestions.map((sug, idx) => (
                          <div 
                            key={idx}
                            className="group relative flex items-start justify-between gap-3 p-2.5 rounded-lg border border-slate-150 dark:border-slate-900 bg-white dark:bg-slate-955/60 hover:border-brand-500/25 dark:hover:border-brand-500/20 transition-all text-[10.5px] text-slate-700 dark:text-slate-300 font-sans hover:shadow-2xs select-text"
                          >
                            <span className="flex-1 leading-relaxed pr-12">
                              {sug}
                            </span>
                            
                            {/* Actions overlay */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity select-none bg-gradient-to-l from-white via-white dark:from-slate-955 dark:via-slate-955 pl-4 py-1.5">
                              {/* Option A: Paste to Chat input */}
                              <button
                                onClick={() => {
                                  agentManager.setActiveAgent(agId);
                                  eventBus.emit('SUGGESTION_CLICKED', { text: sug, execute: false });
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all font-sans font-extrabold text-[8.5px] uppercase flex items-center gap-0.5"
                                title="Paste suggestion into Chat input area"
                              >
                                paste
                              </button>

                              {/* Option B: Direct Dispatch Send */}
                              <button
                                onClick={() => {
                                  agentManager.setActiveAgent(agId);
                                  eventBus.emit('SUGGESTION_CLICKED', { text: sug, execute: true });
                                }}
                                className="p-1.5 bg-brand-650 hover:bg-brand-600 text-white rounded transition-all flex items-center justify-center"
                                title="Directly dispatch instruction query to agent"
                              >
                                <Send className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
