import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, Database, ArrowLeftRight, Sparkles, 
  Trash2, Plus, Download, RefreshCw, Table 
} from 'lucide-react';
import Papa from 'papaparse';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { FormulasPanel } from './FormulasPanel';
import duckDbService from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';
import { showAlert, showConfirm } from '../../services/DialogService';

// --- CELL COORDINATE HELPERS ---
export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function getColumnIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function expandRange(rangeStr: string): string[] {
  try {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [rangeStr.toUpperCase()];
    const [start, end] = parts;
    const startCol = start.match(/[A-Z]+/i)![0].toUpperCase();
    const startRow = parseInt(start.match(/[0-9]+/)![0], 10);
    const endCol = end.match(/[A-Z]+/i)![0].toUpperCase();
    const endRow = parseInt(end.match(/[0-9]+/)![0], 10);
    
    const colStartIdx = getColumnIndex(startCol);
    const colEndIdx = getColumnIndex(endCol);
    
    const cells: string[] = [];
    for (let c = Math.min(colStartIdx, colEndIdx); c <= Math.max(colStartIdx, colEndIdx); c++) {
      const colLetter = getColumnLetter(c);
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        cells.push(`${colLetter}${r}`);
      }
    }
    return cells;
  } catch (e) {
    return [];
  }
}

// --- FORMULA ENGINE INTERNALS ---
function parseArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '(' && !inQuotes) {
      parenDepth++;
      current += char;
    } else if (char === ')' && !inQuotes) {
      parenDepth--;
      current += char;
    } else if (char === ',' && parenDepth === 0 && !inQuotes) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

function resolveValue(
  arg: string, 
  cells: Record<string, any>, 
  customFns: Record<string, Function>, 
  evaluating: Set<string>, 
  cache: Record<string, any>
): any {
  if (!arg) return '';
  if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  if (/^[A-Z]+[0-9]+$/i.test(arg)) {
    return evaluateCell(arg.toUpperCase(), cells, customFns, evaluating, cache);
  }
  const num = Number(arg);
  if (!isNaN(num)) return num;

  if (arg.includes('(')) {
    return parseAndEvaluate(arg, cells, customFns, evaluating, cache);
  }
  return arg;
}

