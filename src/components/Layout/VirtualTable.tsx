import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Filter } from 'lucide-react';

/* ─── types ─── */
export interface VirtualTableProps {
  headers: string[];
  rows: any[];
  totalRowCount: number;
  /** CSS height string for the scroll container, e.g. "100%" or "220px" */
  height?: string;
  /** Row height in px — must be fixed for virtual scroll math */
  rowHeight?: number;
  /** Extra rows rendered above/below viewport */
  overscan?: number;

  /* sorting (controlled externally) */
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;

  /* search highlighting */
  searchTerm?: string;

  /* per-column filters */
  filters?: Record<string, string>;
  onFilterChange?: (column: string, value: string) => void;
  showFilters?: boolean;

  /** Show row-number gutter */
  showRowNumbers?: boolean;

  /** Extra className on the outer wrapper */
  className?: string;
}

/* ─── highlight helper ─── */
function highlightText(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerTerm, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={idx} className="bg-yellow-300/80 dark:bg-yellow-500/40 text-inherit rounded-sm px-[1px]">
        {text.slice(idx, idx + term.length)}
      </mark>
    );
    cursor = idx + term.length;
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

/* ─── component ─── */
const VirtualTable: React.FC<VirtualTableProps> = ({
  headers,
  rows,
  totalRowCount,
  height = '100%',
  rowHeight = 28,
  overscan = 8,
  sortColumn,
  sortDirection,
  onSort,
  searchTerm,
  filters,
  onFilterChange,
  showFilters = false,
  showRowNumbers = true,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [customWidths, setCustomWidths] = useState<Record<string, number>>({});

  // Reset custom column widths when table headers change
  useEffect(() => {
    setCustomWidths({});
  }, [headers]);

  /* measure container height (minus header, which is sticky) */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerHeight(e.contentRect.height);
      }
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  /* scroll handler — only track vertical scroll for virtual rendering */
  const onScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  /* virtual range calculation */
  const totalHeight = rows.length * rowHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const endIdx = Math.min(rows.length, startIdx + visibleCount);
  const offsetY = startIdx * rowHeight;

  const visibleRows = useMemo(() => rows.slice(startIdx, endIdx), [rows, startIdx, endIdx]);

  /* Dynamic column widths based on content */
  const calculatedWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    const sampleRows = rows.slice(0, 100);

    headers.forEach((h) => {
      // Base width is at least header length
      let maxCharLen = h.length;

      sampleRows.forEach((row) => {
        const val = row[h];
        let displayStr = '';
        if (val === null || val === undefined) {
          displayStr = 'null';
        } else {
          displayStr = String(val);
        }
        if (displayStr.length > maxCharLen) {
          maxCharLen = displayStr.length;
        }
      });

      // Calculate pixel width based on character length
      // Monospace text averages ~7.2px per character at 10px font size
      // Padding: px-3 is 12px * 2 = 24px. Extra spacing for sorting icons/filter button/borders.
      const charWidth = 7.2;
      const padding = 36 + (onSort ? 18 : 0);
      const idealWidth = maxCharLen * charWidth + padding;

      // Restrict columns to reasonable min/max range
      widths[h] = Math.ceil(Math.max(120, Math.min(450, idealWidth)));
    });

    return widths;
  }, [headers, rows, onSort]);

  const colWidths = useMemo(() => {
    const merged: Record<string, number> = {};
    headers.forEach((h) => {
      merged[h] = customWidths[h] ?? calculatedWidths[h];
    });
    return merged;
  }, [headers, customWidths, calculatedWidths]);

  const resizeRef = useRef<{ headerName: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, headerName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = colWidths[headerName];
    
    resizeRef.current = { headerName, startX, startWidth };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const { headerName: currentHeader, startX: initialX, startWidth: initialWidth } = resizeRef.current;
      const deltaX = moveEvent.clientX - initialX;
      const newWidth = Math.max(50, Math.min(800, initialWidth + deltaX));
      
      setCustomWidths((prev) => ({
        ...prev,
        [currentHeader]: newWidth,
      }));
    };
    
    const handleMouseUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]);

  const rowNumWidth = 52;
  const tableMinWidth = useMemo(() => {
    const colsTotal = headers.reduce((sum, h) => sum + (colWidths[h] || 160), 0);
    return (showRowNumbers ? rowNumWidth : 0) + colsTotal;
  }, [headers, colWidths, showRowNumbers]);

  return (
    <div className={`flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 shadow-xs overflow-hidden ${className}`} style={{ height }}>

      {/* Single scroll container for both axes — header sticks via CSS sticky */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto min-h-0"
        onScroll={onScroll}
      >
        {/* Total-height wrapper for vertical virtual scrolling */}
        <div style={{ minWidth: tableMinWidth, position: 'relative' }}>

          {/* Sticky header */}
          <table
            className="table-fixed text-left border-collapse text-[10px] font-mono text-slate-700 dark:text-slate-350"
            style={{ width: tableMinWidth, minWidth: tableMinWidth }}
          >
            <colgroup>
              {showRowNumbers && <col style={{ width: rowNumWidth }} />}
              {headers.map((h) => <col key={h} style={{ width: colWidths[h] }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-450 font-bold uppercase tracking-wider text-[9px]">
                {showRowNumbers && (
                  <th className="px-2 py-2 text-center bg-slate-100 dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800" style={{ width: rowNumWidth }}>#</th>
                )}
                {headers.map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 border-r border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 select-none ${onSort ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors' : ''}`}
                    onClick={() => onSort?.(h)}
                    style={{ width: colWidths[h], minWidth: colWidths[h], maxWidth: colWidths[h], position: 'relative' }}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="truncate">{h}</span>
                      {onSort && (
                        <span className="flex-shrink-0 opacity-60">
                          {sortColumn === h ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                    {/* Resizer Handle */}
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-brand-500/55 dark:hover:bg-brand-400/40 select-none z-20"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => handleResizeStart(e, h)}
                    />
                  </th>
                ))}
              </tr>

              {/* Per-column filter row (also sticky) */}
              {showFilters && onFilterChange && (
                <tr className="bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                  {showRowNumbers && (
                    <td className="px-1 py-1 border-r border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
                      <Filter className="w-3 h-3 mx-auto text-slate-400" />
                    </td>
                  )}
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="px-1 py-1 border-r border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80"
                      style={{ width: colWidths[h], minWidth: colWidths[h], maxWidth: colWidths[h] }}
                    >
                      <input
                        type="text"
                        value={filters?.[h] ?? ''}
                        onChange={(e) => onFilterChange(h, e.target.value)}
                        placeholder="Filter…"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[9px] text-slate-700 dark:text-slate-350 rounded px-1.5 py-0.5 outline-none focus:border-brand-500 placeholder:text-slate-400/70 font-normal"
                      />
                    </td>
                  ))}
                </tr>
              )}
            </thead>
          </table>

          {/* Virtual body — positioned absolutely within a height spacer */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            <table
              className="table-fixed text-left border-collapse text-[10px] font-mono text-slate-700 dark:text-slate-350"
              style={{ position: 'absolute', top: offsetY, left: 0, right: 0, width: tableMinWidth, minWidth: tableMinWidth }}
            >
              <colgroup>
                {showRowNumbers && <col style={{ width: rowNumWidth }} />}
                {headers.map((h) => <col key={h} style={{ width: colWidths[h] }} />)}
              </colgroup>
              <tbody>
                {visibleRows.map((row, vIdx) => {
                  const actualIdx = startIdx + vIdx;
                  return (
                    <tr key={actualIdx} className="hover:bg-brand-50/30 dark:hover:bg-brand-950/10 transition-colors" style={{ height: rowHeight }}>
                      {showRowNumbers && (
                        <td className="px-2 py-0 text-center bg-slate-50/50 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 text-slate-400 text-[9px]" style={{ width: rowNumWidth }}>
                          {actualIdx + 1}
                        </td>
                      )}
                      {headers.map((h) => {
                        const val = row[h];
                        const isNum = typeof val === 'number';
                        const displayStr = val === null || val === undefined ? '' : String(val);
                        const isNull = val === null || val === undefined;

                        return (
                          <td
                            key={h}
                            className={`px-3 py-0 border-r border-slate-100 dark:border-slate-900 whitespace-nowrap overflow-hidden text-ellipsis ${isNum ? 'text-right font-semibold text-slate-800 dark:text-slate-200' : ''}`}
                            title={displayStr}
                            style={{ width: colWidths[h], minWidth: colWidths[h], maxWidth: colWidths[h] }}
                          >
                            {isNull ? (
                              <span className="text-slate-400 italic text-[9px]">null</span>
                            ) : searchTerm ? (
                              highlightText(displayStr, searchTerm)
                            ) : (
                              displayStr
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer status bar */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[9px] font-semibold text-slate-500 dark:text-slate-500 flex justify-between items-center">
        <span>
          {rows.length < totalRowCount ? (
            <>Showing <span className="text-brand-600 dark:text-brand-400">{rows.length.toLocaleString()}</span> of {totalRowCount.toLocaleString()} rows</>
          ) : (
            <>{totalRowCount.toLocaleString()} rows</>
          )}
        </span>
        {searchTerm && (
          <span className="text-yellow-600 dark:text-yellow-400">
            <Search className="w-2.5 h-2.5 inline mr-0.5" />
            Highlighting: "{searchTerm}"
          </span>
        )}
      </div>
    </div>
  );
};

export default VirtualTable;
