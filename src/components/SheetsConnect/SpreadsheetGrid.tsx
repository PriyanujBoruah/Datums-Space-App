import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { getColumnLetter } from './SheetsConnect';

interface SpreadsheetGridProps {
  rowCount: number;
  columnCount: number;
  cells: Record<string, { value: string; formula: string; computedValue: any; type?: string }>;
  activeCell: { row: number; col: number } | null;
  selectedRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  onCellEdit: (row: number, col: number, rawVal: string) => void;
  onActiveCellChange: (row: number, col: number) => void;
  onSelectRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  rowCount,
  columnCount,
  cells,
  activeCell,
  selectedRange,
  onCellEdit,
  onActiveCellChange,
  onSelectRange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isMouseDown, setIsMouseDown] = useState(false);

  const rowHeight = 28;
  const colWidth = 100;
  const rowNumWidth = 52;
  const overscan = 6;

  // Measure container height
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

  const onScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  // Keyboard navigation & editing triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      
      // If editing, handle Enter and Escape
      if (isEditing) {
        if (e.key === 'Enter') {
          onCellEdit(activeCell.row, activeCell.col, editValue);
          setIsEditing(false);
          // Move down
          if (activeCell.row < rowCount - 1) {
            onActiveCellChange(activeCell.row + 1, activeCell.col);
            onSelectRange({
              startRow: activeCell.row + 1,
              startCol: activeCell.col,
              endRow: activeCell.row + 1,
              endCol: activeCell.col
            });
          }
          e.preventDefault();
        } else if (e.key === 'Escape') {
          setIsEditing(false);
          e.preventDefault();
        }
        return;
      }

      // If not editing, handle movements and editing start
      let nextRow = activeCell.row;
      let nextCol = activeCell.col;
      let moved = false;

      if (e.key === 'ArrowUp' && activeCell.row > 0) {
        nextRow--;
        moved = true;
      } else if (e.key === 'ArrowDown' && activeCell.row < rowCount - 1) {
        nextRow++;
        moved = true;
      } else if (e.key === 'ArrowLeft' && activeCell.col > 0) {
        nextCol--;
        moved = true;
      } else if (e.key === 'ArrowRight' && activeCell.col < columnCount - 1) {
        nextCol++;
        moved = true;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (activeCell.col > 0) nextCol--;
        } else {
          if (activeCell.col < columnCount - 1) nextCol++;
        }
        moved = true;
      } else if (e.key === 'Enter') {
        const coord = `${getColumnLetter(activeCell.col)}${activeCell.row + 1}`;
        const currentData = cells[coord];
        setEditValue(currentData ? (currentData.formula || currentData.value) : '');
        setIsEditing(true);
        e.preventDefault();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Delete selected range or active cell
        if (selectedRange) {
          const minR = Math.min(selectedRange.startRow, selectedRange.endRow);
          const maxR = Math.max(selectedRange.startRow, selectedRange.endRow);
          const minC = Math.min(selectedRange.startCol, selectedRange.endCol);
          const maxC = Math.max(selectedRange.startCol, selectedRange.endCol);
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              onCellEdit(r, c, '');
            }
          }
        } else {
          onCellEdit(activeCell.row, activeCell.col, '');
        }
        e.preventDefault();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Typing direct character opens editor
        setEditValue(e.key);
        setIsEditing(true);
      }

      if (moved) {
        onActiveCellChange(nextRow, nextCol);
        if (!e.shiftKey) {
          onSelectRange({
            startRow: nextRow,
            startCol: nextCol,
            endRow: nextRow,
            endCol: nextCol,
          });
        } else if (selectedRange) {
          onSelectRange({
            ...selectedRange,
            endRow: nextRow,
            endCol: nextCol,
          });
        }
        // Scroll into view logic
        if (scrollRef.current) {
          const gridEl = scrollRef.current;
          const cellTop = nextRow * rowHeight;
          const cellLeft = rowNumWidth + nextCol * colWidth;

          if (cellTop < gridEl.scrollTop + rowHeight) {
            gridEl.scrollTop = Math.max(0, cellTop - rowHeight);
          } else if (cellTop + rowHeight > gridEl.scrollTop + containerHeight - 32) {
            gridEl.scrollTop = cellTop - containerHeight + rowHeight + 32;
          }

          if (cellLeft < gridEl.scrollLeft + rowNumWidth + colWidth) {
            gridEl.scrollLeft = Math.max(0, cellLeft - rowNumWidth - colWidth);
          } else if (cellLeft + colWidth > gridEl.scrollLeft + gridEl.clientWidth) {
            gridEl.scrollLeft = cellLeft - gridEl.clientWidth + colWidth;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, isEditing, editValue, selectedRange, cells, rowCount, columnCount, containerHeight, onCellEdit, onActiveCellChange, onSelectRange]);

  // Sync edit value when active cell changes externally
  useEffect(() => {
    if (activeCell) {
      const coord = `${getColumnLetter(activeCell.col)}${activeCell.row + 1}`;
      const c = cells[coord];
      setEditValue(c ? (c.formula || c.value) : '');
      setIsEditing(false);
    }
  }, [activeCell, cells]);

  // Virtual Row range calculation
  const totalHeight = rowCount * rowHeight;
  const startRowIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleRowCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const endRowIdx = Math.min(rowCount, startRowIdx + visibleRowCount);
  const offsetY = startRowIdx * rowHeight;

  // Grid width
  const totalGridWidth = rowNumWidth + columnCount * colWidth;

  const handleCellMouseDown = (row: number, col: number) => {
    setIsMouseDown(true);
    onActiveCellChange(row, col);
    onSelectRange({
      startRow: row,
      startCol: col,
      endRow: row,
      endCol: col,
    });
    setIsEditing(false);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isMouseDown && selectedRange) {
      onSelectRange({
        ...selectedRange,
        endRow: row,
        endCol: col,
      });
    }
  };

  const handleCellMouseUp = () => {
    setIsMouseDown(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleCellDoubleClick = (row: number, col: number) => {
    const coord = `${getColumnLetter(col)}${row + 1}`;
    const c = cells[coord];
    setEditValue(c ? (c.formula || c.value) : '');
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    if (activeCell) {
      onCellEdit(activeCell.row, activeCell.col, editValue);
    }
    setIsEditing(false);
  };

  // Check if cell is in selection
  const isCellSelected = useCallback((r: number, c: number) => {
    if (!selectedRange) return false;
    const minR = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxR = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minC = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxC = Math.max(selectedRange.startCol, selectedRange.endCol);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }, [selectedRange]);

  // Headers list A to AA...
  const headers = useMemo(() => {
    const arr = [];
    for (let c = 0; c < columnCount; c++) {
      arr.push(getColumnLetter(c));
    }
    return arr;
  }, [columnCount]);

  const selectWholeColumn = (colIndex: number) => {
    onActiveCellChange(0, colIndex);
    onSelectRange({
      startRow: 0,
      startCol: colIndex,
      endRow: rowCount - 1,
      endCol: colIndex,
    });
  };

  const selectWholeRow = (rowIndex: number) => {
    onActiveCellChange(rowIndex, 0);
    onSelectRange({
      startRow: rowIndex,
      startCol: 0,
      endRow: rowIndex,
      endCol: columnCount - 1,
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs relative"
    >
      {/* Scrollable container for virtual rendering */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto min-h-0 relative select-none"
        onScroll={onScroll}
      >
        {/* Giant Height Spacer for scroll bars */}
        <div style={{ height: totalHeight + rowHeight + 10, width: totalGridWidth, position: 'relative' }}>
          
          {/* STICKY COLUMN HEADERS BAR (Top) */}
          <div
            className="sticky top-0 z-30 flex bg-slate-100 dark:bg-slate-900 border-b border-slate-250 dark:border-slate-800 text-[10px] font-mono text-slate-500 font-bold"
            style={{ width: totalGridWidth, height: rowHeight }}
          >
            {/* Top-left corner placeholder */}
            <div
              className="sticky left-0 z-40 bg-slate-100 dark:bg-slate-900 border-r border-slate-250 dark:border-slate-800 flex items-center justify-center flex-shrink-0"
              style={{ width: rowNumWidth, height: rowHeight }}
            >
              {/* Select All */}
              <button
                className="w-full h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-[8px]"
                onClick={() => {
                  onActiveCellChange(0, 0);
                  onSelectRange({ startRow: 0, startCol: 0, endRow: rowCount - 1, endCol: columnCount - 1 });
                }}
              >
                ◢
              </button>
            </div>

            {/* Column letters A, B, C... */}
            {headers.map((letter, c) => (
              <div
                key={letter}
                onClick={() => selectWholeColumn(c)}
                className="border-r border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer select-none font-semibold uppercase shrink-0"
                style={{ width: colWidth, height: rowHeight }}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* VIRTUALIZED ROWS BODY */}
          <div
            style={{
              position: 'absolute',
              top: offsetY + rowHeight,
              left: 0,
              right: 0,
              height: (endRowIdx - startRowIdx) * rowHeight,
            }}
          >
            {Array.from({ length: endRowIdx - startRowIdx }).map((_, vRowIdx) => {
              const rowIndex = startRowIdx + vRowIdx;
              
              return (
                <div
                  key={rowIndex}
                  className="flex border-b border-slate-100 dark:border-slate-900"
                  style={{ height: rowHeight, width: totalGridWidth }}
                >
                  {/* STICKY ROW GUTTER NUMBER */}
                  <div
                    onClick={() => selectWholeRow(rowIndex)}
                    className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-r border-slate-250 dark:border-slate-800 flex items-center justify-center cursor-pointer select-none text-[9.5px] font-mono text-slate-450 dark:text-slate-500 font-semibold flex-shrink-0"
                    style={{ width: rowNumWidth, height: rowHeight }}
                  >
                    {rowIndex + 1}
                  </div>

                  {/* CELL GRID */}
                  {Array.from({ length: columnCount }).map((_, colIndex) => {
                    const colLetter = getColumnLetter(colIndex);
                    const cellCoord = `${colLetter}${rowIndex + 1}`;
                    const cellData = cells[cellCoord];
                    const rawVal = cellData?.value ?? '';
                    const dispVal = cellData?.computedValue !== undefined ? String(cellData.computedValue) : rawVal;

                    const isSelected = isCellSelected(rowIndex, colIndex);
                    const isActive = activeCell && activeCell.row === rowIndex && activeCell.col === colIndex;

                    const isNum = cellData?.type === 'number' || (!isNaN(Number(dispVal)) && dispVal.trim() !== '');

                    return (
                      <div
                        key={colIndex}
                        onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        onMouseUp={handleCellMouseUp}
                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                        className={`border-r border-slate-150 dark:border-slate-900 flex items-center px-2 text-[11px] font-mono select-none overflow-hidden text-ellipsis whitespace-nowrap outline-none relative shrink-0 ${
                          isActive
                            ? 'ring-2 ring-brand-500 ring-inset bg-white dark:bg-slate-900 z-10'
                            : isSelected
                            ? 'bg-brand-500/10 dark:bg-brand-400/15 border-brand-300 dark:border-brand-800/50'
                            : 'bg-white dark:bg-slate-950/45 hover:bg-slate-50/50 dark:hover:bg-slate-900/15'
                        } ${isNum ? 'justify-end text-right' : 'justify-start text-left'}`}
                        style={{ width: colWidth, height: rowHeight }}
                        title={`${cellCoord}: ${rawVal}`}
                      >
                        {isActive && isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleInputBlur}
                            autoFocus
                            className="absolute inset-0 w-full h-full px-2 text-[11px] font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none border-none ring-2 ring-brand-500 rounded-none z-20"
                          />
                        ) : (
                          <span className={cellData?.type === 'error' ? 'text-red-500 italic' : ''}>
                            {dispVal}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};