function evaluateMathExpression(
  expr: string, 
  cells: Record<string, any>, 
  customFns: Record<string, Function>, 
  evaluating: Set<string>, 
  cache: Record<string, any>
): any {
  let parsedExpr = expr;
  const cellRefs = expr.match(/[A-Z]+[0-9]+/ig) || [];
  cellRefs.sort((a, b) => b.length - a.length);

  for (const ref of cellRefs) {
    const val = resolveValue(ref, cells, customFns, evaluating, cache);
    const safeVal = typeof val === 'number' ? val : JSON.stringify(String(val));
    const escapedRef = ref.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedRef}\\b`, 'gi');
    parsedExpr = parsedExpr.replace(regex, String(safeVal));
  }

  const safeMath = parsedExpr.replace(/[^0-9+\-*\/().%<>=!&|\s"]/g, '');
  try {
    if (!safeMath.trim()) return '';
    return new Function(`return ${safeMath}`)();
  } catch (err) {
    return '#VALUE!';
  }
}

function evaluateCondition(
  arg: string, 
  cells: Record<string, any>, 
  customFns: Record<string, Function>, 
  evaluating: Set<string>, 
  cache: Record<string, any>
): boolean {
  try {
    const val = evaluateMathExpression(arg, cells, customFns, evaluating, cache);
    return !!val && val !== '#VALUE!';
  } catch (e) {
    return false;
  }
}

function parseAndEvaluate(
  formula: string, 
  cells: Record<string, any>, 
  customFns: Record<string, Function>, 
  evaluating: Set<string>, 
  cache: Record<string, any>
): any {
  const funcMatch = formula.match(/^([A-Z0-9_]+)\((.*)\)$/i);
  if (funcMatch) {
    const fnName = funcMatch[1].toUpperCase();
    const argsStr = funcMatch[2];
    const args = parseArgs(argsStr);

    if (fnName === 'SUM') {
      let sum = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          for (const c of expandRange(arg)) {
            const val = Number(resolveValue(c, cells, customFns, evaluating, cache));
            if (!isNaN(val)) sum += val;
          }
        } else {
          const val = Number(resolveValue(arg, cells, customFns, evaluating, cache));
          if (!isNaN(val)) sum += val;
        }
      }
      return sum;
    }
    
    if (fnName === 'AVERAGE') {
      let sum = 0;
      let count = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          for (const c of expandRange(arg)) {
            const val = Number(resolveValue(c, cells, customFns, evaluating, cache));
            if (!isNaN(val)) {
              sum += val;
              count++;
            }
          }
        } else {
          const val = Number(resolveValue(arg, cells, customFns, evaluating, cache));
          if (!isNaN(val)) {
            sum += val;
            count++;
          }
        }
      }
      return count > 0 ? sum / count : 0;
    }

    if (fnName === 'MIN') {
      const vals: number[] = [];
      for (const arg of args) {
        if (arg.includes(':')) {
          expandRange(arg).forEach(c => {
            const val = Number(resolveValue(c, cells, customFns, evaluating, cache));
            if (!isNaN(val)) vals.push(val);
          });
        } else {
          const val = Number(resolveValue(arg, cells, customFns, evaluating, cache));
          if (!isNaN(val)) vals.push(val);
        }
      }
      return vals.length > 0 ? Math.min(...vals) : 0;
    }

    if (fnName === 'MAX') {
      const vals: number[] = [];
      for (const arg of args) {
        if (arg.includes(':')) {
          expandRange(arg).forEach(c => {
            const val = Number(resolveValue(c, cells, customFns, evaluating, cache));
            if (!isNaN(val)) vals.push(val);
          });
        } else {
          const val = Number(resolveValue(arg, cells, customFns, evaluating, cache));
          if (!isNaN(val)) vals.push(val);
        }
      }
      return vals.length > 0 ? Math.max(...vals) : 0;
    }

    if (fnName === 'COUNT') {
      let count = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          expandRange(arg).forEach(c => {
            const val = Number(resolveValue(c, cells, customFns, evaluating, cache));
            if (!isNaN(val)) count++;
          });
        } else {
          const val = Number(resolveValue(arg, cells, customFns, evaluating, cache));
          if (!isNaN(val)) count++;
        }
      }
      return count;
    }

    if (fnName === 'CONCAT') {
      return args.map(arg => String(resolveValue(arg, cells, customFns, evaluating, cache))).join('');
    }

    if (fnName === 'IF') {
      const condVal = evaluateCondition(args[0], cells, customFns, evaluating, cache);
      if (condVal) {
        return resolveValue(args[1], cells, customFns, evaluating, cache);
      } else {
        return resolveValue(args[2], cells, customFns, evaluating, cache);
      }
    }

    if (fnName === 'AND') {
      return args.every(arg => !!evaluateCondition(arg, cells, customFns, evaluating, cache));
    }

    if (fnName === 'OR') {
      return args.some(arg => !!evaluateCondition(arg, cells, customFns, evaluating, cache));
    }

    if (fnName === 'NOT') {
      return !evaluateCondition(args[0], cells, customFns, evaluating, cache);
    }

    if (fnName === 'VLOOKUP') {
      const lookupVal = resolveValue(args[0], cells, customFns, evaluating, cache);
      const rangeStr = args[1];
      const colIdx = Number(resolveValue(args[2], cells, customFns, evaluating, cache));
      
      const [start, end] = rangeStr.split(':');
      const startCol = start.match(/[A-Z]+/i)![0].toUpperCase();
      const startRow = parseInt(start.match(/[0-9]+/)![0], 10);
      const endCol = end.match(/[A-Z]+/i)![0].toUpperCase();
      const endRow = parseInt(end.match(/[0-9]+/)![0], 10);

      const colStartIdx = getColumnIndex(startCol);
      const colEndIdx = getColumnIndex(endCol);

      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        const searchCell = `${getColumnLetter(colStartIdx)}${r}`;
        const searchVal = resolveValue(searchCell, cells, customFns, evaluating, cache);
        
        if (String(searchVal) === String(lookupVal)) {
          const targetColIdx = colStartIdx + colIdx - 1;
          if (targetColIdx <= colEndIdx) {
            const targetCell = `${getColumnLetter(targetColIdx)}${r}`;
            return resolveValue(targetCell, cells, customFns, evaluating, cache);
          }
        }
      }
      return '#N/A';
    }

    if (fnName === 'XLOOKUP') {
      const lookupVal = resolveValue(args[0], cells, customFns, evaluating, cache);
      const lookupRange = expandRange(args[1]);
      const returnRange = expandRange(args[2]);

      for (let i = 0; i < lookupRange.length; i++) {
        const searchVal = resolveValue(lookupRange[i], cells, customFns, evaluating, cache);
        if (String(searchVal) === String(lookupVal)) {
          if (i < returnRange.length) {
            return resolveValue(returnRange[i], cells, customFns, evaluating, cache);
          }
        }
      }
      return '#N/A';
    }

    if (customFns[fnName]) {
      const evaluatedArgs = args.map(arg => resolveValue(arg, cells, customFns, evaluating, cache));
      try {
        return customFns[fnName](...evaluatedArgs);
      } catch (err: any) {
        return '#VALUE!';
      }
    }
  }

  return evaluateMathExpression(formula, cells, customFns, evaluating, cache);
}

function evaluateCell(
  coord: string, 
  cells: Record<string, any>, 
  customFns: Record<string, Function>, 
  evaluating: Set<string> = new Set(), 
  cache: Record<string, any> = {}
): any {
  if (cache[coord] !== undefined) return cache[coord];
  if (evaluating.has(coord)) {
    return '#REF!';
  }

  const cell = cells[coord];
  if (!cell) return '';

  if (!cell.formula || !cell.formula.startsWith('=')) {
    const num = Number(cell.value);
    if (cell.value.trim() !== '' && !isNaN(num)) {
      return num;
    }
    return cell.value;
  }

  evaluating.add(coord);

  const formulaBody = cell.formula.slice(1).trim();
  let result: any;
  try {
    result = parseAndEvaluate(formulaBody, cells, customFns, evaluating, cache);
  } catch (err: any) {
    result = '#VALUE!';
  }

  evaluating.delete(coord);
  cache[coord] = result;
  return result;
}

// --- DEMO DATASETS ---
const SALES_DEMO = `Rep,Region,Product,Sales,Units,Date
Ramesh,North,Laptops,45000,15,2026-05-10
Sonia,South,Phones,12000,8,2026-05-12
Amir,North,Laptops,30000,10,2026-05-14
Deepa,East,Accessories,2500,5,2026-05-15
Raj,West,Laptops,60000,20,2026-05-16
Sonia,South,Accessories,1500,3,2026-05-18
Ramesh,North,Phones,24000,16,2026-05-19`;

const UNSTRUCTURED_DEMO = `,,QUARTERLY BUDGET ANOMALIES SCANNER,,,,
,,Sales & Cost Projections,,,,
,,,,,,
Year,Item,Q1,Q2,Q3,Q4,Notes
2026,Software Licenses,1200,1400,1300,1800,In USD
,,,,,
2026,Consulting,4500,5000,4200,6000,Sub-contracts
2026,Marketing Ads,2500,3000,3500,5000,Campaigns
,,,,,
Total,Operational Costs,8200,9400,9000,12800,Auto Summed`;

const JOIN_CUSTOMERS_DEMO = `CustomerID,Name,Country,Segment
C101,Aarav Mehta,India,Enterprise
C102,Emma Watson,USA,Retail
C103,Kenji Sato,Japan,Enterprise
C104,Olivia Chen,Singapore,Govt`;

const JOIN_ORDERS_DEMO = `OrderID,CustomerID,Amount,Date
O901,C101,1500,2026-04-01
O902,C103,4200,2026-04-05
O903,C101,800,2026-04-10
O904,C102,320,2026-04-12`;

// --- COMPONENT IMPLEMENTATION ---
export const SheetsConnect: React.FC = () => {
  // Grid size
  const [rowCount, setRowCount] = useState(50);
  const [columnCount, setColumnCount] = useState(15);
  const [cells, setCells] = useState<Record<string, { value: string; formula: string; computedValue: any; type?: string }>>({});

  // Navigation states
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>({
    startRow: 0, startCol: 0, endRow: 0, endCol: 0
  });

  // Sidebar navigation
  const [sidebarTab, setSidebarTab] = useState<'connect' | 'formulas' | 'join' | 'clean'>('connect');

  // Input formula bar
  const [formulaInput, setFormulaInput] = useState('');

  // Google sheets states
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom compiled JS functions
  const [customFormulas, setCustomFormulas] = useState<Record<string, string>>({});
  const customFns = useMemo(() => {
    const map: Record<string, Function> = {};
    Object.entries(customFormulas).forEach(([name, jsCode]) => {
      try {
        map[name] = new Function(`return ${jsCode}`)();
      } catch (e) {
        console.error('Failed to compile custom function:', name, e);
      }
    });
    return map;
  }, [customFormulas]);

  // Selection Groups (Max 4)
  const [selectionGroups, setSelectionGroups] = useState<(null | {
    id: number;
    range: string;
    headers: string[];
    rows: any[][];
  })[]>([null, null, null, null]);

  // Join settings
  const [joinPrimaryIdx, setJoinPrimaryIdx] = useState(0);
  const [joinSecondaryIdx, setJoinSecondaryIdx] = useState(1);
  const [joinPrimaryKeyCol, setJoinPrimaryKeyCol] = useState(0);
  const [joinSecondaryKeyCol, setJoinSecondaryKeyCol] = useState(0);
  const [joinType, setJoinType] = useState<'inner' | 'left' | 'union'>('inner');
  const [joinTableName, setJoinTableName] = useState('sheets_join_result');

  // Pivot Table parameters
  const [pivotRowCol, setPivotRowCol] = useState(0);
  const [pivotColCol, setPivotColCol] = useState(2);
  const [pivotValCol, setPivotValCol] = useState(3);
  const [pivotAgg, setPivotAgg] = useState<'SUM' | 'AVERAGE' | 'COUNT'>('SUM');

  // Unpivot matrix parameters
  const [unpivotKeyCols, setUnpivotKeyCols] = useState('A,B');
  const [unpivotValCols, setUnpivotValCols] = useState('C,D,E,F');
  const [unpivotCatHeader, setUnpivotCatHeader] = useState('Quarter');
  const [unpivotValHeader, setUnpivotValHeader] = useState('Amount');

  // List of active headers in columns
  const activeHeadersList = useMemo(() => {
    const list = [];
    for (let c = 0; c < columnCount; c++) {
      const coord = `${getColumnLetter(c)}1`;
      list.push(cells[coord]?.computedValue || cells[coord]?.value || getColumnLetter(c));
    }
    return list;
  }, [cells, columnCount]);

  // Compute all cells
  const reevaluateAllCells = useCallback((currentCells: typeof cells) => {
    const cache: Record<string, any> = {};
    const updated: typeof cells = {};
    
    Object.keys(currentCells).forEach((coord) => {
      const val = evaluateCell(coord, currentCells, customFns, new Set(), cache);
      const cellData = currentCells[coord];
      
      let type = 'string';
      if (cellData.formula && cellData.formula.startsWith('=')) {
        type = String(val).startsWith('#') ? 'error' : 'formula';
      } else if (!isNaN(Number(val)) && String(val).trim() !== '') {
        type = 'number';
      }

      updated[coord] = {
        ...cellData,
        computedValue: val,
        type,
      };
    });
    return updated;
  }, [customFns]);

  // Trigger grid edit
  const handleCellEdit = useCallback((row: number, col: number, rawVal: string) => {
    const coord = `${getColumnLetter(col)}${row + 1}`;
    setCells((prev) => {
      const next = { ...prev };
      if (rawVal === '') {
        delete next[coord];
      } else if (rawVal.startsWith('=')) {
        next[coord] = { value: '', formula: rawVal, computedValue: '' };
      } else {
        next[coord] = { value: rawVal, formula: '', computedValue: rawVal };
      }
      return reevaluateAllCells(next);
    });
  }, [reevaluateAllCells]);

  // Apply formula from FormulaPanel
  const handleApplyFormula = (formula: string) => {
    if (activeCell) {
      handleCellEdit(activeCell.row, activeCell.col, formula);
      setFormulaInput(formula);
    }
  };

  // Sync active cell details to input formula bar
  useEffect(() => {
    if (activeCell) {
      const coord = `${getColumnLetter(activeCell.col)}${activeCell.row + 1}`;
      const c = cells[coord];
      setFormulaInput(c ? (c.formula || c.value) : '');
    }
  }, [activeCell, cells]);

  // Load raw grid rows/columns from array
  const loadDataArray = useCallback((arr: any[][], columnsLimit?: number) => {
    const cellMap: typeof cells = {};
    const rowLen = Math.max(10, arr.length);
    const colLen = Math.max(5, columnsLimit || (arr[0] ? arr[0].length : 10));

    setRowCount(rowLen);
    setColumnCount(colLen);

    arr.forEach((row, rIdx) => {
      row.forEach((val, cIdx) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const letter = getColumnLetter(cIdx);
          const coord = `${letter}${rIdx + 1}`;
          const cleanStr = String(val);
          cellMap[coord] = {
            value: cleanStr,
            formula: '',
            computedValue: cleanStr,
          };
        }
      });
    });

    setCells(reevaluateAllCells(cellMap));
    setActiveCell({ row: 0, col: 0 });
    setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
  }, [reevaluateAllCells]);

  // Loading CSV string
  const loadCsvText = useCallback((csv: string) => {
    const parse = Papa.parse(csv, { skipEmptyLines: false });
    if (parse.errors.length > 0 && parse.data.length === 0) {
      showAlert(`Failed to parse CSV payload: ${parse.errors[0].message}`, 'Parsing Error');
      return;
    }
    loadDataArray(parse.data as any[][]);
  }, [loadDataArray]);

  // Google Sheet Link Connect
  const handleConnectSheet = async () => {
    if (!sheetUrl.trim()) return;
    setLoading(true);

    try {
      let csvUrl = sheetUrl.trim();
      // Translate edit link to CSV export link
      const match = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const spreadId = match[1];
        csvUrl = `https://docs.google.com/spreadsheets/d/${spreadId}/export?format=csv`;
      }

      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`Google Sheets export returned status ${res.status}`);
      const text = await res.text();
      
      loadCsvText(text);
      setSheetUrl('');
      showAlert('Successfully connected and imported Google Sheet data in memory!', 'Sheets Synced');
      
      eventBus.emit('AUDIT_LOG', {
        action: 'SHEETS_CONNECT',
        details: `Synced Google Sheet from URL securely. Dimensions: ${rowCount} rows.`,
        status: 'success'
      });
    } catch (err: any) {
      showAlert(`Could not connect to Google Sheet. Please confirm the sharing settings are set to 'Anyone with the link can view' (Public). Error: ${err.message || err}`, 'Sync Failure');
    } finally {
      setLoading(false);
    }
  };

  // CAPTURE RECTANGULAR CELL RANGE
  const captureSelectionGroup = (groupIndex: number) => {
    if (!selectedRange) {
      showAlert('Highlight a rectangular area of cells in the grid first.', 'Capture Error');
      return;
    }

    const minR = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxR = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minC = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxC = Math.max(selectedRange.startCol, selectedRange.endCol);

    const rangeStr = `${getColumnLetter(minC)}${minR + 1}:${getColumnLetter(maxC)}${maxR + 1}`;
    
    // Capture headers (first row of selection) and rows (all subsequent rows)
    const headerRow: any[] = [];
    for (let c = minC; c <= maxC; c++) {
      const coord = `${getColumnLetter(c)}${minR + 1}`;
      headerRow.push(cells[coord]?.computedValue || cells[coord]?.value || getColumnLetter(c));
    }

    const dataRows: any[][] = [];
    for (let r = minR + 1; r <= maxR; r++) {
      const row = [];
      for (let c = minC; c <= maxC; c++) {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        row.push(cells[coord]?.computedValue || cells[coord]?.value || '');
      }
      dataRows.push(row);
    }

    setSelectionGroups((prev) => {
      const next = [...prev];
      next[groupIndex] = {
        id: groupIndex + 1,
        range: rangeStr,
        headers: headerRow,
        rows: dataRows,
      };
      return next;
    });

    showAlert(`Captured grid selection range ${rangeStr} into Selection Group ${groupIndex + 1}!`, 'Group Captured');
  };

  // CLEAR RECTANGULAR GROUP
  const clearSelectionGroup = (groupIndex: number) => {
    setSelectionGroups((prev) => {
      const next = [...prev];
      next[groupIndex] = null;
      return next;
    });
  };

  // EXECUTE DETERMINISTIC JOIN / UNION
  const handleExecuteJoin = async () => {
    const g1 = selectionGroups[joinPrimaryIdx];
    const g2 = selectionGroups[joinSecondaryIdx];

    if (joinType !== 'union' && (!g1 || !g2)) {
      showAlert('Horizontal joins require both Group A and Group B selection captures.', 'Join Validation Error');
      return;
    }
    if (joinType === 'union' && !g1) {
      showAlert('Vertical Union requires at least Group A selection capture.', 'Union Validation Error');
      return;
    }

    let resultHeaders: string[] = [];
    let resultRows: any[][] = [];

    if (joinType === 'union') {
      // 1. Vertical Union (align columns by matching header names)
      // Get all unique headers from all non-null groups
      const activeGroups = selectionGroups.filter(g => g !== null) as NonNullable<typeof g1>[];
      const allHeaders = Array.from(new Set(activeGroups.flatMap(g => g.headers)));
      resultHeaders = allHeaders;

      activeGroups.forEach((g) => {
        g.rows.forEach((row) => {
          const unionRow = allHeaders.map((header) => {
            const srcIdx = g.headers.indexOf(header);
            return srcIdx !== -1 ? row[srcIdx] : '';
          });
          resultRows.push(unionRow);
        });
      });

    } else {
      // 2. Horizontal Merge (Inner or Left Join)
      const k1 = joinPrimaryKeyCol;
      const k2 = joinSecondaryKeyCol;

      if (k1 >= g1!.headers.length || k2 >= g2!.headers.length) {
        showAlert('Selected Key Column indices are out of range for the captured groups.', 'Key Index Error');
        return;
      }

      const g2UniqueHeaders = g2!.headers.map((h) => {
        if (g1!.headers.includes(h)) return `g2_${h}`;
        return h;
      });
      resultHeaders = [...g1!.headers, ...g2UniqueHeaders];

      g1!.rows.forEach((row1) => {
        const keyVal1 = String(row1[k1]).trim();
        let matchFound = false;

        g2!.rows.forEach((row2) => {
          const keyVal2 = String(row2[k2]).trim();

          if (keyVal1 !== '' && keyVal1 === keyVal2) {
            matchFound = true;
            resultRows.push([...row1, ...row2]);
          }
        });

        if (!matchFound && joinType === 'left') {
          // Left Join: Fill right table columns with null/empty
          const emptyRight = Array(g2!.headers.length).fill('');
          resultRows.push([...row1, ...emptyRight]);
        }
      });
    }

    // Save as pristine DuckDB table
    if (resultRows.length === 0) {
      showAlert('The deterministic join produced 0 rows. Confirm your key matching criteria.', 'Empty Result');
      return;
    }

    try {
      // Create JSON rows
      const jsonRows = resultRows.map((row) => {
        const obj: Record<string, any> = {};
        resultHeaders.forEach((h, i) => {
          const cleanH = h.replace(/[^a-zA-Z0-9_]/g, '_');
          obj[cleanH] = row[i];
        });
        return obj;
      });

      const meta = await duckDbService.importJsonRows(joinTableName, jsonRows);
      eventBus.emit('TABLES_UPDATED', duckDbService.getActiveTables());
      
      // Load back into our spreadsheet grid!
      const finalGridArr = [resultHeaders, ...resultRows];
      loadDataArray(finalGridArr);

      showAlert(`Join executed successfully! Loaded ${resultRows.length} rows inside spreadsheet and registered table '${meta.name}' in DuckDB.`, 'Join Complete');
      
      eventBus.emit('AUDIT_LOG', {
        action: 'SPREADSHEET_JOIN',
        details: `Merged selections. Created DuckDB table '${meta.name}' containing ${resultRows.length} rows.`,
        status: 'success'
      });
    } catch (err: any) {
      showAlert(`Failed to import join results in DuckDB: ${err.message || err}`, 'Database Error');
    }
  };

  // --- CLEAN SHEET UTILITIES ---
  // 1. BOUNDING BOX CROP (Deterministic crop of blank margins)
  const cleanBoundingBox = () => {
    let minRow = rowCount;
    let maxRow = -1;
    let minCol = columnCount;
    let maxCol = -1;

    Object.keys(cells).forEach((coord) => {
      const colLetter = coord.match(/[A-Z]+/i)![0];
      const r = parseInt(coord.match(/[0-9]+/)![0], 10) - 1;
      const c = getColumnIndex(colLetter);

      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    });

    if (maxRow === -1 || maxCol === -1) {
      showAlert('No data found to crop bounding boxes.', 'Crop Error');
      return;
    }

    const nextCells: typeof cells = {};
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const srcCoord = `${getColumnLetter(c)}${r + 1}`;
        const targetCoord = `${getColumnLetter(c - minCol)}${r - minRow + 1}`;
        if (cells[srcCoord]) {
          nextCells[targetCoord] = cells[srcCoord];
        }
      }
    }

    setRowCount(maxRow - minRow + 1);
    setColumnCount(maxCol - minCol + 1);
    setCells(reevaluateAllCells(nextCells));
    setActiveCell({ row: 0, col: 0 });
    setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    showAlert('Deterministic Bounding Box Crop complete! Outer empty rows and columns pruned.', 'Clean Complete');
  };

  // 2. TRIM & PURGE BLANK NESTED ROWS
  const cleanPurgeBlankRows = () => {
    // Collect rows that have at least one cell with content
    const contentRows: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      let hasVal = false;
      for (let c = 0; c < columnCount; c++) {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        if (cells[coord]?.value.trim() !== '') {
          hasVal = true;
          break;
        }
      }
      if (hasVal) {
        contentRows.push(r);
      }
    }

    if (contentRows.length === 0) {
      showAlert('Pruning failed: sheet is entirely empty.', 'Clean Error');
      return;
    }

    const nextCells: typeof cells = {};
    contentRows.forEach((r, idx) => {
      for (let c = 0; c < columnCount; c++) {
        const srcCoord = `${getColumnLetter(c)}${r + 1}`;
        const targetCoord = `${getColumnLetter(c)}${idx + 1}`;
        if (cells[srcCoord]) {
          nextCells[targetCoord] = cells[srcCoord];
        }
      }
    });

    setRowCount(contentRows.length);
    setCells(reevaluateAllCells(nextCells));
    setActiveCell({ row: 0, col: 0 });
    setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    showAlert(`Purged ${rowCount - contentRows.length} completely empty rows.`, 'Clean Complete');
  };

  // 3. PROMOTE FIRST DATA ROW TO HEADER
  const cleanPromoteHeader = () => {
    // Find first row index that contains cells
    let firstDataRow = -1;
    for (let r = 0; r < rowCount; r++) {
      let hasVal = false;
      for (let c = 0; c < columnCount; c++) {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        if (cells[coord]?.value.trim() !== '') {
          hasVal = true;
          break;
        }
      }
      if (hasVal) {
        firstDataRow = r;
        break;
      }
    }

    if (firstDataRow === -1) {
      showAlert('No data rows found to promote.', 'Clean Error');
      return;
    }

    // Shift all subsequent rows up
    const nextCells: typeof cells = {};
    for (let r = firstDataRow; r < rowCount; r++) {
      for (let c = 0; c < columnCount; c++) {
        const srcCoord = `${getColumnLetter(c)}${r + 1}`;
        const targetCoord = `${getColumnLetter(c)}${r - firstDataRow + 1}`;
        if (cells[srcCoord]) {
          nextCells[targetCoord] = cells[srcCoord];
        }
      }
    }

    setRowCount(rowCount - firstDataRow);
    setCells(reevaluateAllCells(nextCells));
    setActiveCell({ row: 0, col: 0 });
    setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    showAlert(`Promoted Row ${firstDataRow + 1} as column titles. Shifted budget grid.`, 'Clean Complete');
  };

  // 4. AUTO-SCHEMA FORMAT CAST (Numbers and ISO Dates formatting)
  const cleanAutoCast = () => {
    const nextCells = { ...cells };
    Object.keys(nextCells).forEach((coord) => {
      const cell = nextCells[coord];
      if (cell.formula) return; // Skip formulas

      let val = cell.value.trim();
      
      // Clean currency, percentages, commas in numeric cols
      const cleanNum = val.replace(/[\$,€%]/g, '').replace(/,/g, '').trim();
      
      if (cleanNum !== '' && !isNaN(Number(cleanNum))) {
        nextCells[coord] = {
          ...cell,
          value: cleanNum,
          computedValue: Number(cleanNum),
          type: 'number',
        };
      } else {
        // Date parser (e.g. DD/MM/YYYY or YYYY/MM/DD)
        const dateMatch = val.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/) || val.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
        if (dateMatch) {
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              const iso = d.toISOString().split('T')[0];
              nextCells[coord] = {
                ...cell,
                value: iso,
                computedValue: iso,
                type: 'string',
              };
            }
          } catch (e) {}
        }
      }
    });

    setCells(reevaluateAllCells(nextCells));
    showAlert('Formatted spreadsheet schema. Numeric characters parsed and date objects coerced to ISO YYYY-MM-DD.', 'Formatting Cast Complete');
  };

  // 5. UNPIVOT MATRIX / DE-NORMALIZE
  const cleanUnpivotMatrix = () => {
    try {
      const keysIdxs = unpivotKeyCols.split(',').map(s => getColumnIndex(s.trim().toUpperCase()));
      const valsIdxs = unpivotValCols.split(',').map(s => getColumnIndex(s.trim().toUpperCase()));

      if (keysIdxs.some(i => i < 0 || i >= columnCount) || valsIdxs.some(i => i < 0 || i >= columnCount)) {
        showAlert('Unpivot column targets are out of bounds.', 'Validation Error');
        return;
      }

      // Read current grid row by row
      const unpivotedHeaders: string[] = [];
      keysIdxs.forEach((idx) => {
        const coord = `${getColumnLetter(idx)}1`;
        unpivotedHeaders.push(cells[coord]?.computedValue || cells[coord]?.value || getColumnLetter(idx));
      });
      unpivotedHeaders.push(unpivotCatHeader);
      unpivotedHeaders.push(unpivotValHeader);

      const unpivotedRows: any[][] = [];

      for (let r = 1; r < rowCount; r++) {
        // Row-Key values
        const keyVals = keysIdxs.map((idx) => {
          const coord = `${getColumnLetter(idx)}${r + 1}`;
          return cells[coord]?.computedValue || cells[coord]?.value || '';
        });

        // Loop through each pivot value column
        valsIdxs.forEach((idx) => {
          const coordHeader = `${getColumnLetter(idx)}1`;
          const pivotCategory = cells[coordHeader]?.computedValue || cells[coordHeader]?.value || getColumnLetter(idx);

          const coordVal = `${getColumnLetter(idx)}${r + 1}`;
          const pivotValue = cells[coordVal]?.computedValue || cells[coordVal]?.value || '';

          if (pivotValue !== '') {
            unpivotedRows.push([...keyVals, pivotCategory, pivotValue]);
          }
        });
      }

      const finalGrid = [unpivotedHeaders, ...unpivotedRows];
      loadDataArray(finalGrid);
      showAlert(`Matrix unpivoted successfully! Reshaped table into ${unpivotedRows.length} flat rows.`, 'Unpivot Complete');
      
    } catch (e: any) {
      showAlert(`Unpivot operation failed: ${e.message || e}`, 'Operation Failure');
    }
  };

  // --- GRID MANIPULATION API ---
  const handleAddRow = () => {
    setRowCount(prev => prev + 5);
    showAlert('Added 5 blank rows to the bottom of the grid.', 'Grid Augmented');
  };

  const handleAddColumn = () => {
    setColumnCount(prev => prev + 2);
    showAlert('Added 2 blank columns to the right of the grid.', 'Grid Augmented');
  };

  const handleClearGrid = async () => {
    if (await showConfirm('Are you sure you want to clear all active cell values from the spreadsheet?', 'Clear Grid Confirmation')) {
      setCells({});
      setRowCount(50);
      setColumnCount(15);
      setActiveCell({ row: 0, col: 0 });
      setSelectedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    }
  };

  const handleExportCsv = () => {
    // Generate 2D array
    const data: string[][] = Array.from({ length: rowCount }).map((_, r) => 
      Array.from({ length: columnCount }).map((_, c) => {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        const cell = cells[coord];
        return cell ? String(cell.computedValue !== undefined ? cell.computedValue : cell.value) : '';
      })
    );

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sheets_connect_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Spreadsheet data exported successfully as CSV file!', 'CSV Exported');
  };

  const handleExportToDuckDb = async () => {
    // Read first row as headers, remaining as rows
    const data: any[][] = Array.from({ length: rowCount }).map((_, r) => 
      Array.from({ length: columnCount }).map((_, c) => {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        const cell = cells[coord];
        return cell ? String(cell.computedValue !== undefined ? cell.computedValue : cell.value) : '';
      })
    );

    const headers = data[0].map((h, i) => h.trim() || `column_${getColumnLetter(i)}`);
    const rows = data.slice(1);

    const cleanHeaders = headers.map(h => h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());

    const jsonRows = rows.map((row) => {
      const obj: Record<string, any> = {};
      cleanHeaders.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    try {
      const tableName = `sheets_connect_${Date.now().toString().slice(-4)}`;
      const meta = await duckDbService.importJsonRows(tableName, jsonRows);
      eventBus.emit('TABLES_UPDATED', duckDbService.getActiveTables());
      showAlert(`Successfully registered spreadsheet data as table '${meta.name}' in DuckDB Sandbox!`, 'Database Registered');
    } catch (err: any) {
      showAlert(`Export failed: ${err.message || err}`, 'Database Ingestion Error');
    }
  };

  // CAPTURE AN INTERACTIVE PIVOT TABLE GENERATION
  const handleExecutePivot = () => {
    if (!selectedRange) {
      showAlert('Highlight a rectangular data range in the grid first to generate a Pivot.', 'Pivot Capture Error');
      return;
    }

    const minR = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxR = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minC = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxC = Math.max(selectedRange.startCol, selectedRange.endCol);

    if (pivotRowCol >= columnCount || pivotColCol >= columnCount || pivotValCol >= columnCount) {
      showAlert('Selected Row/Col/Value columns are out of grid bounds.', 'Pivot Configuration Error');
      return;
    }

    // Capture rows in that selected range
    const rawRows = [];
    for (let r = minR + 1; r <= maxR; r++) {
      const row = [];
      for (let c = minC; c <= maxC; c++) {
        const coord = `${getColumnLetter(c)}${r + 1}`;
        row.push(cells[coord]?.computedValue || cells[coord]?.value || '');
      }
      rawRows.push(row);
    }

    const relativeRowCol = pivotRowCol - minC;
    const relativeColCol = pivotColCol - minC;
    const relativeValCol = pivotValCol - minC;

    if (relativeRowCol < 0 || relativeColCol < 0 || relativeValCol < 0) {
      showAlert('Ensure your target pivot dimensions lie within the active grid selection range.', 'Pivot Alignment Error');
      return;
    }

    // Unique row categories, column categories
    const rowCategories = Array.from(new Set(rawRows.map(r => String(r[relativeRowCol]).trim()))).filter(Boolean);
    const colCategories = Array.from(new Set(rawRows.map(r => String(r[relativeColCol]).trim()))).filter(Boolean);

    // Grid matrix
    const matrix: Record<string, { sum: number; count: number; vals: number[] }> = {};

    rawRows.forEach((row) => {
      const rKey = String(row[relativeRowCol]).trim();
      const cKey = String(row[relativeColCol]).trim();
      const val = Number(row[relativeValCol]);

      if (!rKey || !cKey) return;

      const cellKey = `${rKey}::${cKey}`;
      if (!matrix[cellKey]) {
        matrix[cellKey] = { sum: 0, count: 0, vals: [] };
      }

      if (!isNaN(val)) {
        matrix[cellKey].sum += val;
        matrix[cellKey].count++;
        matrix[cellKey].vals.push(val);
      }
    });

    // Reconstruct Grid
    const pivotHeaders = ['Row Labels', ...colCategories];
    const pivotGridRows = rowCategories.map((rCat) => {
      const rowArr = [rCat];
      colCategories.forEach((cCat) => {
        const entry = matrix[`${rCat}::${cCat}`];
        if (!entry) {
          rowArr.push('');
        } else {
          if (pivotAgg === 'SUM') rowArr.push(String(entry.sum));
          else if (pivotAgg === 'COUNT') rowArr.push(String(entry.count));
          else if (pivotAgg === 'AVERAGE') rowArr.push(String(entry.count > 0 ? entry.sum / entry.count : 0));
        }
      });
      return rowArr;
    });

    const finalGrid = [pivotHeaders, ...pivotGridRows];
    loadDataArray(finalGrid);
    showAlert('Generated Pivot Matrix! Grid rewritten to display the aggregated dimensions.', 'Pivot Complete');
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 relative">
      
      {/* ─── LEFT PANEL CONTROLS (TABS) ─── */}
      <div 
        className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 flex flex-col flex-shrink-0"
        style={{ height: '100%', maxHeight: '100%' }}
      >
        {/* Module title */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-500/10 rounded-lg text-brand-650 dark:text-brand-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-150">Sheets Connect</h2>
              <p className="text-[8px] text-slate-455 font-bold uppercase tracking-widest leading-none mt-0.5">Sandbox Workbook</p>
            </div>
          </div>
        </div>

        {/* Local Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-955 p-1 border-b border-slate-200 dark:border-slate-900 text-[9.5px] font-bold">
          {(['connect', 'formulas', 'join', 'clean'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-1 rounded-md capitalize transition-all ${
                sidebarTab === tab
                  ? 'bg-white dark:bg-slate-900 text-brand-650 dark:text-brand-400 border border-slate-200 dark:border-slate-850 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Scrollable controls viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: CONNECT & DEMOS */}
          {sidebarTab === 'connect' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Google Sheets Sync</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  Fetch records securely. Make sure your sheet has sharing set to <strong>"Anyone with the link can view"</strong>.
                </p>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Paste Google Sheets link..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1.8 text-[11px] outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={handleConnectSheet}
                    disabled={loading || !sheetUrl.trim()}
                    className="w-full py-1.8 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting Sheet...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Connect Google Sheet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Demos Section */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-3.5">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Premium Sandbox Demos</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  No spreadsheet links ready? Click below to instantly load fully reactive mock ledger scenarios into memory.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => loadCsvText(SALES_DEMO)}
                    className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:border-brand-500/30 rounded-xl space-y-1 transition-all group"
                  >
                    <div className="flex items-center justify-between text-slate-850 dark:text-slate-200 font-bold">
                      <span>Sales Ledger Demo</span>
                      <Sparkles className="w-3 h-3 text-brand-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-normal">Ideal for formulas (SUM, AVERAGE, VLOOKUP) and custom aggregation scans.</p>
                  </button>

                  <button
                    onClick={() => loadCsvText(UNSTRUCTURED_DEMO)}
                    className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:border-brand-500/30 rounded-xl space-y-1 transition-all group"
                  >
                    <div className="flex items-center justify-between text-slate-850 dark:text-slate-200 font-bold">
                      <span>Highly Unstructured Budget</span>
                      <Sparkles className="w-3 h-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-normal">Loaded with padded borders, empty rows, and side comments to test the Clean Sheet lab.</p>
                  </button>

                  <button
                    onClick={() => {
                      loadCsvText(JOIN_CUSTOMERS_DEMO);
                      // Prepopulate Group 1
                      const lines = JOIN_CUSTOMERS_DEMO.split('\n').map(l => l.split(','));
                      setSelectionGroups((prev) => {
                        const next = [...prev];
                        next[0] = {
                          id: 1,
                          range: 'A1:D5',
                          headers: lines[0],
                          rows: lines.slice(1),
                        };
                        return next;
                      });
                      showAlert('Loaded Customers table into active grid & pre-captured into Selection Group 1!', 'Join Demo Ready');
                    }}
                    className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-855 hover:border-brand-500/30 rounded-xl space-y-1 transition-all group"
                  >
                    <div className="flex items-center justify-between text-slate-855 dark:text-slate-200 font-bold">
                      <span>Relational Join Scenarios</span>
                      <ArrowLeftRight className="w-3 h-3 text-indigo-500" />
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-normal">Pre-loads customer ledger details. Prepares active ranges to test the deterministic Selection Join.</p>
                  </button>

                  {selectionGroups[0] && (
                    <button
                      onClick={() => {
                        loadCsvText(JOIN_ORDERS_DEMO);
                        const lines = JOIN_ORDERS_DEMO.split('\n').map(l => l.split(','));
                        setSelectionGroups((prev) => {
                          const next = [...prev];
                          next[1] = {
                            id: 2,
                            range: 'A1:D5',
                            headers: lines[0],
                            rows: lines.slice(1),
                          };
                          return next;
                        });
                        showAlert('Loaded Orders table into active grid & pre-captured into Selection Group 2! Swap to Join tab to merge!', 'Join Demo Complete');
                      }}
                      className="w-full text-center py-2 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-150 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:border-indigo-900 text-indigo-650 dark:text-indigo-400 font-bold rounded-lg transition-all text-[9.5px] animate-pulse"
                    >
                      Step 2: Load Orders table (Capture in Group 2)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FORMULA LAB */}
          {sidebarTab === 'formulas' && (
            <FormulasPanel
              activeCell={activeCell}
              columnsList={activeHeadersList}
              onApplyFormula={handleApplyFormula}
              onRegisterCustom={(name, body) => {
                setCustomFormulas((prev) => ({ ...prev, [name]: body }));
              }}
              customFormulas={customFormulas}
            />
          )}

          {/* TAB 3: SELECTION JOIN LAB */}
          {sidebarTab === 'join' && (
            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Group Capture</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  Highlight a rectangular table on the grid, and capture it into a Selection Group (max 4).
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {selectionGroups.map((g, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2 border rounded-xl flex flex-col justify-between ${
                        g 
                          ? 'bg-brand-50/30 border-brand-200 dark:bg-brand-950/15 dark:border-brand-900/60' 
                          : 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-900'
                      }`}
                    >
                      <div className="flex justify-between items-center select-none mb-1">
                        <span className="font-extrabold text-[9px] text-slate-400 dark:text-slate-550">Group {idx + 1}</span>
                        {g && (
                          <button 
                            onClick={() => clearSelectionGroup(idx)}
                            className="text-red-500 hover:text-red-600 p-0.5"
                            title="Reset capture group"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      {g ? (
                        <div className="space-y-1 text-left min-w-0">
                          <span className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-slate-350 truncate block">{g.range}</span>
                          <span className="text-[7.5px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">{g.rows.length + 1} rows</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => captureSelectionGroup(idx)}
                          className="w-full py-1 text-[8.5px] font-extrabold bg-white dark:bg-slate-950 hover:bg-slate-100 border border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-400 rounded-md transition-all uppercase tracking-wider"
                        >
                          Capture Selection
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Join parameters */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-3.5">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Deterministic Join Criteria</span>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 select-none">
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Group A (Primary)</label>
                      <select
                        value={joinPrimaryIdx}
                        onChange={(e) => setJoinPrimaryIdx(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] outline-none"
                      >
                        <option value={0}>Group 1</option>
                        <option value={1}>Group 2</option>
                        <option value={2}>Group 3</option>
                        <option value={3}>Group 4</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Group B (Secondary)</label>
                      <select
                        value={joinSecondaryIdx}
                        onChange={(e) => setJoinSecondaryIdx(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] outline-none"
                      >
                        <option value={0}>Group 1</option>
                        <option value={1}>Group 2</option>
                        <option value={2}>Group 3</option>
                        <option value={3}>Group 4</option>
                      </select>
                    </div>
                  </div>

                  {joinType !== 'union' && (
                    <div className="grid grid-cols-2 gap-2 select-none">
                      <div className="space-y-0.5">
                        <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">A Match Col Index</label>
                        <input
                          type="number"
                          min={0}
                          value={joinPrimaryKeyCol}
                          onChange={(e) => setJoinPrimaryKeyCol(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">B Match Col Index</label>
                        <input
                          type="number"
                          min={0}
                          value={joinSecondaryKeyCol}
                          onChange={(e) => setJoinSecondaryKeyCol(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Join Type</label>
                    <select
                      value={joinType}
                      onChange={(e) => setJoinType(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1.5 text-[10.5px]"
                    >
                      <option value="inner">Inner Join (Intersection)</option>
                      <option value="left">Left Join (Retain Group A rows)</option>
                      <option value="union">Vertical Union (Align column names)</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Target DuckDB Table Name</label>
                    <input
                      type="text"
                      placeholder="e.g. joined_customer_sales"
                      value={joinTableName}
                      onChange={(e) => setJoinTableName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2.5 py-1.8 text-[11px] font-mono outline-none"
                    />
                  </div>

                  <button
                    onClick={handleExecuteJoin}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-[11px]"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Execute Deterministic Join
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLEAN SHEET LAB */}
          {sidebarTab === 'clean' && (
            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Structural Cleaners</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-normal">
                  Perform deterministic schema mutations to convert messy matrices into clean tables.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={cleanBoundingBox}
                    className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-left text-slate-750 dark:text-slate-300 font-bold transition-all"
                  >
                    <span>Bounding Box Crop</span>
                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-brand-50 border border-brand-100 text-brand-650 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-400 uppercase tracking-wider font-extrabold shrink-0">Prune Gaps</span>
                  </button>

                  <button
                    onClick={cleanPurgeBlankRows}
                    className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-left text-slate-750 dark:text-slate-300 font-bold transition-all"
                  >
                    <span>Purge Blank Rows</span>
                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 uppercase tracking-wider font-extrabold shrink-0">Rows</span>
                  </button>

                  <button
                    onClick={cleanPromoteHeader}
                    className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-lg text-left text-slate-750 dark:text-slate-300 font-bold transition-all"
                  >
                    <span>Promote Row to Column Headers</span>
                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-100 text-indigo-650 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400 uppercase tracking-wider font-extrabold shrink-0">Titles</span>
                  </button>

                  <button
                    onClick={cleanAutoCast}
                    className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-left text-slate-750 dark:text-slate-300 font-bold transition-all"
                  >
                    <span>Auto Schema Cast</span>
                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-100 text-emerald-650 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 uppercase tracking-wider font-extrabold shrink-0">Numbers</span>
                  </button>
                </div>
              </div>

              {/* Pivot Aggregator Generator */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-3">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Interactive Pivot table</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-normal">
                  Highlight a data rectangle (headers in first row), then generate a summary pivot.
                </p>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1 select-none">
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold">Row Dimension</label>
                      <input
                        type="number"
                        value={pivotRowCol}
                        onChange={(e) => setPivotRowCol(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] font-mono outline-none"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold">Col Dimension</label>
                      <input
                        type="number"
                        value={pivotColCol}
                        onChange={(e) => setPivotColCol(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] font-mono outline-none"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold">Value Col</label>
                      <input
                        type="number"
                        value={pivotValCol}
                        onChange={(e) => setPivotValCol(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2 py-1 text-[10px] font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[8.5px] text-slate-400 dark:text-slate-555 uppercase font-bold">Value Aggregator</label>
                    <select
                      value={pivotAgg}
                      onChange={(e) => setPivotAgg(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1 text-[10px] outline-none"
                    >
                      <option value="SUM">SUM</option>
                      <option value="AVERAGE">AVERAGE</option>
                      <option value="COUNT">COUNT</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExecutePivot}
                    className="w-full py-1.8 bg-brand-650 hover:bg-brand-600 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-[10px]"
                  >
                    <Table className="w-3.5 h-3.5" />
                    Compile Pivot Table
                  </button>
                </div>
              </div>

              {/* Unpivot Table */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-3">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Unpivot Matrix</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  De-normalize month columns or matrix segments into individual records.
                </p>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 select-none">
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Key Columns (e.g. A,B)</label>
                      <input
                        type="text"
                        value={unpivotKeyCols}
                        onChange={(e) => setUnpivotKeyCols(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2.5 py-1 text-[10px] font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Value Columns (e.g. C,D,E)</label>
                      <input
                        type="text"
                        value={unpivotValCols}
                        onChange={(e) => setUnpivotValCols(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg px-2.5 py-1 text-[10px] font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 select-none">
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Category Title</label>
                      <input
                        type="text"
                        value={unpivotCatHeader}
                        onChange={(e) => setUnpivotCatHeader(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-2.5 py-1 text-[10px] outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase font-bold">Value Title</label>
                      <input
                        type="text"
                        value={unpivotValHeader}
                        onChange={(e) => setUnpivotValHeader(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg px-2.5 py-1 text-[10px] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={cleanUnpivotMatrix}
                    className="w-full py-1.8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-brand-650 dark:text-brand-400 font-bold border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Execute Unpivot reshape
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ─── MAIN WORKBOOK GRID AREA (Middle-Right) ─── */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-50 dark:bg-slate-955">
        
        {/* TOP WORKBOOK BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-900/60 bg-white dark:bg-slate-950 p-3.5 gap-3.5 select-none">
          {/* Active Range Coordinate Display */}
          <div className="flex items-center gap-2 flex-grow min-w-0">
            <div className="bg-slate-100 dark:bg-slate-900 px-3 py-1.8 rounded-lg font-mono text-[11px] font-bold text-slate-655 dark:text-slate-350 select-text flex-shrink-0 min-w-[50px] text-center border border-slate-200/50 dark:border-slate-800">
              {activeCell ? `${getColumnLetter(activeCell.col)}${activeCell.row + 1}` : 'N/A'}
            </div>
            
            {/* Sync cell input Formula Bar */}
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 shrink-0 font-sans uppercase">Formula Bar:</span>
            <input
              type="text"
              placeholder="Enter text, numbers, or formulas like =SUM(A1:B10)"
              value={formulaInput}
              onChange={(e) => {
                setFormulaInput(e.target.value);
                if (activeCell) handleCellEdit(activeCell.row, activeCell.col, e.target.value);
              }}
              className="flex-grow bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-855 rounded-lg px-3 py-1.8 text-[11px] font-mono outline-none focus:border-brand-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80 leading-normal"
            />
          </div>

          {/* Quick grid operations toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAddRow}
              className="px-2.5 py-1.8 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-350 transition-all flex items-center gap-1 shrink-0"
              title="Add 5 Rows to Grid Bottom"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Rows</span>
            </button>

            <button
              onClick={handleAddColumn}
              className="px-2.5 py-1.8 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-350 transition-all flex items-center gap-1 shrink-0"
              title="Add 2 Columns to Grid Right"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Cols</span>
            </button>

            <button
              onClick={handleClearGrid}
              className="p-1.8 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-455 hover:text-red-550 border border-slate-200 dark:border-slate-850 rounded-lg transition-colors shrink-0"
              title="Prune workbook data"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-850 shrink-0" />

            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.8 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-350 transition-all flex items-center gap-1 shrink-0"
              title="Export as CSV download"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportToDuckDb}
              className="px-2.5 py-1.8 bg-brand-650 hover:bg-brand-600 text-white rounded-lg text-[10.5px] font-bold shadow-xs transition-all flex items-center gap-1 shrink-0"
              title="Register spreadsheet as table in DuckDB sandbox"
            >
              <Database className="w-3.5 h-3.5" />
              <span>To DuckDB</span>
            </button>
          </div>
        </div>

        {/* ─── EXCEL MEMORY SAFE VIRTUAL GRID ─── */}
        <div className="flex-grow p-4 md:p-6 overflow-hidden">
          <SpreadsheetGrid
            rowCount={rowCount}
            columnCount={columnCount}
            cells={cells}
            activeCell={activeCell}
            selectedRange={selectedRange}
            onCellEdit={handleCellEdit}
            onActiveCellChange={(r, c) => setActiveCell({ row: r, col: c })}
            onSelectRange={setSelectedRange}
          />
        </div>
      </div>
      
    </div>
  );
};

export default SheetsConnect;
