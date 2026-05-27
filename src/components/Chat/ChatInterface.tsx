import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Terminal, Database, Code, ShieldCheck, ChevronDown, ChevronUp, 
  Sparkles, Info, AlertTriangle, Lightbulb, Shield, Check, Copy, Download 
} from 'lucide-react';
import mermaid from 'mermaid';
import agentManager from '../../services/AgentManager';
import type { AgentId, AgentPersona, ChatMessage } from '../../services/AgentManager';
import duckDbService from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';
import { PersonaLogo } from '../Layout/PersonaLogo';
import { BoardroomDashboard } from '../Enterprise/BoardroomDashboard';

// Initialize Mermaid browser renderer
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    themeVariables: {
      background: '#020617',
      primaryColor: '#6366f1',
      primaryTextColor: '#f8fafc',
      lineColor: '#334155',
      primaryBorderColor: '#1e293b',
      nodeBorder: '#1e293b'
    }
  });
} catch (e) {
  console.error('[Mermaid] Initialization exception:', e);
}

// Inline dynamic Mermaid compiler component
const MermaidChart: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const elementIdRef = useRef(`mermaid-${Math.floor(Math.random() * 1000000)}`);
  const elementId = elementIdRef.current;

  useEffect(() => {
    const renderChart = async () => {
      try {
        setErr(null);
        // Scrub basic markdown code block wrapping if any
        let cleanChart = chart.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
        if (cleanChart.toLowerCase().startsWith('mermaid\n')) {
          cleanChart = cleanChart.slice(8).trim();
        } else if (cleanChart.toLowerCase().startsWith('mermaid ')) {
          cleanChart = cleanChart.slice(8).trim();
        }
        
        const { svg: renderedSvg } = await mermaid.render(elementId, cleanChart);
        setSvg(renderedSvg);
      } catch (e: any) {
        console.warn('[Mermaid] Live rendering error, resolving...', e);
        setErr(e.message || String(e));
        
        // Remove error overlay items added by Mermaid internally to prevent layout clutter
        const badEl = document.getElementById(elementId);
        if (badEl) badEl.remove();
        const badElBind = document.getElementById(`d${elementId}`);
        if (badElBind) badElBind.remove();
      }
    };

    renderChart();
  }, [chart]);

  if (err) {
    return (
      <div className="text-[10px] text-red-650 dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 p-3 rounded-lg leading-normal shadow-xs">
        <strong>Strategic Diagram Compiler Warning:</strong> {err.slice(0, 150)}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-xs text-slate-500 animate-pulse font-medium">
        <Sparkles className="w-4 h-4 text-brand-500/70" />
        Formulating strategic architecture diagram...
      </div>
    );
  }

  return (
    <div 
      className="mermaid-svg bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-900 rounded-xl overflow-x-auto flex justify-center shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

interface MarkdownBlock {
  type: 'paragraph' | 'heading' | 'blockquote' | 'alert' | 'code' | 'table' | 'list';
  level?: number;
  codeLang?: string;
  codeText?: string;
  alertType?: 'NOTE' | 'TIP' | 'WARNING' | 'CAUTION' | 'IMPORTANT';
  listType?: 'bullet' | 'number';
  listItems?: Array<{ text: string; depth: number }>;
  tableHeaders?: string[];
  tableRows?: string[][];
  content?: string;
}

const ALERT_STYLES = {
  NOTE: {
    bg: 'bg-slate-50/70 dark:bg-slate-900/40',
    border: 'border-slate-200 dark:border-slate-800/80',
    text: 'text-slate-700 dark:text-slate-350',
    titleColor: 'text-slate-850 dark:text-slate-200',
    glow: 'border-l-4 border-l-slate-400 dark:border-l-slate-600',
    icon: Info,
    iconColor: 'text-slate-500 dark:text-slate-400'
  },
  TIP: {
    bg: 'bg-brand-50/40 dark:bg-brand-950/10',
    border: 'border-brand-150/60 dark:border-brand-900/40',
    text: 'text-brand-900/90 dark:text-brand-300',
    titleColor: 'text-brand-950 dark:text-brand-200',
    glow: 'border-l-4 border-l-brand-500 dark:border-l-brand-600',
    icon: Lightbulb,
    iconColor: 'text-brand-500 dark:text-brand-400'
  },
  WARNING: {
    bg: 'bg-amber-50/40 dark:bg-amber-950/10',
    border: 'border-amber-200/55 dark:border-amber-900/40',
    text: 'text-amber-900/90 dark:text-amber-300',
    titleColor: 'text-amber-950 dark:text-amber-200',
    glow: 'border-l-4 border-l-amber-500 dark:border-l-amber-600',
    icon: AlertTriangle,
    iconColor: 'text-amber-500 dark:text-amber-400'
  },
  CAUTION: {
    bg: 'bg-rose-50/40 dark:bg-rose-950/10',
    border: 'border-rose-200/55 dark:border-rose-900/40',
    text: 'text-rose-900/90 dark:text-rose-300',
    titleColor: 'text-rose-950 dark:text-rose-200',
    glow: 'border-l-4 border-l-rose-500 dark:border-l-rose-600',
    icon: Shield,
    iconColor: 'text-rose-500 dark:text-rose-455'
  },
  IMPORTANT: {
    bg: 'bg-violet-50/40 dark:bg-violet-950/10',
    border: 'border-violet-200/55 dark:border-violet-900/40',
    text: 'text-violet-900/90 dark:text-violet-300',
    titleColor: 'text-violet-950 dark:text-violet-250',
    glow: 'border-l-4 border-l-violet-500 dark:border-l-violet-600',
    icon: Shield,
    iconColor: 'text-violet-500 dark:text-violet-455'
  }
};

const formatText = (txt: string) => {
  if (!txt) return '';
  // Escape HTML to prevent injection while formatting tokens
  let escaped = txt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline Code
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-150 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-brand-650 dark:text-brand-400 rounded-md font-mono">$1</code>');

  // Bold
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');

  // Italic
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-800 dark:text-slate-205">$1</em>');

  // Metrics Highlight (Currencies, percentages, large aggregates)
  escaped = escaped.replace(/(\$[0-9,]+(?:\.[0-9]+)?|[0-9.]+\s*%\s*|[0-9.]+\s*x\b|[0-9,.]+\s*(?:Millions?|Billions?|Trillions?)\b)/gi, 
    '<span class="inline-block px-1 py-0.5 bg-brand-50/80 dark:bg-brand-950/30 text-brand-650 dark:text-brand-400 font-semibold rounded font-mono text-[9.5px] border border-brand-100/50 dark:border-brand-500/10 leading-none">$1</span>'
  );

  // Status/Risk tag replacements
  escaped = escaped.replace(/(🔴 High|🔴 High Risk|High Risk)/gi, '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 leading-none">🔴 High Risk</span>');
  escaped = escaped.replace(/(🟡 Medium|🟡 Medium Risk|Medium Risk)/gi, '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 leading-none">🟡 Medium Risk</span>');
  escaped = escaped.replace(/(🟢 Low|🟢 Low Risk|Low Risk)/gi, '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-500/20 leading-none">🟢 Low Risk</span>');

  return escaped;
};

// Custom high-performance Spreadsheet grid component with excel tsv copying and csv download
const SpreadsheetTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  const [copied, setCopied] = useState(false);

  const copyTSV = () => {
    const tsv = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = () => {
    const csv = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'datums_space_analysis_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="my-4 border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/60 shadow-md transition-colors select-text">
      {/* Table Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-855 select-none">
        <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">
          <Database className="w-3.5 h-3.5 text-brand-500" />
          Interactive Data Grid
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={copyTSV}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[9.5px] font-bold"
            title="Copy grid data as tab-separated values for direct excel copy-pasting"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500 font-bold">copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-brand-405" />
                <span>copy for excel</span>
              </>
            )}
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[9.5px] font-bold"
            title="Download full grid as local CSV spreadsheet file"
          >
            <Download className="w-3 h-3 text-brand-405" />
            <span>download csv</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet container */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse text-[10.5px] text-slate-700 dark:text-slate-350">
          <thead>
            <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[8.5px]">
              {headers.map((h, idx) => (
                <th key={idx} className="px-4 py-2.5 border-r border-slate-200/60 dark:border-slate-855 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-brand-50/10 dark:hover:bg-brand-950/5 transition-colors font-mono text-[9.5px]">
                {row.map((val, cIdx) => {
                  // Standard numerical right-alignment check
                  const isNumeric = /^\s*[\d,.-]+\s*%?\s*$/g.test(val) || /^\s*\$\s*[\d,.-]+/g.test(val) || /Million|Billion|Trillion/i.test(val);
                  const alignClass = isNumeric ? 'text-right' : 'text-left';
                  
                  return (
                    <td 
                      key={cIdx} 
                      className={`px-4 py-2 border-r border-slate-150 dark:border-slate-855 last:border-r-0 whitespace-nowrap truncate max-w-[185px] ${alignClass}`}
                      title={val}
                      dangerouslySetInnerHTML={{ __html: formatText(val) }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Local preview info banner */}
      <div className="px-4 py-1.5 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-855 text-[8.5px] font-mono text-slate-450 dark:text-slate-500 text-right">
        {rows.length} records parsed in memory | Secure DuckDB sandbox
      </div>
    </div>
  );
};

// Premium syntax-highlighted code drawer
const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs bg-slate-950 text-slate-100 select-text">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 select-none">
        <span className="flex items-center gap-1.5 font-mono text-[9px]">
          <Code className="w-3.5 h-3.5 text-brand-400" />
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors py-0.5 px-1.5 rounded hover:bg-slate-800 text-[9px] font-bold lowercase"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-[10px] leading-relaxed text-slate-355 max-h-[250px] shadow-inner select-all">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Premium Alert callout blocks using HSL vectors and left borders
const GFMAlert: React.FC<{ type: 'NOTE' | 'TIP' | 'WARNING' | 'CAUTION' | 'IMPORTANT'; content: string }> = ({ type, content }) => {
  const styles = ALERT_STYLES[type] || ALERT_STYLES.NOTE;
  const IconComponent = styles.icon;

  return (
    <div className={`p-4 rounded-2xl border my-4 text-[11px] leading-relaxed shadow-3xs flex items-start gap-3 transition-all ${styles.bg} ${styles.border} ${styles.glow} ${styles.text}`}>
      <div className={`p-1 rounded-lg bg-white dark:bg-slate-950 shadow-4xs border border-slate-200/50 dark:border-slate-800/80 flex-shrink-0 ${styles.iconColor}`}>
        <IconComponent className="w-4 h-4" />
      </div>
      <div className="flex-1 select-text">
        <strong className={`uppercase text-[9px] tracking-wider font-extrabold block mb-0.5 ${styles.titleColor}`}>
          {type}
        </strong>
        <span dangerouslySetInnerHTML={{ __html: formatText(content) }} />
      </div>
    </div>
  );
};

// Custom beautiful list renderer with nested diamonds and counts
const ListBlockRenderer: React.FC<{ items: Array<{ text: string; depth: number }>; type: 'bullet' | 'number' }> = ({ items, type }) => {
  return (
    <div className="space-y-1.5 my-3.5 select-text text-left">
      {items.map((item, idx) => {
        // Safe list indent calculations
        const indentLevel = Math.max(0, Math.min(item.depth, 4));
        const plClass = indentLevel === 1 ? 'pl-4 ml-1' : indentLevel === 2 ? 'pl-8 ml-2' : indentLevel >= 3 ? 'pl-12 ml-3' : '';
        
        return (
          <div key={idx} className={`flex items-start gap-2 ${plClass} text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed`}>
            {type === 'bullet' ? (
              <span className={`flex-shrink-0 text-brand-500 dark:text-brand-400 mt-1.5 ${indentLevel > 0 ? 'text-[6px] pl-1 font-bold' : 'text-[7px] font-bold'}`}>
                {indentLevel > 0 ? '○' : '◆'}
              </span>
            ) : (
              <span className="flex-shrink-0 font-mono text-[9px] text-brand-500 dark:text-brand-400 font-extrabold min-w-[14px] mt-0.5">
                {idx + 1}.
              </span>
            )}
            <span 
              className="flex-1"
              dangerouslySetInnerHTML={{ __html: formatText(item.text) }} 
            />
          </div>
        );
      })}
    </div>
  );
};

// Gorgeous collapsible timeline trace logs component
const ReActTimeline: React.FC<{ steps: Array<{ thought: string; sql?: string }> }> = ({ steps }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden shadow-3xs transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-900 transition-all text-left select-none"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500 animate-pulse"></span>
          </span>
          <div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-250 uppercase tracking-wider block leading-none">
              Thinking
            </span>
            <span className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium font-mono mt-1 block leading-none">
              {steps.length} {steps.length === 1 ? 'logical step' : 'sequential steps'} compiled & executed locally
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8.5px] font-mono px-2 py-0.5 bg-brand-500/5 dark:bg-brand-400/5 border border-brand-500/10 dark:border-brand-400/10 rounded-full text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">
            {isOpen ? 'hide trace' : 'expand trace'}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 space-y-4 relative border-t border-slate-200 dark:border-slate-900 select-none">
          <div className="space-y-4 relative pl-3.5 before:absolute before:left-[4px] before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-slate-200 dark:before:bg-slate-850">
            {steps.map((step, idx) => (
              <div key={idx} className="space-y-2 text-[9.5px] relative">
                {/* Timeline Pulsing Node */}
                <div className="absolute -left-[18.5px] top-[3.5px] w-2.5 h-2.5 rounded-full border-2 border-brand-500 bg-white dark:bg-slate-950 shadow-sm animate-pulse" />
                
                <p className="font-semibold text-slate-700 dark:text-slate-300 leading-normal font-sans text-left">
                  <span className="text-brand-600 dark:text-brand-455 font-extrabold uppercase text-[8.5px] tracking-wider mr-1.5">Thought #{idx + 1}:</span> 
                  {step.thought}
                </p>
                {step.sql && (
                  <div className="border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-950/30 overflow-hidden shadow-3xs max-w-full">
                    <div className="px-2.5 py-1.5 text-[8px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/50 dark:border-slate-850">
                      <span className="flex items-center gap-1 font-sans">
                        <Terminal className="w-3 h-3 text-brand-500" />
                        Executed Sandbox Query
                      </span>
                      <span className="text-[7.5px] border border-slate-200 dark:border-slate-800 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-900 font-mono text-brand-500">DuckDB-Wasm</span>
                    </div>
                    <pre className="p-2.5 bg-slate-50/20 dark:bg-slate-950/20 font-mono text-[8.5px] text-slate-700 dark:text-slate-350 overflow-x-auto leading-relaxed select-all">
                      {step.sql}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to check if text contains markdown structures (headings, lists, tables)
function hasMarkdownStructures(txt: string): boolean {
  return /^\s*(#{1,6}\s+|-\s+|\*\s+|\d+\.\s+|\|)/m.test(txt);
}

// Stateful Markdown Block-level Lexer & Parser
function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```markdown') && cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(11, -3).trim();
  } else if (cleanedText.startsWith('```text') && cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(7, -3).trim();
  } else if (cleanedText.startsWith('```') && cleanedText.endsWith('```')) {
    const innerMatches = cleanedText.match(/```/g);
    if (innerMatches && innerMatches.length >= 4) {
      cleanedText = cleanedText.slice(3, -3).trim();
    }
  }

  const lines = cleanedText.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  const listRegex = /^(\s*)([-*]|\d+\.)\s+(.*)/;
  const mermaidRegex = /^\s*(?:mermaid\s+)?(pie\b|graph\s+(TD|TB|LR|RL|BT)\b|flowchart\s+(TD|TB|LR|RL|BT)\b|sequenceDiagram\b|gantt\b|mindmap\b|classDiagram\b|stateDiagram\b|erDiagram\b|journey\b|timeline\b|quadrant\b|gitGraph\b)/i;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block parsing
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      let codeText = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeText += lines[i] + '\n';
        i++;
      }
      if (codeText.endsWith('\n')) {
        codeText = codeText.slice(0, -1);
      }
      
      const langLower = lang.toLowerCase();
      const isTextOrMarkdown = langLower === 'text' || langLower === 'markdown' || langLower === '';
      if (isTextOrMarkdown && hasMarkdownStructures(codeText)) {
        // Recursively parse the inner markdown and merge its blocks!
        const subBlocks = parseMarkdownBlocks(codeText);
        blocks.push(...subBlocks);
      } else {
        blocks.push({
          type: 'code',
          codeLang: lang || 'text',
          codeText: codeText,
        });
      }
      i++;
      continue;
    }

    // 1b. Raw (unfenced) Mermaid diagram parsing
    if (mermaidRegex.test(line)) {
      let mermaidText = '';
      while (i < lines.length && 
             lines[i].trim() && 
             !lines[i].trim().startsWith('```') && 
             !lines[i].trim().startsWith('#') &&
             !lines[i].trim().startsWith('|') &&
             !listRegex.test(lines[i])) {
        mermaidText += lines[i] + '\n';
        i++;
      }
      blocks.push({
        type: 'code',
        codeLang: 'mermaid',
        codeText: mermaidText.trim(),
      });
      continue;
    }

    // 2. Table parsing (Robust capture of tables at the very end of messages)
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length > 0) {
        let headers: string[] = [];
        const rows: string[][] = [];

        const firstLine = tableLines[0];
        const rawHeaders = firstLine.split('|').map(p => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        let startIdx = 1;
        if (tableLines[1] && tableLines[1].includes('---')) {
          headers = rawHeaders;
          startIdx = 2;
        } else {
          headers = rawHeaders;
        }

        for (let r = startIdx; r < tableLines.length; r++) {
          const rowLine = tableLines[r];
          const parts = rowLine.split('|').map(p => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          rows.push(parts);
        }

        blocks.push({
          type: 'table',
          tableHeaders: headers,
          tableRows: rows,
        });
      }
      continue;
    }

    // 3. Alert Callout box parsing
    if (line.trim().startsWith('>') && line.includes('[!')) {
      const alertMatch = line.match(/\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]/i);
      const alertType = alertMatch ? (alertMatch[1].toUpperCase() as any) : 'NOTE';
      
      let alertContent = '';
      const initialText = line.replace(/^>\s*\[![^\]]+\]\s*/, '').trim();
      if (initialText) {
        alertContent += initialText;
      }

      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const textSegment = lines[i].replace(/^>\s*/, '').trim();
        if (alertContent && textSegment) {
          alertContent += ' ' + textSegment;
        } else if (textSegment) {
          alertContent = textSegment;
        }
        i++;
      }

      blocks.push({
        type: 'alert',
        alertType,
        content: alertContent,
      });
      continue;
    }

    // 4. General Blockquote parsing
    if (line.trim().startsWith('>')) {
      let bqContent = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const textSegment = lines[i].replace(/^>\s*/, '').trim();
        if (bqContent && textSegment) {
          bqContent += ' ' + textSegment;
        } else if (textSegment) {
          bqContent = textSegment;
        }
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: bqContent,
      });
      continue;
    }

    // 5. Unordered & Ordered list parsing
    if (listRegex.test(line)) {
      const items: Array<{ text: string; depth: number }> = [];
      let listType: 'bullet' | 'number' = 'bullet';
      
      const firstMatch = line.match(listRegex);
      if (firstMatch && /\d+/.test(firstMatch[2])) {
        listType = 'number';
      }

      while (i < lines.length && listRegex.test(lines[i])) {
        const match = lines[i].match(listRegex);
        if (match) {
          const indent = match[1].length;
          const text = match[3];
          items.push({ text, depth: Math.floor(indent / 2) });
        }
        i++;
      }

      blocks.push({
        type: 'list',
        listType,
        listItems: items,
      });
      continue;
    }

    // 6. Header tags parsing
    if (line.trim().startsWith('#')) {
      const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        blocks.push({
          type: 'heading',
          level,
          content: text,
        });
        i++;
        continue;
      }
    }

    // 7. Regular paragraph text block assembly
    if (line.trim()) {
      let paraText = line.trim();
      i++;
      while (i < lines.length && 
             lines[i].trim() && 
             !lines[i].trim().startsWith('```') && 
             !lines[i].trim().startsWith('|') && 
             !lines[i].trim().startsWith('>') && 
             !lines[i].trim().startsWith('#') && 
             !listRegex.test(lines[i])) {
        paraText += ' ' + lines[i].trim();
        i++;
      }
      blocks.push({
        type: 'paragraph',
        content: paraText,
      });
      continue;
    }

    i++;
  }

  return blocks;
}

// Sleek Agentic Markdown parser & Stepper Visualizer
const AgenticMarkdown: React.FC<{ text: string }> = ({ text }) => {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```markdown') && cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(11, -3).trim();
  } else if (cleanedText.startsWith('```text') && cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(7, -3).trim();
  } else if (cleanedText.startsWith('```') && cleanedText.endsWith('```')) {
    const innerMatches = cleanedText.match(/```/g);
    if (innerMatches && innerMatches.length >= 4) {
      cleanedText = cleanedText.slice(3, -3).trim();
    }
  }

  let mainText = cleanedText;
  let reasoningSteps: Array<{ thought: string; sql?: string }> = [];

  const reasoningRegex = /(?:ReAct\s+)?Reasoning\s+Process\s*\n*(?:<details>[\s\S]+?<\/details>)/i;
  const reasoningMatch = cleanedText.match(reasoningRegex);
  
  if (reasoningMatch) {
    const matchedSegment = reasoningMatch[0];
    mainText = cleanedText.replace(matchedSegment, '').trim();

    // Parse thoughts and SQLs inside details
    const steps = matchedSegment.split(/Thought\s*\d+/i);
    if (steps.length > 1) {
      steps.forEach((s) => {
        if (!s.trim()) return;
        
        // Match thought title or content
        const thoughtMatch = s.match(/:\s*([^\n]+)/i) || s.match(/\*\*:\s*"([^"]+)"/i) || s.match(/:\s*"([^"]+)"/i);
        let thought = thoughtMatch ? thoughtMatch[1] : 'Analyzing metrics...';
        thought = thought.replace(/^["']|["']$/g, '').replace(/<\/?[^>]+(>|$)/g, "").trim();
        if (thought.startsWith('Objective:')) {
          thought = thought.replace('Objective:', '').trim();
        }
        
        const sqlMatch = s.match(/(SELECT[\s\S]+?;)/i) || s.match(/SQL Query:\s*`([^`]+)`/i) || s.match(/- Executed SQL\s?\d?:\s*`([^`]+)`/i) || s.match(/`([^`]+)`/i);
        const sql = sqlMatch ? sqlMatch[1].replace(/`/g, '').trim() : undefined;
        
        reasoningSteps.push({ thought, sql });
      });
    }
  } else {
    // Check if the user message contains a general raw <details> tag of any formatting
    const generalDetailsRegex = /<details>([\s\S]+?)<\/details>/i;
    const generalDetailsMatch = cleanedText.match(generalDetailsRegex);
    if (generalDetailsMatch) {
      const fullMatchStr = generalDetailsMatch[0];
      const detailsBodyText = generalDetailsMatch[1];
      mainText = cleanedText.replace(fullMatchStr, '').trim();
      
      // Clean up optional header right before details block if any
      mainText = mainText.replace(/(?:ReAct\s+)?Reasoning\s+Process\s*\n*$/i, '').trim();
      
      // Parse thoughts and queries out of the details body text
      const steps = detailsBodyText.split(/Thought\s*\d+/i);
      if (steps.length > 1) {
        steps.forEach((s) => {
          if (!s.trim()) return;
          
          const thoughtMatch = s.match(/:\s*([^\n]+)/i) || s.match(/\*\*:\s*"([^"]+)"/i) || s.match(/:\s*"([^"]+)"/i);
          let thought = thoughtMatch ? thoughtMatch[1] : 'Analyzing metrics...';
          thought = thought.replace(/^["']|["']$/g, '').replace(/<\/?[^>]+(>|$)/g, "").trim();
          if (thought.startsWith('Objective:')) {
            thought = thought.replace('Objective:', '').trim();
          }
          
          const sqlMatch = s.match(/(SELECT[\s\S]+?;)/i) || s.match(/SQL Query:\s*`([^`]+)`/i) || s.match(/- Executed SQL\s?\d?:\s*`([^`]+)`/i) || s.match(/`([^`]+)`/i);
          const sql = sqlMatch ? sqlMatch[1].replace(/`/g, '').trim() : undefined;
          
          reasoningSteps.push({ thought, sql });
        });
      }
    } else {
      // Standard text fallback
      const textReasoningRegex = /Reasoning Process:([\s\S]+?)(?=\n\n(?:###|####|#|Dear|Write|🏆|$))/i;
      const textReasoningMatch = cleanedText.match(textReasoningRegex);
      if (textReasoningMatch) {
        const matchedSegment = textReasoningMatch[0];
        const reasoningText = textReasoningMatch[1];
        mainText = cleanedText.replace(matchedSegment, '').trim();
        
        const steps = reasoningText.split(/\d+\.\s+\*\*Thought/i);
        steps.forEach((s) => {
          if (!s.trim()) return;
          
          const thoughtMatch = s.match(/\d?\*\*:\s*"([^"]+)"/i) || s.match(/:\s*"([^"]+)"/i) || s.match(/:\s*([^\n]+)/i);
          let thought = thoughtMatch ? thoughtMatch[1] : 'Analyzing metrics...';
          thought = thought.replace(/^["']|["']$/g, '');
          
          const sqlMatch = s.match(/- Executed SQL\s?\d?:\s*`([^`]+)`/i) || s.match(/`([^`]+)`/i);
          const sql = sqlMatch ? sqlMatch[1] : undefined;
          
          reasoningSteps.push({ thought, sql });
        });
      }
    }
  }

  const blocks = parseMarkdownBlocks(mainText);

  return (
    <div className="space-y-4 font-sans leading-relaxed select-text text-left">
      {/* Glowing timeline ReAct logs */}
      {reasoningSteps.length > 0 && (
        <ReActTimeline steps={reasoningSteps} />
      )}

      {/* Main analytical blocks body */}
      <div className="space-y-3.5">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case 'heading': {
              const contentHtml = formatText(block.content || '');
              if (block.level === 1) {
                return (
                  <h1 key={idx} className="text-sm font-extrabold text-slate-855 dark:text-slate-100 mt-5 mb-2.5 first:mt-0 tracking-tight border-b border-slate-200/50 dark:border-slate-800 pb-1 flex items-center gap-1.5" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                );
              }
              if (block.level === 2) {
                return (
                  <h2 key={idx} className="text-xs font-bold text-slate-800 dark:text-slate-150 mt-4 mb-2 first:mt-0 border-b border-slate-150 dark:border-slate-900 pb-0.5" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                );
              }
              if (block.level === 3) {
                return (
                  <h3 key={idx} className="text-[10px] font-extrabold text-brand-650 dark:text-brand-400 mt-4 mb-1.5 uppercase tracking-wider" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                );
              }
              return (
                <h4 key={idx} className="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 mt-3 mb-1 uppercase tracking-widest" dangerouslySetInnerHTML={{ __html: contentHtml }} />
              );
            }
            case 'code':
              if (block.codeLang?.toLowerCase() === 'mermaid') {
                return <MermaidChart key={idx} chart={block.codeText || ''} />;
              }
              return (
                <CodeBlock key={idx} lang={block.codeLang || 'text'} code={block.codeText || ''} />
              );
            case 'table':
              return (
                <SpreadsheetTable key={idx} headers={block.tableHeaders || []} rows={block.tableRows || []} />
              );
            case 'alert':
              return (
                <GFMAlert key={idx} type={block.alertType || 'NOTE'} content={block.content || ''} />
              );
            case 'blockquote':
              return (
                <blockquote key={idx} className="pl-4 border-l-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 italic my-3 text-[10.5px] bg-slate-50/30 dark:bg-slate-950/20 py-1.5 pr-2 rounded-r-lg leading-normal">
                  <span dangerouslySetInnerHTML={{ __html: formatText(block.content || '') }} />
                </blockquote>
              );
            case 'list':
              return (
                <ListBlockRenderer key={idx} items={block.listItems || []} type={block.listType || 'bullet'} />
              );
            case 'paragraph':
            default:
              return (
                <p key={idx} className="mb-2 last:mb-0 leading-relaxed text-[11px] text-slate-700 dark:text-slate-350" dangerouslySetInnerHTML={{ __html: formatText(block.content || '') }} />
              );
          }
        })}
      </div>
    </div>
  );
};

export const ChatInterface: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<AgentPersona>(agentManager.getActiveAgent());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeTables, setActiveTables] = useState<any[]>([]);
  const [isBoardroomPanelOpen, setIsBoardroomPanelOpen] = useState(false);
  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>(() => agentManager.getEnabledAgents());
  const isLoading = chatHistory.some((m) => m.id.startsWith('msg-agent-temp'));

  // Expandable console lists
  const [expandedSqlIds, setExpandedSqlIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isToolEngineCollapsed, setIsToolEngineCollapsed] = useState(() => localStorage.getItem('datum_s_tool_engine_collapsed') === 'true');

  const toggleToolEngine = () => {
    setIsToolEngineCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('datum_s_tool_engine_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    // 1. Sync states from managers
    setActiveAgent(agentManager.getActiveAgent());
    setChatHistory(agentManager.getChatHistory());
    setActiveTables(duckDbService.getActiveTables());

    // Sync initial boardroom state if already active
    const initSession = agentManager.getBoardroomSession();
    if (initSession.isActive) {
      setIsBoardroomPanelOpen(true);
    }

    // 2. Register callbacks on EventBus signals
    const unsubAgent = eventBus.on('ACTIVE_AGENT_CHANGED', (agent) => {
      setActiveAgent(agent);
    });

    const unsubChat = eventBus.on('CHAT_HISTORY_UPDATED', (history) => {
      setChatHistory(history);
      scrollToBottom();
    });

    const unsubTables = eventBus.on('TABLES_UPDATED', () => {
      setActiveTables(duckDbService.getActiveTables());
    });

    const unsubBoardroom = eventBus.on('BOARDROOM_SESSION_UPDATED', (sessionState) => {
      if (sessionState.isActive) {
        setIsBoardroomPanelOpen(true);
      }
    });

    const unsubEnabled = eventBus.on('ENABLED_AGENTS_CHANGED', (agents) => {
      setEnabledAgents(agents);
      setActiveAgent(agentManager.getActiveAgent());
    });

    const unsubSuggestion = eventBus.on('SUGGESTION_CLICKED', ({ text, execute }: { text: string; execute: boolean }) => {
      if (execute) {
        setInputText('');
        agentManager.sendMessage(text);
      } else {
        setInputText(text);
      }
    });

    scrollToBottom();

    return () => {
      unsubAgent();
      unsubChat();
      unsubTables();
      unsubBoardroom();
      unsubEnabled();
      unsubSuggestion();
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) setInputText('');
    
    await agentManager.sendMessage(text);
  };

  const toggleSqlExpand = (msgId: string) => {
    setExpandedSqlIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  // Compile list of context-aware Quick Starters depending on active tables and selected agent


  const handleAgentToggle = (id: AgentId) => {
    agentManager.setActiveAgent(id);
  };

  const agents: Array<{ id: AgentId; icon: string; name: string }> = [
    { id: 'analyst', icon: '📊', name: 'Data Analyst' },
    { id: 'cso', icon: '🎯', name: 'Strategist' },
    { id: 'logistics', icon: '🚚', name: 'Supply Chain' },
    { id: 'auditor', icon: '🔎', name: 'Auditor' },
    { id: 'growth', icon: '🚀', name: 'Growth Partner' },
    { id: 'engineer', icon: '⚙️', name: 'Data Engineer' },
    { id: 'compliance', icon: '🛡️', name: 'Compliance' },
    { id: 'product', icon: '📱', name: 'Product UX' },
    { id: 'finance', icon: '💵', name: 'CFO' },
    { id: 'marketing', icon: '📢', name: 'Marketing' },
    { id: 'hr', icon: '🤝', name: 'HR' },
  ];

  const visibleAgents = agents.filter((ag) => enabledAgents.includes(ag.id));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-955/20 relative min-w-0 transition-colors duration-300">
      {/* Top Banner - Agent Selector Header */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-4 flex justify-center select-none transition-colors duration-300 shadow-xs">
        {/* Floating Bubble switches */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-900 p-1 rounded-xl gap-1 overflow-x-auto max-w-full flex-nowrap scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {visibleAgents.map((ag) => (
            <button
              key={ag.id}
              onClick={() => handleAgentToggle(ag.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                activeAgent.id === ag.id
                  ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
              }`}
            >
              <PersonaLogo agentId={ag.id} className="w-4 h-4" />
              <span className="inline">{ag.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Messages stream pane */}
      <main className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0 bg-slate-100/10 dark:bg-slate-955/5">
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-3xl ${msg.sender === 'user' ? 'ml-auto justify-end' : 'mr-auto'}`}
          >
            {/* Avatar */}
            {msg.sender === 'agent' && (() => {
              const persona = msg.agentId ? agentManager.getPersona(msg.agentId) : null;
              return (
                <div 
                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 flex items-center justify-center shadow-xs flex-shrink-0"
                  title={persona ? `${persona.name} (${persona.title})` : 'AI Assistant'}
                >
                  <PersonaLogo agentId={msg.agentId || 'generic'} className="w-6.5 h-6.5" />
                </div>
              );
            })()}

            {/* Bubble */}
            <div className="space-y-3 overflow-hidden flex-1 min-w-0">
              <div
                className={`rounded-2xl px-5 py-4 text-xs shadow-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-brand-600 text-white font-medium border border-brand-500/40 rounded-tr-none shadow-md shadow-brand-600/10'
                    : 'bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 border-l-[3px] rounded-tl-none text-slate-800 dark:text-slate-300 shadow-sm'
                }`}
                style={(() => {
                  if (msg.sender === 'agent' && msg.agentId) {
                    const persona = agentManager.getPersona(msg.agentId);
                    return { borderLeftColor: persona ? persona.themeColor : activeAgent.themeColor };
                  }
                  return undefined;
                })()}
              >
                {/* Agent Identity Signature Header */}
                {msg.sender === 'agent' && (() => {
                  const persona = msg.agentId ? agentManager.getPersona(msg.agentId) : null;
                  if (!persona) return null;
                  return (
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-850 select-none font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold text-slate-855 dark:text-slate-100 leading-none">{persona.name}</span>
                        <span className="h-3 w-[1px] bg-slate-200 dark:bg-slate-800" />
                        <span className="text-[8.5px] text-slate-550 font-bold uppercase tracking-wider leading-none">{persona.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-brand-500/5 dark:bg-brand-400/5 border border-brand-500/10 dark:border-brand-400/10 text-brand-650 dark:text-brand-400 uppercase tracking-widest leading-none">
                          sandboxed
                        </span>
                        <span className="text-[8.5px] font-mono text-slate-400 font-medium leading-none">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Agentic Markdown parsing card */}
                {msg.sender === 'user' ? (
                  <div className="font-sans leading-relaxed whitespace-pre-wrap text-[11px] font-medium">
                    {msg.text}
                  </div>
                ) : (
                  <AgenticMarkdown text={msg.text} />
                )}
              </div>

              {/* Transaction Action Gates */}
              {msg.isWriteTransaction && (
                <div className="mt-4 pt-3.5 border-t border-slate-150 dark:border-slate-805 space-y-3 select-none">
                  
                  {msg.transactionStatus === 'pending' && (
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-900 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        <span>⚠️ Pending Authorization</span>
                        <span>DuckDB Sandbox Gate</span>
                      </div>
                      <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed font-medium">
                        Executing this SQL query will permanently update or alter the loaded database sandbox in browser memory.
                      </p>
                      <pre className="p-2.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-900 rounded-lg text-[9.5px] font-mono text-slate-750 dark:text-slate-305 overflow-x-auto leading-relaxed select-all">
                        {msg.sqlQuery}
                      </pre>
                      <div className="flex gap-2">
                        <button
                          onClick={() => agentManager.approveTransaction(msg.id)}
                          className="flex-1 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
                        >
                          Yes, Execute
                        </button>
                        <button
                          onClick={() => {
                            msg.transactionStatus = 'rejected';
                            msg.text = `❌ **Transaction Canceled.**\n\nI have aborted the database modification transaction as requested. No records were modified.`;
                            eventBus.emit('CHAT_HISTORY_UPDATED', agentManager.getChatHistory());
                          }}
                          className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-400 rounded-lg text-[10px] font-bold transition-all"
                        >
                          No, Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.transactionStatus === 'executed' && (
                    <div className="space-y-3 bg-emerald-550/5 dark:bg-emerald-955/10 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-500/20 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        <span>✅ Modified Dataset Review</span>
                        <span>Reversible Backup Live</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        Changes are loaded in memory. If they appear incorrect or corrupt, you can instantly revert back to the original backup dataset.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => agentManager.confirmTransaction(msg.id)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
                        >
                          Keep Safe (Commit)
                        </button>
                        <button
                          onClick={() => agentManager.revertTransaction(msg.id)}
                          className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
                        >
                          Revert Changes (Rollback)
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.transactionStatus === 'approved' && (
                    <div className="p-2.5 bg-emerald-50/30 dark:bg-emerald-950/5 rounded-xl border border-emerald-100/40 dark:border-emerald-500/10 text-emerald-600 dark:text-emerald-450 text-[10px] font-semibold flex items-center gap-1.5 shadow-inner">
                      <span>🔒</span> Committed safely. Backup records purged from browser storage.
                    </div>
                  )}

                  {msg.transactionStatus === 'reverted' && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900 text-slate-555 dark:text-slate-400 text-[10px] font-semibold flex items-center gap-1.5 shadow-inner">
                      <span>🔄</span> Transaction successfully rolled back to sandboxed baseline.
                    </div>
                  )}

                  {msg.transactionStatus === 'rejected' && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900 text-slate-555 dark:text-slate-455 text-[10px] font-semibold flex items-center gap-1.5 shadow-inner">
                      <span>❌</span> Transaction canceled by operator clearance.
                    </div>
                  )}

                </div>
              )}

              {/* Local Sandbox Database Inspector Grid */}
              {msg.sqlQuery && (
                <div className="bg-slate-50 dark:bg-slate-900/15 border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden shadow-md">
                  <button
                    onClick={() => toggleSqlExpand(msg.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border-b border-slate-200 dark:border-slate-900 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450"
                  >
                    <span className="flex items-center gap-1.5 font-mono text-[9px] text-brand-650 dark:text-brand-400 lowercase">
                      <Terminal className="w-3.5 h-3.5 text-brand-650 dark:text-brand-400" />
                      {expandedSqlIds.includes(msg.id) ? 'hide executable sql' : 'view executed local sql'}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-555 lowercase font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      DuckDB sandbox | {msg.sqlDurationMs || 8}ms
                      {expandedSqlIds.includes(msg.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {expandedSqlIds.includes(msg.id) && (
                    <div className="p-4 space-y-4 bg-slate-100/40 dark:bg-slate-955/20 font-mono text-[10px]">
                      {/* Code block */}
                      <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-lg text-slate-700 dark:text-slate-355 overflow-x-auto leading-relaxed max-h-[120px] select-all shadow-inner">
                        {msg.sqlQuery}
                      </pre>

                      {/* Spreadsheet preview grid */}
                      {msg.sqlResult && msg.sqlResult.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest block flex items-center gap-1">
                            <Database className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                            Database result sets preview (up to 5 rows)
                          </span>
                          
                          <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg bg-white dark:bg-slate-955/60 max-h-[160px] shadow-sm">
                            <table className="w-full text-left border-collapse text-[10px] text-slate-700 dark:text-slate-300">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-855 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                  {Object.keys(msg.sqlResult[0]).map((h) => (
                                    <th key={h} className="px-3 py-2 min-w-[100px]">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                                {msg.sqlResult.slice(0, 5).map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-950/40">
                                    {Object.keys(msg.sqlResult![0]).map((h) => (
                                      <td key={h} className="px-3 py-1.5 truncate max-w-[150px]">
                                        {String(row[h] ?? '')}
                                      </td>
                                    ))}
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
              )}

              {/* Local dynamic Mermaid compiled visualization */}
              {msg.mermaidChart && !(/```mermaid/i.test(msg.text) || /^\s*(pie\b|graph\s+\w+|flowchart\s+\w+|sequenceDiagram\b|gantt\b|mindmap\b|classDiagram\b|stateDiagram\b|erDiagram\b|journey\b|timeline\b|quadrant\b|gitGraph\b)/mi.test(msg.text)) && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-650 uppercase tracking-widest block flex items-center gap-1">
                    <Code className="w-3 h-3 text-slate-405 dark:text-slate-600" />
                    Strategic Roadmap diagram
                  </span>
                  <MermaidChart chart={msg.mermaidChart} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input container pane */}
      <footer className="p-4 border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 space-y-3 shadow-md select-none transition-colors duration-300">
        {/* Context-aware Agentic Tool Engine */}
        <div className="flex flex-col space-y-3 border-b border-slate-150 dark:border-slate-900 pb-3">
          <div 
            onClick={toggleToolEngine}
            className="flex items-center justify-between cursor-pointer group select-none hover:opacity-85"
          >
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-555 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-brand-500" />
              🛠️ Agentic Tool Engine
              {isToolEngineCollapsed && (
                <span className="ml-2 text-[7.5px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 font-bold font-sans normal-case tracking-normal">4 Tools Active</span>
              )}
            </span>
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-455 transition-colors">
              <span className="text-[8px] font-mono uppercase">
                {isToolEngineCollapsed ? 'expand menu' : 'collapse menu'}
              </span>
              {isToolEngineCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </div>
          </div>

          {!isToolEngineCollapsed && (
            <div className="flex sm:grid overflow-x-auto sm:overflow-x-visible gap-3 sm:grid-cols-2 md:grid-cols-4 animate-[fadeIn_0.2s_ease-out] flex-nowrap sm:flex-wrap pb-2 sm:pb-0 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* Tool 1: Human Scan Insights */}
              <div 
                onClick={() => {
                  const activeT = activeTables[0]?.name;
                  if (activeT) {
                    agentManager.scanTableAsHuman(activeT);
                  } else {
                    eventBus.emit('SWITCH_TAB', 'ingest');
                  }
                }}
                className={`p-3 border rounded-xl bg-slate-50/50 hover:bg-slate-100/70 dark:bg-slate-900/10 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-855 hover:border-brand-500/30 dark:hover:border-brand-500/25 transition-all shadow-2xs group flex flex-col justify-between text-left cursor-pointer flex-shrink-0 w-[240px] sm:w-auto ${
                  activeTables.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-805 dark:text-slate-200 flex items-center gap-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      🔍 Human Scan Insights
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal font-sans">
                    Scans loaded spreadsheet at eye-level to profile columns, nulls, and structures.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-150 dark:border-slate-900/60">
                  <span className="text-[7.5px] font-mono text-slate-400 dark:text-slate-600 uppercase">Dispatched</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[7px] font-bold uppercase tracking-wider">📊 Ada</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-650 dark:text-cyan-400 text-[7px] font-bold uppercase tracking-wider">⚙️ Silas</span>
                  </div>
                </div>
              </div>

              {/* Tool 2: Boardroom Consensus */}
              <div 
                onClick={() => {
                  const query = inputText.trim() || "Perform an end-to-end strategic review on current performance metrics";
                  setInputText('');
                  agentManager.startBoardroomConsensus(query);
                }}
                className={`p-3 border rounded-xl bg-slate-50/50 hover:bg-slate-100/70 dark:bg-slate-900/10 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-855 hover:border-brand-500/30 dark:hover:border-brand-500/25 transition-all shadow-2xs group flex flex-col justify-between text-left cursor-pointer flex-shrink-0 w-[240px] sm:w-auto ${
                  activeTables.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-805 dark:text-slate-200 flex items-center gap-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      👥 Boardroom Consensus
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal font-sans">
                    Summons key agent personas to deliver multi-perspective briefings and audited resolutions.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-150 dark:border-slate-900/60">
                  <span className="text-[7.5px] font-mono text-slate-400 dark:text-slate-600 uppercase">Dispatched</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[7px] font-bold uppercase tracking-wider">📊 Ada</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 text-[7px] font-bold uppercase tracking-wider">🎯 Marcus</span>
                  </div>
                </div>
              </div>

              {/* Tool 3: Concentration Optimizer */}
              <div 
                onClick={() => {
                  const activeT = activeTables[0]?.name;
                  if (activeT) {
                    agentManager.setActiveAgent('analyst');
                    agentManager.sendMessage(`Perform an automated Pareto (80/20) concentration analysis and calculate Gini coefficients on the loaded dataset table '${activeT}'.`);
                  } else {
                    eventBus.emit('SWITCH_TAB', 'ingest');
                  }
                }}
                className={`p-3 border rounded-xl bg-slate-50/50 hover:bg-slate-100/70 dark:bg-slate-900/10 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-855 hover:border-brand-500/30 dark:hover:border-brand-500/25 transition-all shadow-2xs group flex flex-col justify-between text-left cursor-pointer flex-shrink-0 w-[240px] sm:w-auto ${
                  activeTables.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-850 dark:text-slate-200 flex items-center gap-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      📊 Concentration Optimizer
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal font-sans">
                    Isolates top categories driving 80% cumulative volume and maps data inequality spreads.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-150 dark:border-slate-900/60">
                  <span className="text-[7.5px] font-mono text-slate-400 dark:text-slate-600 uppercase">Dispatched</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[7px] font-bold uppercase tracking-wider">📊 Ada</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-450 text-[7px] font-bold uppercase tracking-wider">🎯 Marcus</span>
                  </div>
                </div>
              </div>

              {/* Tool 4: SWOT & OKR Strategic Planner */}
              <div 
                onClick={() => {
                  const activeT = activeTables[0]?.name;
                  if (activeT) {
                    agentManager.setActiveAgent('cso');
                    agentManager.sendMessage(`Perform a comprehensive corporate SWOT matrix audit and generate 3 actionable OKR planners based on the metrics inside table '${activeT}'.`);
                  } else {
                    eventBus.emit('SWITCH_TAB', 'ingest');
                  }
                }}
                className={`p-3 border rounded-xl bg-slate-50/50 hover:bg-slate-100/70 dark:bg-slate-900/10 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-855 hover:border-brand-500/30 dark:hover:border-brand-500/25 transition-all shadow-2xs group flex flex-col justify-between text-left cursor-pointer flex-shrink-0 w-[240px] sm:w-auto ${
                  activeTables.length === 0 ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-855 dark:text-slate-200 flex items-center gap-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      🎯 SWOT & OKR Planner
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal font-sans">
                    Synthesizes sandbox records into corporate OKR objectives and high-level SWOT vectors.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-150 dark:border-slate-900/60">
                  <span className="text-[7.5px] font-mono text-slate-400 dark:text-slate-600 uppercase">Dispatched</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 text-[7px] font-bold uppercase tracking-wider">🎯 Marcus</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[7px] font-bold uppercase tracking-wider">📊 Ada</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${isLoading ? 'bg-gradient-to-br from-slate-100/40 to-slate-50/20 dark:from-slate-950/40 dark:to-slate-900/20 border border-slate-200/80 dark:border-slate-800' : ''}`}>
          {isLoading && (
            <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-35 select-none overflow-hidden z-0 animate-[fadeIn_0.2s_ease-out]">
              <style>{`
                @keyframes float-geom-chat-1 {
                  0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
                  50% { transform: translate(12px, -6px) rotate(180deg) scale(1.1); }
                  100% { transform: translate(0px, 0px) rotate(360deg) scale(1); }
                }
                @keyframes float-geom-chat-2 {
                  0% { transform: translate(0px, 0px) rotate(360deg) scale(1.15); }
                  50% { transform: translate(-18px, 8px) rotate(180deg) scale(0.95); }
                  100% { transform: translate(0px, 0px) rotate(0deg) scale(1.15); }
                }
              `}</style>

              {/* Shape 1: Glowing agent theme-colored circle */}
              <div 
                className="absolute rounded-full filter blur-[1.5px]" 
                style={{
                  width: '32px',
                  height: '32px',
                  left: '15%',
                  top: '15%',
                  background: `radial-gradient(circle, ${activeAgent.themeColor} 0%, transparent 80%)`,
                  animation: 'float-geom-chat-1 10s infinite ease-in-out'
                }}
              />

              {/* Shape 2: Rotating border-only square */}
              <div 
                className="absolute border-[1px] filter blur-[0.1px]" 
                style={{
                  width: '18px',
                  height: '18px',
                  right: '25%',
                  bottom: '15%',
                  borderColor: activeAgent.themeColor,
                  opacity: 0.7,
                  borderRadius: '4px',
                  animation: 'float-geom-chat-2 12s infinite ease-in-out'
                }}
              />

              {/* Shape 3: Soft glowing outline triangle */}
              <svg 
                className="absolute" 
                style={{
                  width: '18px',
                  height: '18px',
                  left: '45%',
                  bottom: '20%',
                  fill: 'none',
                  stroke: activeAgent.themeColor,
                  strokeWidth: 1.5,
                  opacity: 0.6,
                  animation: 'float-geom-chat-1 11s infinite ease-in-out'
                }}
                viewBox="0 0 24 24"
              >
                <polygon points="12,2 22,22 2,22" />
              </svg>
            </div>
          )}

          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isLoading ? `${activeAgent.name} is formulating...` : (window.innerWidth < 640 ? `Message ${activeAgent.name}` : `Ask ${activeAgent.name} to conduct statistical reconciliation or audit reports...`)}
            className={`w-full text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-4 pr-12 py-3.5 outline-none resize-none placeholder-slate-550 shadow-xs focus:bg-white transition-all relative z-10 overflow-y-hidden ${
              isLoading 
                ? 'bg-transparent border-transparent cursor-not-allowed text-slate-450 dark:text-slate-500' 
                : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/25 focus:bg-white'
            }`}
            style={{ height: '46px', minHeight: '46px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputText.trim()}
            className="absolute right-3.5 top-3.5 p-1.5 bg-brand-650 hover:bg-brand-600 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-800 text-white rounded-lg transition-all shadow-md z-20"
          >
            {isLoading ? (
              <span className="w-3.5 h-3.5 border border-brand-400 border-t-transparent animate-spin rounded-full block" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </footer>

      {isBoardroomPanelOpen && (
        <BoardroomDashboard 
          onClose={() => {
            setIsBoardroomPanelOpen(false);
            const sess = agentManager.getBoardroomSession();
            sess.isActive = false;
            eventBus.emit('BOARDROOM_SESSION_UPDATED', sess);
          }} 
        />
      )}
    </div>
  );
};

export default ChatInterface;
