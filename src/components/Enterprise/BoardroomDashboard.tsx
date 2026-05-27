import React, { useState, useEffect } from 'react';
import { 
  Play, Activity, ShieldCheck, 
  Sparkles, Users, 
  X, AlertTriangle, Award, PenTool, Flame,
  BookOpen, BarChart4, Lock
} from 'lucide-react';
import agentManager from '../../services/AgentManager';
import type { AgentId } from '../../services/AgentManager';
import eventBus from '../../services/EventBus';
import { PersonaLogo } from '../Layout/PersonaLogo';
import { showAlert } from '../../services/DialogService';

interface BoardroomDashboardProps {
  onClose: () => void;
}

// Highly styled, custom inline markdown-to-HTML parser for SpatialBook commentary
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
          <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1.5 text-slate-300 mb-4 text-[10.5px] font-sans">
            {currentList}
          </ul>
        );
      } else if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1.5 text-slate-300 mb-4 text-[10.5px] font-sans">
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
        <div key={`table-wrapper-${key}`} className="overflow-x-auto my-4 border border-slate-800 rounded-2xl bg-slate-950 p-2 font-sans mb-4">
          <table className="w-full text-[10px] text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                {tableHeaders.map((h, i) => (
                  <th key={`th-${i}`} className="py-2 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`} className="border-b border-slate-900 hover:bg-slate-900/20 transition-colors">
                  {row.map((cell, colIndex) => (
                    <td key={`cell-${colIndex}`} className="py-2 px-3 font-medium text-slate-350">{parseInline(cell)}</td>
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
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9.5px] font-mono text-brand-400">{part.slice(1, -1)}</code>;
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
        <h3 key={`h1-${idx}`} className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2 mb-4 mt-6 font-sans">
          {parseInline(line.substring(2))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList(idx);
      flushTable(idx);
      elements.push(
        <h4 key={`h2-${idx}`} className="text-[11px] font-black text-slate-200 uppercase tracking-widest border-b border-slate-900 pb-1 mt-6 mb-3 font-sans">
          {parseInline(line.substring(3))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      flushList(idx);
      flushTable(idx);
      elements.push(
        <h5 key={`h3-${idx}`} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-4 mb-2 font-sans">
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
      <p key={`p-${idx}`} className="text-[10.5px] font-medium leading-relaxed text-slate-350 mb-3 font-sans">
        {parseInline(line)}
      </p>
    );
  }

  flushList('final');
  flushTable('final');

  return elements;
};

export const BoardroomDashboard: React.FC<BoardroomDashboardProps> = ({ onClose }) => {
  const [session, setSession] = useState(agentManager.getBoardroomSession());
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [isViewingSpatialBook, setIsViewingSpatialBook] = useState(false);
  const [signature, setSignature] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [interventionText, setInterventionText] = useState('');

  const enabled = agentManager.getEnabledAgents();
  const AUTHORITY_ORDER: AgentId[] = ['analyst', 'logistics', 'growth', 'auditor', 'engineer', 'cso', 'compliance', 'product', 'finance', 'marketing', 'hr'];
  const activeRoster = AUTHORITY_ORDER.filter(id => enabled.includes(id));
  if (activeRoster.length === 0) {
    const firstEnabled = enabled[0] || 'analyst';
    activeRoster.push(firstEnabled);
  }


  useEffect(() => {
    // Synchronize initial state
    const currentSession = agentManager.getBoardroomSession();
    setSession({ ...currentSession });

    // Set first speaker as active agent or select first if idle
    if (currentSession.activeAgentId) {
      setSelectedAgentId(currentSession.activeAgentId);
      setIsViewingSpatialBook(false);
    } else if (Object.keys(currentSession.speeches).length > 0) {
      const keys = Object.keys(currentSession.speeches) as AgentId[];
      setSelectedAgentId(keys[keys.length - 1]);
    } else {
      setSelectedAgentId(activeRoster[0] || 'analyst');
    }

    // Subscribe to session updates
    const unsubSession = eventBus.on('BOARDROOM_SESSION_UPDATED', (updatedSession) => {
      setSession({ ...updatedSession });
      if (updatedSession.activeAgentId) {
        setSelectedAgentId(updatedSession.activeAgentId);
        setIsViewingSpatialBook(false); // Reset to active speaker slide
      }
    });

    return () => {
      unsubSession();
    };
  }, []);

  const startNewSession = () => {
    setIsSigned(false);
    setSignature('');
    setIsViewingSpatialBook(false);
    agentManager.startBoardroomConsensus("Perform a 360-degree workspace audit and operational readiness scan");
  };

  const handleIntervention = async () => {
    if (!interventionText.trim()) return;
    
    eventBus.emit('AUDIT_LOG', {
      action: 'BOARDROOM_INTERVENTION',
      details: `Operator intervened: "${interventionText}"`,
      status: 'warning'
    });

    agentManager.sendMessage(`[Operator Boardroom Intervention]: ${interventionText}`);
    setInterventionText('');
    
    await showAlert("Intervention dispatched to active boardroom speakers. Reviewing comments...", "Intervention Dispatched");
  };

  const handleSignCharter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature.trim()) return;
    
    setIsSigned(true);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);

    eventBus.emit('AUDIT_LOG', {
      action: 'BOARDROOM_RESOLUTION_RATIFIED',
      details: `Board Resolution Charter signed and ratified by Operator [${signature.toUpperCase()}]. OKRs committed to ledger.`,
      status: 'success'
    });
  };

  const getAgentStatus = (id: AgentId) => {
    if (session.status === 'idle') return 'idle';
    if (session.activeAgentId === id) return 'speaking';
    if (session.speeches[id]) return 'completed';
    return 'pending';
  };

  // Pre-computes localized metrics and custom deck information
  const renderSlideContent = () => {
    // SpatialBook View Mode
    if (isViewingSpatialBook && session.spatialBook) {
      const book = session.spatialBook;
      const truth = book.groundTruth;
      
      return (
        <div className="space-y-6 text-slate-300 select-text font-sans max-w-full">
          {/* Tamper-evident Header */}
          <div className="border-b border-slate-800 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 select-none">
            <div className="space-y-1.5">
              <span className="px-2 py-0.5 border border-slate-700 text-[8.5px] font-mono font-bold tracking-widest uppercase text-slate-400 block w-max">
                CONFIDENTIAL // LEVEL 5 INTEGRITY SIGNED
              </span>
              <h2 className="text-sm font-extrabold tracking-tight uppercase text-white leading-none">
                SpatialBook Report Dossier
              </h2>
            </div>
            <div className="text-left sm:text-right text-[8.5px] font-mono text-slate-500 leading-normal">
              <p>SHA-256 CHECKSUM: <span className="font-bold text-slate-400">{book.hash.substring(0, 16)}...</span></p>
              <p>COMPILED ON: <span className="font-bold">{new Date(truth.timestamp).toLocaleTimeString()}</span></p>
            </div>
          </div>

          {/* Descriptive Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">Active Rows</span>
              <span className="text-xs font-black text-white font-mono">{truth.rowCount.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">Total Columns</span>
              <span className="text-xs font-black text-white font-mono">{truth.columnsCount}</span>
            </div>
            {(() => {
              const numericCol = truth.columnDetails.find((c: any) => c.sum !== undefined);
              if (numericCol) {
                return (
                  <>
                    <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">Volume Sum</span>
                      <span className="text-xs font-black text-brand-400 font-mono truncate block" title={numericCol.sum?.toLocaleString()}>
                        {numericCol.sum ? (numericCol.sum > 1000000 ? `${(numericCol.sum / 1000000).toFixed(1)}M` : numericCol.sum.toLocaleString()) : '0'}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">Unit Mean</span>
                      <span className="text-xs font-black text-white font-mono truncate block">
                        {numericCol.avg?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '0'}
                      </span>
                    </div>
                  </>
                );
              }
              return (
                <div className="col-span-2 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-center">
                  <span className="text-[8.5px] font-mono text-slate-500 italic">No numeric aggregate columns found.</span>
                </div>
              );
            })()}
          </div>

          {/* Pareto & Correlation Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {truth.paretoAnalysis && truth.paretoAnalysis.isApplicable && (
              <div className="p-4 border border-brand-950/40 bg-brand-950/5 rounded-xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-900/30 flex items-center justify-center flex-shrink-0 text-brand-400 font-extrabold text-[9px] select-none">
                  80/20
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block leading-none">Concentration</span>
                  <p className="text-[10px] font-bold text-slate-350 leading-normal">
                    {truth.paretoAnalysis.categoriesIn80Percent} categories ({truth.paretoAnalysis.percentageDriving80.toFixed(1)}%) generate 80% of volume.
                  </p>
                </div>
              </div>
            )}

            {(() => {
              const cells = truth.correlationMatrix ? truth.correlationMatrix.filter((c: any) => c.col1 !== c.col2) : [];
              const strongest = cells.length > 0
                ? cells.reduce((max: any, cell: any) => Math.abs(cell.coefficient) > Math.abs(max.coefficient) ? cell : max, cells[0])
                : null;
              
              if (strongest) {
                const direction = strongest.coefficient > 0 ? 'positive' : 'negative';
                return (
                  <div className="p-4 border border-emerald-950/40 bg-emerald-950/5 rounded-xl flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-emerald-400 font-extrabold text-[10px] select-none">
                      r
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-500 uppercase block leading-none">Interaction</span>
                      <p className="text-[10px] font-bold text-slate-350 leading-normal">
                        "{strongest.col1}" & "{strongest.col2}" show a {direction} correlation (r = {strongest.coefficient.toFixed(2)}).
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* SVG Visualizations Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
            {/* Categorical Density */}
            {(() => {
              const catCol = truth.columnDetails.find((c: any) => c.topValues && c.topValues.length > 0);
              if (catCol && catCol.topValues) {
                const maxVal = Math.max(...catCol.topValues.map((v: any) => v.count), 1);
                return (
                  <div className="p-4 border border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <BarChart4 className="w-3.5 h-3.5 text-brand-500" />
                      Density: &ldquo;{catCol.name}&rdquo;
                    </span>
                    <svg viewBox="0 0 400 220" className="w-full h-auto">
                      {catCol.topValues.slice(0, 5).map((tv: any, idx: number) => {
                        const width = (tv.count / maxVal) * 260;
                        const y = idx * 40 + 20;
                        return (
                          <g key={tv.value}>
                            <text x="10" y={y + 12} fill="currentColor" className="text-[9px] font-mono font-bold text-slate-500">
                              {tv.value.length > 13 ? `${tv.value.substring(0, 11)}..` : tv.value}
                            </text>
                            <rect x="110" y={y} width="260" height="16" rx="4" fill="currentColor" className="text-slate-900" />
                            <rect x="110" y={y} width={width} height="16" rx="4" fill="url(#indigoGrad2)" />
                            <text x={115 + width} y={y + 12} fill="currentColor" className="text-[8.5px] font-mono font-bold text-brand-400">
                              {tv.count.toLocaleString()}
                            </text>
                          </g>
                        );
                      })}
                      <defs>
                        <linearGradient id="indigoGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                );
              }
              return null;
            })()}

            {/* Correlation Matrix Heatmap */}
            {(() => {
              if (!truth.correlationMatrix || truth.correlationMatrix.length === 0) return null;
              const uniqueCols = Array.from(
                new Set(truth.correlationMatrix.flatMap((c: any) => [c.col1, c.col2]))
              ).slice(0, 4) as string[];

              const getCorrCoeff = (col1: string, col2: string): number => {
                if (col1 === col2) return 1.0;
                const match = truth.correlationMatrix.find(
                  (c: any) => (c.col1 === col1 && c.col2 === col2) || (c.col1 === col2 && c.col2 === col1)
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
                <div className="p-4 border border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Pearson Correlation Heatmap
                  </span>
                  <div className="flex justify-center">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[280px] h-auto">
                      {uniqueCols.map((rowCol, rIdx) => {
                        return uniqueCols.map((colCol, cIdx) => {
                          const coeff = getCorrCoeff(rowCol, colCol);
                          const x = labelPaddingLeft + cIdx * cellSize;
                          const y = gridPaddingTop + rIdx * cellSize;

                          let fill = 'rgba(226, 232, 240, 0.03)';
                          let textColor = 'rgba(200, 200, 200, 0.8)';

                          if (rowCol === colCol) {
                            fill = 'rgba(79, 70, 229, 0.15)';
                            textColor = '#818cf8';
                          } else if (coeff > 0.05) {
                            fill = `rgba(16, 185, 129, ${coeff * 0.8})`;
                            textColor = coeff > 0.4 ? '#ffffff' : '#a7f3d0';
                          } else if (coeff < -0.05) {
                            fill = `rgba(244, 63, 94, ${Math.abs(coeff) * 0.8})`;
                            textColor = Math.abs(coeff) > 0.4 ? '#ffffff' : '#fecdd3';
                          }

                          return (
                            <g key={`${rowCol}-${colCol}`}>
                              <rect x={x} y={y} width={cellSize - 2} height={cellSize - 2} rx="4" fill={fill} />
                              <text x={x + cellSize / 2} y={y + cellSize / 2 + 3} textAnchor="middle" fill={textColor} className="text-[8px] font-mono font-bold select-none">
                                {coeff >= 0 ? `+${coeff.toFixed(2)}` : coeff.toFixed(2)}
                              </text>
                            </g>
                          );
                        });
                      })}

                      {uniqueCols.map((colName, rIdx) => {
                        const y = gridPaddingTop + rIdx * cellSize + cellSize / 2 + 3;
                        const truncated = colName.length > 12 ? `${colName.substring(0, 10)}..` : colName;
                        return (
                          <text key={`row-${colName}`} x={labelPaddingLeft - 8} y={y} textAnchor="end" fill="currentColor" className="text-[8px] font-mono font-bold text-slate-500">
                            {truncated}
                          </text>
                        );
                      })}

                      {uniqueCols.map((colName, cIdx) => {
                        const x = labelPaddingLeft + cIdx * cellSize + cellSize / 2;
                        const y = gridPaddingTop + uniqueCols.length * cellSize + 12;
                        const truncated = colName.length > 8 ? `${colName.substring(0, 6)}..` : colName;
                        return (
                          <text key={`col-${colName}`} x={x} y={y} textAnchor="middle" fill="currentColor" className="text-[7.5px] font-mono font-bold text-slate-500">
                            {truncated}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* AI Commentary Report */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 leading-relaxed font-sans text-xs space-y-4">
            <h4 className="text-xs font-bold text-emerald-450 border-b border-slate-900 pb-1.5 uppercase tracking-wider select-none">
              📘 Final ground-truth analytical report
            </h4>
            <div className="prose prose-invert max-w-none text-[11px] leading-relaxed text-slate-350">
              {renderMarkdown(book.commentary)}
            </div>
          </div>
        </div>
      );
    }

    const activeId = selectedAgentId || activeRoster[0] || 'analyst';
    const speech = session.speeches[activeId];
    
     if (!speech && session.activeAgentId === activeId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-t-brand-500 border-r-transparent border-slate-200 dark:border-slate-800 animate-spin mb-4" />
          <p className="text-xs text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider animate-pulse">
            Drafting Briefing Slide...
          </p>
          <p className="text-[10.5px] text-slate-500 max-w-xs mt-1.5 leading-normal font-semibold">
            {session.loadingText}
          </p>
        </div>
      );
    }

    if (!speech) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center select-none text-slate-500">
          <Users className="w-8 h-8 opacity-30 mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider">Briefing Pending</p>
          <p className="text-[10px] max-w-xs mt-1 leading-normal">
            This board member is waiting for the floor. Their custom presentation deck will load once their speech starts.
          </p>
        </div>
      );
    }

    // Render themed slides based on selected agent
    switch (activeId) {
      case 'analyst':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">
                Slide 01 // Quantitative Analytical Profile
              </span>
              <span className="text-[9px] font-mono font-bold bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                Strict Decimals
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Total Records</span>
                <span className="text-sm font-extrabold text-indigo-650 dark:text-indigo-400 font-mono">100% Reconciled</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Confidence Score</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">98.4%</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Standard Dev</span>
                <span className="text-sm font-extrabold text-indigo-650 dark:text-indigo-405 font-mono">Low Variance</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Outliers Spotted</span>
                <span className="text-sm font-extrabold text-rose-650 dark:text-rose-400 font-mono">Bounded</span>
              </div>
            </div>

            <div className="bg-slate-100/50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-900 rounded-xl space-y-2">
              <h4 className="text-[9.5px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">
                Descriptive Statistical Skew Analysis
              </h4>
              <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed font-sans">
                descriptive aggregation metrics completed locally via secure in-browser DuckDB-Wasm engine. Values mapped inside regular 2.5-sigma bounds. Density calculations demonstrate high-concentration clusters matching typical Pareto standard footprints.
              </p>
            </div>
          </div>
        );

      case 'logistics':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
                Slide 02 // Global Logistics & SKU Corridor
              </span>
              <span className="text-[9px] font-mono font-bold bg-amber-500/5 border border-amber-500/10 text-amber-400 px-2 py-0.5 rounded">
                Units & Volumes
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Logistical Cargo Pipeline Flow</span>
                  <span className="text-amber-400">Velocity check</span>
                </div>
                
                {/* Visual log pipeline */}
                <div className="flex items-center gap-1 py-2 select-none">
                  <div className="flex-1 h-1.5 rounded bg-emerald-500/80" title="Clear customs" />
                  <div className="w-4 h-[1px] bg-slate-700" />
                  <div className="flex-1 h-1.5 rounded bg-amber-500/80" title="Outbound transit bottleneck" />
                  <div className="w-4 h-[1px] bg-slate-700" />
                  <div className="flex-1 h-1.5 rounded bg-slate-800" title="Warehouse sorting" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[9.5px] font-mono pt-1">
                  <div>
                    <span className="text-slate-500 block">Corridor</span>
                    <span className="font-bold text-slate-300">International</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Out-of-Stock</span>
                    <span className="font-bold text-emerald-400">Flagged</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">RTO Index</span>
                    <span className="font-bold text-amber-400">Optimal</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-[10px] text-slate-400 leading-relaxed">
                <strong className="text-amber-400 block mb-0.5">Supply Chain Bottleneck Audit:</strong>
                Transit times and inventory safety bounds compiled. Local operations recommended to expand buffer stock in Gulf nodes and limit COD (Cash on Delivery) split transactions below 30% thresholds.
              </div>
            </div>
          </div>
        );

      case 'growth':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-pink-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-pink-400 uppercase tracking-widest">
                Slide 03 // CAC / LTV Acquisition Funnel
              </span>
              <span className="text-[9px] font-mono font-bold bg-pink-500/5 border border-pink-500/10 text-pink-400 px-2 py-0.5 rounded">
                Funnel Scaling
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">CAC Ratio</span>
                <span className="text-sm font-extrabold text-pink-400 font-mono">6.2x LTV</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">ROAS Return</span>
                <span className="text-sm font-extrabold text-pink-400 font-mono">4.12x</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">WhatsApp Conversion</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">+18.5%</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-2">
              <h4 className="text-[9.5px] font-bold text-pink-400 uppercase tracking-wider">
                Growth Strategy & cohort optimization
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                funnel conversions showcase high scaling viability. Direct WhatsApp messaging pathways reduce CAC margins by 45% compared to baseline channels. Re-target user cohorts displaying purchase velocity greater than 1.8x mean volume.
              </p>
            </div>
          </div>
        );

      case 'auditor':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-widest">
                Slide 04 // Forensic Financial Ledger Check
              </span>
              <span className="text-[9px] font-mono font-bold bg-rose-50/5 border border-rose-500/10 text-rose-400 px-2 py-0.5 rounded">
                Risk Flagged
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>Flagged Anomalies Ledger</span>
                  <span className="text-rose-400 font-extrabold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Audit Scan</span>
                </div>
                
                <div className="space-y-1.5 font-mono text-[9px]">
                  <div className="flex justify-between items-center">
                    <span className="text-rose-400">🔴 AUD-209 Split codes</span>
                    <span className="text-slate-300 font-bold">$50,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-400">🟡 AUD-210 VAT/GST Dev</span>
                    <span className="text-slate-300 font-bold">18% applied</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400">🟢 AUD-211 Sunday runtime</span>
                    <span className="text-slate-400">02:40 AM</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-[10px] text-slate-400 leading-relaxed">
                Double billing and split invoice checks executed. Reconciled balances verified against total DuckDB sandbox records. High risk codes require operational limits to guarantee Global Port and IFRS audit compliance.
              </div>
            </div>
          </div>
        );

      case 'engineer':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest">
                Slide 05 // Schema Migration & Sandbox constraints
              </span>
              <span className="text-[9px] font-mono font-bold bg-cyan-500/5 border border-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">
                DML / DDL Sandbox
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">VFS storage</span>
                <span className="text-xs font-extrabold text-cyan-400 font-mono">100% In-Browser</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-center">
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-1">Write Safeguards</span>
                <span className="text-xs font-extrabold text-emerald-400 font-mono">Yes/No Gate Enabled</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 border border-slate-900 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase">
                <span>Migration Script Preview</span>
                <span className="text-cyan-400 font-mono">DuckDB SQL</span>
              </div>
              <pre className="p-2.5 bg-slate-900/30 text-[9px] font-mono text-cyan-400/90 rounded border border-slate-900 overflow-x-auto leading-relaxed select-all">
                ALTER TABLE active_dataset ADD CONSTRAINT unique_id UNIQUE (id);
              </pre>
            </div>
          </div>
        );

      case 'cso':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                Slide 06 // Unified Corporate SWOT & Directives
              </span>
              <span className="text-[9px] font-mono font-bold bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                Marcus presides
              </span>
            </div>

            {/* Visual 2x2 SWOT grid */}
            <div className="grid grid-cols-2 gap-2 text-[9px] select-none">
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-emerald-400 font-extrabold block mb-0.5">S / STRENGTHS</span>
                <span className="text-slate-400">High statistical confidence, sandboxed privacy structures, WhatsApp funnel velocity.</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-amber-400 font-extrabold block mb-0.5">W / WEAKNESSES</span>
                <span className="text-slate-400">Split invoice flags in ledger, logistics safety boundaries.</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-indigo-400 font-extrabold block mb-0.5">O / OPPORTUNITIES</span>
                <span className="text-slate-400">Optimize CAC models, increase regional Gulf corridor warehousing limits.</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-rose-400 font-extrabold block mb-0.5">T / THREATS</span>
                <span className="text-slate-400">Tax compliance mismatch, unindexed database scans.</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-[10px] text-slate-400">
              <strong className="text-emerald-400 block mb-0.5">Unified Board OKRs committed:</strong>
              1. Advance gross margins to 44% by targeting high-performance cohorts. 2. Implement check constraints in schemas to eliminate audit outlier flags. 3. Optimize last-mile logistics dispatch to drop RTO index below 10%.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-50/98 dark:bg-slate-955/98 text-slate-800 dark:text-slate-200 z-50 overflow-y-auto flex flex-col font-sans select-none animate-fade-in p-4 md:p-6 transition-colors duration-300 backdrop-blur-md">
      
      {/* Dynamic particles for Canvas-less celebratory burst */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-55 overflow-hidden select-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float-particle"
              style={{
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'][i % 6],
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                opacity: 0.8
              }}
            />
          ))}
        </div>
      )}

      {/* Glassmorphic Boardroom Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 border border-brand-500/25 rounded-xl text-brand-400">
            <Users className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-800 dark:text-white leading-none tracking-tight">
                🏛️ Executive Boardroom Consensus
              </h1>
              <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:inline" />
              <span className={`text-[8.5px] font-mono px-2 py-0.5 border rounded-full uppercase font-bold tracking-widest ${
                session.status === 'running' 
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-500 dark:text-amber-400 animate-pulse'
                  : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
              }`}>
                {session.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-2 font-mono truncate max-w-sm sm:max-w-md">
              Session Agenda: &ldquo;{session.query || 'Evaluating operational performance & data diagnostics'}&rdquo;
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 select-none self-end sm:self-auto">
          {session.status !== 'running' && (
            <button
              onClick={startNewSession}
              className="px-3.5 py-1.5 bg-brand-650 hover:bg-brand-600 border border-brand-500/30 rounded-xl text-[10px] font-bold tracking-wider text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Convene Session
            </button>
          )}
          {session.status === 'running' ? (
            <button
              disabled
              className="p-2 border border-amber-500/25 bg-amber-500/5 rounded-xl text-amber-500 dark:text-amber-400 cursor-not-allowed opacity-80"
              title="Floor is locked while consensus is active"
            >
              <Lock className="w-4 h-4 animate-pulse" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="Return to standard chat interface"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 mb-4 select-text">
        
        {/* Left Side: Circular Table Map & Dynamic Sentiment Tickers (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4 select-none">
          
          {/* Virtual Boardroom Table Card */}
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-xs min-h-[260px] shadow-md">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-radial-glow opacity-5" />
            
            <h3 className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mb-6 absolute top-4 left-4">
              Committees Board Map
            </h3>

            {/* Circular Table Grid Layout */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 mt-2 flex items-center justify-center">
              
              {/* Interactive Center Table Ring (Click to trigger SpatialBook when ready) */}
              <button
                onClick={() => {
                  if (session.status === 'completed' && session.spatialBook) {
                    setIsViewingSpatialBook(true);
                  }
                }}
                disabled={session.status !== 'completed' || !session.spatialBook}
                className={`absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border flex flex-col items-center justify-center text-center shadow-inner z-10 transition-all ${
                  session.status === 'completed' && session.spatialBook
                    ? 'border-emerald-500/50 hover:border-emerald-400 hover:bg-slate-900/90 cursor-pointer scale-105'
                    : 'border-slate-800/80 bg-slate-950/80 cursor-default'
                }`}
              >
                {session.status === 'completed' && session.spatialBook ? (
                  <>
                    <BookOpen className="w-5 h-5 text-emerald-450 animate-pulse mb-0.5" />
                    <span className="text-[7.5px] font-extrabold text-emerald-400 uppercase tracking-widest leading-none">
                      VIEW DOSSIER
                    </span>
                    <span className="text-[6px] text-slate-400 font-mono mt-0.5 font-bold uppercase leading-none">
                      SpatialBook Ready
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                      DATUMS
                    </span>
                    <span className="text-[9.5px] font-extrabold text-slate-350 uppercase tracking-tight mt-1 leading-none">
                      BOARD
                    </span>
                    <span className="text-[7px] text-emerald-450 font-mono mt-1 leading-none font-bold uppercase">
                      {Object.keys(session.speeches).length}/{activeRoster.length} agreed
                    </span>
                  </>
                )}
              </button>

              {/* Executive Seats arranged dynamically around table */}
              {activeRoster.map((id, index) => {
                const persona = agentManager.getPersona(id);
                const status = getAgentStatus(id);
                
                // Tracing coordinates on a circle dynamically based on roster size
                const angle = (index * (360 / activeRoster.length) * Math.PI) / 180 - Math.PI / 2;
                const r = 80; // Radius
                const x = Math.round(r * Math.cos(angle));
                const y = Math.round(r * Math.sin(angle));

                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (session.speeches[id] || session.activeAgentId === id) {
                        setIsViewingSpatialBook(false);
                        setSelectedAgentId(id);
                      }
                    }}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                    className={`absolute w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all z-20 ${
                      !isViewingSpatialBook && selectedAgentId === id 
                        ? 'bg-slate-900 border-2 shadow-lg scale-110 border-slate-700' 
                        : 'bg-slate-950 hover:bg-slate-900 border'
                    }`}
                    title={`${persona.name} (${persona.title}) | State: ${status}`}
                  >
                    {/* Ring glow indicator based on status */}
                    <div 
                      className={`absolute inset-0 rounded-xl pointer-events-none opacity-40 transition-colors ${
                        status === 'speaking' 
                          ? 'border border-t-transparent animate-spin'
                          : !isViewingSpatialBook && selectedAgentId === id ? 'border border-slate-700' : 'border-transparent'
                      }`}
                      style={status === 'speaking' ? { borderColor: persona.themeColor, borderTopColor: 'transparent' } : undefined}
                    />

                    {/* Badge indicator */}
                    <div className="relative">
                      <PersonaLogo agentId={id} className="w-8 h-8" />
                      
                      {status === 'completed' && (
                        <div className="absolute -top-3.5 -right-3.5 w-4 h-4 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] font-bold text-white shadow-sm select-none">
                          ✓
                        </div>
                      )}
                      
                      {status === 'speaking' && (
                        <div className="absolute -top-3.5 -right-3.5 w-4 h-4 rounded-full bg-amber-500 border border-slate-950 flex items-center justify-center text-[7px] font-extrabold text-white animate-pulse shadow-sm">
                          <Flame className="w-2.5 h-2.5 animate-bounce" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Sentiment / Consensus Index Tickers */}
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl flex-1 flex flex-col justify-center gap-3.5 backdrop-blur-xs shadow-md">
            <h3 className="text-[9.5px] font-bold text-slate-550 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 mb-1 flex items-center gap-1.5 leading-none">
              <Activity className="w-3.5 h-3.5 text-brand-500" />
              Consensus Impact Gauges
            </h3>

            {/* Gauge Bars */}
            <div className="space-y-3 font-mono text-[9px]">
              {/* Metric 1 */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>ROI / Gross Margins Footprint</span>
                  <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-[10px]">{session.sentimentMetrics.roiIndex}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-805 overflow-hidden flex">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700" 
                    style={{ width: `${session.sentimentMetrics.roiIndex}%` }}
                  />
                </div>
              </div>

              {/* Metric 2 */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>IFRS / Global Port Compliance & Security</span>
                  <span className="text-rose-600 dark:text-rose-400 font-extrabold text-[10px]">{session.sentimentMetrics.complianceRating}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-805 overflow-hidden flex">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-455 transition-all duration-700" 
                    style={{ width: `${session.sentimentMetrics.complianceRating}%` }}
                  />
                </div>
              </div>

              {/* Metric 3 */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Growth Velocity Index</span>
                  <span className="text-pink-600 dark:text-pink-400 font-extrabold text-[10px]">{session.sentimentMetrics.growthVelocity}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-805 overflow-hidden flex">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-600 to-pink-455 transition-all duration-700" 
                    style={{ width: `${session.sentimentMetrics.growthVelocity}%` }}
                  />
                </div>
              </div>

              {/* Metric 4 */}
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Data Integrity & Skew Resolution</span>
                  <span className="text-cyan-650 dark:text-cyan-400 font-extrabold text-[10px]">{session.sentimentMetrics.dataIntegrity}%</span>
                </div>
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-805 overflow-hidden flex">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-455 transition-all duration-700" 
                    style={{ width: `${session.sentimentMetrics.dataIntegrity}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Active Presentation Slide & Dialogue Transcript (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
          
          {/* Main Slide Deck Panel */}
          <div className="bg-slate-900/30 border border-slate-800/80 p-5 rounded-2xl flex flex-col min-h-[300px] backdrop-blur-xs relative">
            
            {/* Slide Header details */}
            <div className="flex items-center justify-between mb-4 w-full border-b border-slate-800/60 pb-3 select-none">
              <div className="flex items-center gap-2">
                {isViewingSpatialBook && session.spatialBook ? (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-450">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-none">
                        SpatialBook Report Dossier
                      </h3>
                      <span className="text-[8.5px] font-bold uppercase tracking-widest text-emerald-405 leading-none mt-1 block">
                        TAMPER-EVIDENT GROUND TRUTHS
                      </span>
                    </div>
                  </>
                ) : selectedAgentId && (
                  <>
                    <PersonaLogo agentId={selectedAgentId} className="w-6 h-6" />
                    <div>
                      <h3 className="text-xs font-bold text-white leading-none">
                        {agentManager.getPersona(selectedAgentId).name}
                      </h3>
                      <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500 leading-none mt-1 block">
                        {agentManager.getPersona(selectedAgentId).title}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Slide Navigation switcher tabs */}
              {session.status === 'completed' && session.spatialBook && (
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                  <button
                    onClick={() => {
                      setIsViewingSpatialBook(false);
                      setSelectedAgentId('cso');
                    }}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold tracking-wider transition-all ${
                      !isViewingSpatialBook
                        ? 'bg-slate-900 text-white border border-slate-800'
                        : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Briefings
                  </button>
                  <button
                    onClick={() => setIsViewingSpatialBook(true)}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold tracking-wider transition-all flex items-center gap-1 ${
                      isViewingSpatialBook
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    SpatialBook
                  </button>
                </div>
              )}
            </div>

            {/* Slide Deck presentation container */}
            <div className="flex-1 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-855 rounded-xl p-5 overflow-y-auto leading-relaxed shadow-inner">
              {renderSlideContent()}
            </div>
          </div>

          {/* Operator Command Center (Replaces Dialogue Transcript Panel) */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl flex flex-col min-h-[160px] backdrop-blur-xs select-text overflow-hidden shadow-md">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 select-none">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Operator Command Center
              </span>
              {session.status === 'running' && (
                <span className="text-[8px] font-bold font-mono text-amber-450 border border-amber-500/10 px-2 py-0.5 rounded bg-amber-500/5 animate-pulse">
                  Consensus Active
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 flex flex-col justify-center font-sans text-[11px] leading-relaxed text-slate-350 max-w-full">
              {session.status === 'running' ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Directives steer active speech behaviors, override priorities, or focus the discussion on specific datasets and tables.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={interventionText}
                      onChange={(e) => setInterventionText(e.target.value)}
                      placeholder="Inject directive (e.g. 'Tell Zoe to prioritize conversion growth hacks on the dataset')"
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 text-xs rounded-xl px-4 py-2.5 text-slate-200 outline-none placeholder-slate-600"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleIntervention();
                      }}
                    />
                    <button
                      onClick={handleIntervention}
                      disabled={!interventionText.trim()}
                      className="px-4 py-2.5 bg-brand-650 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-[10px] rounded-xl tracking-wider select-none shrink-0"
                    >
                      Inject Directive
                    </button>
                  </div>
                </div>
              ) : session.status === 'completed' ? (
                <div className="flex flex-col items-center justify-center py-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mb-1.5" />
                  <p className="text-[10.5px] text-slate-200 font-semibold mb-1">
                    Consensus Ratified & Locked
                  </p>
                  <p className="text-[9.5px] text-slate-550 text-center max-w-sm">
                    The boardroom consensus has concluded. Review the signed resolution below to commit OKRs to the browser VFS cache.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-2">
                  <Sparkles className="w-8 h-8 text-slate-700 mb-1.5 animate-pulse" />
                  <p className="text-[10px] text-slate-500 text-center max-w-xs mb-2">
                    Operator intervention is offline. Initiate a Boardroom Consensus to mobilize the virtual executive suite.
                  </p>
                  <button
                    onClick={startNewSession}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-555 text-white font-bold text-[10px] rounded-lg tracking-wider"
                  >
                    Initialize Boardroom Consensus
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Interactive Operator Interventions & Legal Charter */}
      <footer className="mt-auto shrink-0 select-none">
        
        {/* If Completed: Render legal resolution charter */}
        {session.status === 'completed' ? (
          <div className="bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xs select-text">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-7 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Award className="w-5 h-5" />
                  <h3 className="text-xs font-bold uppercase tracking-wider leading-none">
                    Legal Resolution & Corporate OKR Charter
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans max-w-xl">
                  Committees consensus reached successfully. Marcus Vance (CSO) has presiding clearance, Silas (Engineer) has generated sandboxed tables, and Vance (Auditor) verified lead-time compliance logs. The system is ready to ratify OKR metrics.
                </p>
              </div>
              
              <div className="md:col-span-5">
                {isSigned ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10.5px] font-bold text-emerald-400 flex items-center justify-center gap-2 select-none">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    RESOLUTION COMMITTED & LOCKED IN MEMORY LEDGER
                  </div>
                ) : (
                  <form onSubmit={handleSignCharter} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={15}
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Type initials or name to ratify"
                      className="flex-1 bg-slate-955 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 text-xs rounded-xl px-3.5 py-2.5 text-white outline-none placeholder-slate-600 font-mono select-all"
                      required
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-555 text-white font-bold text-[10.5px] rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      Sign Resolution
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  );
};
