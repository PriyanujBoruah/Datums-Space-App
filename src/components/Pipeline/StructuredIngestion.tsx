import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import duckDbService from '../../services/DuckDbService';

interface StructuredIngestionProps {
  onImportComplete: () => void;
}

export const StructuredIngestion: React.FC<StructuredIngestionProps> = ({ onImportComplete }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setFile(file);
    setError(null);
    setSuccessMsg(null);
    setParsedData(null);
    setSheets([]);
    setWorkbook(null);
    
    // Automatically pre-fill table name with file name
    const cleanName = file.name
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    setTableName(cleanName);

    setIsParsing(true);

    if (file.name.endsWith('.csv')) {
      parseCSV(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      parseExcel(file);
    } else {
      setError('Unsupported file type. Please upload a standard CSV or Excel (.xlsx/.xls) file.');
      setIsParsing(false);
      setFile(null);
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 50, // Preview first 50 rows in memory
      complete: (results) => {
        setIsParsing(false);
        if (results.data && results.data.length > 0) {
          const headers = Object.keys(results.data[0] as object);
          setParsedData({
            headers,
            rows: results.data,
          });
        } else {
          setError('The uploaded CSV file appears to be empty.');
        }
      },
      error: (err) => {
        setIsParsing(false);
        setError(`CSV Parse Error: ${err.message}`);
      },
    });
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        setIsParsing(false);

        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          previewExcelSheet(wb, firstSheet);
        } else {
          setError('The uploaded Excel workbook contains no worksheets.');
        }
      } catch (err: any) {
        setIsParsing(false);
        setError(`Excel Parse Error: ${err.message || err}`);
      }
    };
    reader.onerror = () => {
      setIsParsing(false);
      setError('Failed to read Excel file.');
    };
    reader.readAsArrayBuffer(file);
  };

  const previewExcelSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (json.length > 0) {
      const headers = Object.keys(json[0] as object);
      setParsedData({
        headers,
        rows: json,
      });
    } else {
      setParsedData(null);
      setError(`Worksheet '${sheetName}' appears to be empty.`);
    }
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    if (workbook) {
      setError(null);
      previewExcelSheet(workbook, sheetName);
    }
  };

  const handleImport = async () => {
    if (!file || !tableName.trim()) return;
    setIsParsing(true);
    setError(null);

    const cleanTableName = tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      if (file.name.endsWith('.csv')) {
        // Read full file text for high-fidelity DuckDB import
        const text = await file.text();
        await duckDbService.importCsv(cleanTableName, text);
      } else if (workbook && selectedSheet) {
        const ws = workbook.Sheets[selectedSheet];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        await duckDbService.importJsonRows(cleanTableName, rows);
      }

      setSuccessMsg(`Dataset successfully loaded as table '${cleanTableName}' in DuckDB-Wasm!`);
      setFile(null);
      setParsedData(null);
      onImportComplete();
    } catch (err: any) {
      setError(`DuckDB Import Failed: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-brand-500 dark:text-brand-400" />
          Structured Spreadsheet Ingestion
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload large CSV or Excel files. Parsing and schema detection occur strictly in your local browser sandbox.
        </p>
      </div>

      {!file && !successMsg && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative overflow-hidden flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-300 z-0 ${
            dragActive
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-900/50'
          }`}
        >
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
                left: '12%',
                top: '15%',
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
                right: '15%',
                top: '25%',
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
                right: '25%',
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
                left: '25%',
                bottom: '22%',
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
                left: '52%',
                bottom: '18%',
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
                left: '42%',
                top: '18%',
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
                right: '48%',
                top: '32%',
                opacity: 0.65,
                animation: 'float-geom-upload-2 10s infinite ease-in-out'
              }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleChange}
            />
            <div className="p-4 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md mb-4 text-brand-500 dark:text-brand-400">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Drag & drop spreadsheet here, or <span className="text-brand-650 dark:text-brand-400">browse files</span>
            </p>
            <p className="text-xs text-slate-550 dark:text-slate-500 mt-2">Supports CSV, XLSX, XLS up to 200MB</p>
          </div>
        </div>
      )}

      {isParsing && (
        <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-550 dark:text-brand-505 animate-spin" />
            <p className="text-sm text-slate-650 dark:text-slate-400 font-medium">Processing records and building schemas...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 rounded-xl text-red-650 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Ingestion Blocked</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-500/20 rounded-xl text-center shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Ingestion Complete</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            Load Another File
          </button>
        </div>
      )}

      {file && parsedData && !isParsing && (
        <div className="space-y-6 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                SQL Target Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="table_name"
                className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all"
              />
            </div>

            {sheets.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Worksheet
                </label>
                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg px-3 py-2 text-sm text-slate-750 dark:text-slate-200 outline-none transition-all"
                >
                  {sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Granular Schema Preview (First 5 records)
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Columns Detected: {parsedData.headers.length}
              </span>
            </div>
            
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800/80 rounded-lg bg-white dark:bg-slate-950/50 shadow-inner">
              <table className="w-full text-left border-collapse text-xs text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    {parsedData.headers.map((h) => (
                      <th key={h} className="px-4 py-3 min-w-[120px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800/50">
                  {parsedData.rows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      {parsedData.headers.map((h) => (
                        <td key={h} className="px-4 py-2.5 max-w-[200px] truncate">
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setFile(null);
                setParsedData(null);
              }}
              className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-855 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-md flex items-center gap-1.5"
            >
              Load into DuckDB Sandbox
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructuredIngestion;
