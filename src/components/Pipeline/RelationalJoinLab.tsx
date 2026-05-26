import React, { useState, useEffect } from 'react';
import { GitBranch, Table, Plus, ChevronRight, Play, CheckCircle2, AlertTriangle, ArrowLeftRight, Loader2 } from 'lucide-react';
import duckDbService from '../../services/DuckDbService';
import type { TableMeta } from '../../services/DuckDbService';
import eventBus from '../../services/EventBus';

interface RelationalJoinLabProps {
  onJoinComplete: () => void;
}

export const RelationalJoinLab: React.FC<RelationalJoinLabProps> = ({ onJoinComplete }) => {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [tableA, setTableA] = useState('');
  const [tableB, setTableB] = useState('');
  const [keyA, setKeyA] = useState('');
  const [keyB, setKeyB] = useState('');
  const [joinType, setJoinType] = useState<'LEFT' | 'INNER' | 'RIGHT'>('LEFT');
  const [outputTableName, setOutputTableName] = useState('joined_dataset');
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedPreview, setJoinedPreview] = useState<{ headers: string[]; rows: any[]; totalCount: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. Sync table listing from active DuckDB tables
    const syncTables = () => {
      const active = duckDbService.getActiveTables();
      setTables(active);
      if (active.length > 0) {
        if (!tableA) setTableA(active[0].name);
        if (!tableB && active.length > 1) setTableB(active[1].name);
      }
    };

    syncTables();
    const unsub = eventBus.on('TABLES_UPDATED', syncTables);
    return () => unsub();
  }, [tableA, tableB]);

  // Sync columns when selected tables alter
  const colsA = tables.find(t => t.name === tableA)?.columns || [];
  const colsB = tables.find(t => t.name === tableB)?.columns || [];

  useEffect(() => {
    if (colsA.length > 0 && !keyA) setKeyA(colsA[0].name);
  }, [colsA, keyA]);

  useEffect(() => {
    if (colsB.length > 0 && !keyB) setKeyB(colsB[0].name);
  }, [colsB, keyB]);

  const compileJoinSql = (limit = true): string => {
    if (!tableA || !tableB || !keyA || !keyB) return '';
    return `SELECT a.*, b.* EXCLUDE (${tableB}.${keyB}) 
FROM ${tableA} a 
${joinType} JOIN ${tableB} b 
ON a.${keyA} = b.${keyB}${limit ? ' LIMIT 20' : ''}`;
  };

  const handlePreview = async () => {
    if (!tableA || !tableB || !keyA || !keyB) return;
    setIsExecuting(true);
    setError(null);
    setJoinedPreview(null);
    setSuccessMsg(null);

    try {
      const previewSql = compileJoinSql(true);
      const { rows } = await duckDbService.query(previewSql);
      
      const countSql = `SELECT COUNT(*) as count FROM ${tableA} a ${joinType} JOIN ${tableB} b ON a.${keyA} = b.${keyB}`;
      const countRes = await duckDbService.query(countSql);
      const totalCount = Number(countRes.rows[0]?.count || 0);

      if (rows.length > 0) {
        setJoinedPreview({
          headers: Object.keys(rows[0]),
          rows,
          totalCount
        });
      } else {
        setError('The compiled SQL join executed successfully, but returned 0 rows.');
      }
    } catch (err: any) {
      setError(`Join Compile Error: ${err.message || err}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveJoin = async () => {
    if (!tableA || !tableB || !keyA || !keyB || !outputTableName.trim()) return;
    setIsExecuting(true);
    setError(null);

    const cleanOutputName = outputTableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      // 1. Create a permanent table from the full (unlimited) SQL Join
      const fullJoinSql = `CREATE OR REPLACE TABLE ${cleanOutputName} AS 
SELECT a.*, b.* EXCLUDE (${keyB}) 
FROM ${tableA} a 
${joinType} JOIN ${tableB} b 
ON a.${keyA} = b.${keyB}`;

      await duckDbService.query(fullJoinSql);

      // 2. Fetch schema and count to register
      const info = await duckDbService.query(`PRAGMA table_info('${cleanOutputName}')`);
      const schema = info.rows.map((row: any) => ({
        name: row.name,
        type: row.type || 'VARCHAR',
      }));

      const countRes = await duckDbService.query(`SELECT COUNT(*) as count FROM ${cleanOutputName}`);
      const rowCount = Number(countRes.rows[0]?.count || 0);

      const newTable: TableMeta = {
        name: cleanOutputName,
        rowCount,
        columns: schema,
        isSaved: false,
      };

      // 3. Register table in cache & emit
      const updated = duckDbService.getActiveTables().filter(t => t.name !== cleanOutputName).concat(newTable);
      
      // Reflect directly in service memory list
      (duckDbService as any).tables = updated;
      eventBus.emit('TABLES_UPDATED', updated);
      
      eventBus.emit('AUDIT_LOG', {
        action: 'TABLE_JOIN',
        details: `Created joined table '${cleanOutputName}' (${rowCount} rows) by merging '${tableA}' and '${tableB}'.`,
        status: 'success'
      });

      setSuccessMsg(`Joined dataset successfully compiled and registered as active table '${cleanOutputName}'!`);
      setJoinedPreview(null);
      onJoinComplete();
    } catch (err: any) {
      setError(`DuckDB Registration Failed: ${err.message || err}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (tables.length < 2) {
    return (
      <div className="relative overflow-hidden flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-center space-y-4 z-0">
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
              left: '25%',
              top: '12%',
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
              right: '12%',
              top: '30%',
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
              right: '20%',
              bottom: '25%',
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
              left: '15%',
              bottom: '18%',
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
              left: '35%',
              bottom: '12%',
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
              left: '58%',
              top: '15%',
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
              right: '30%',
              top: '28%',
              opacity: 0.65,
              animation: 'float-geom-upload-2 10s infinite ease-in-out'
            }}
          >
            <div className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2" style={{ backgroundColor: 'var(--color-brand-500)' }} />
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-505 dark:text-amber-500/80" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-750 dark:text-slate-200">Insufficient Datasets</h3>
            <p className="text-xs text-slate-550 dark:text-slate-500 max-w-sm">
              Relational joins require at least **two** separate tables. Please ingest a second spreadsheet (e.g. sales records + SKU dictionary lookup) to unlock the Join Lab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-brand-500 dark:text-brand-400" />
          Relational Join Lab
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Relate cryptic product keys, customer references, or invoice tables visually using high-speed in-browser SQL joins.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl shadow-lg">
        {/* Table A Selector */}
        <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center justify-center w-5 h-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] text-brand-600 dark:text-brand-400 font-bold">A</span>
            Primary Dataset (Left)
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase">Table</label>
              <select
                value={tableA}
                onChange={(e) => {
                  setTableA(e.target.value);
                  setKeyA('');
                }}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:outline-none shadow-xs"
              >
                {tables.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.rowCount} rows)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase">Join Key Column</label>
              <select
                value={keyA}
                onChange={(e) => setKeyA(e.target.value)}
                className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:outline-none font-mono shadow-xs"
              >
                {colsA.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type.toLowerCase()})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Join Operator & Settings */}
        <div className="flex flex-col justify-center items-center p-4 bg-brand-50/30 dark:bg-brand-950/5 border border-brand-100 dark:border-brand-500/5 rounded-xl space-y-4 shadow-xs">
          <div className="space-y-1.5 w-full">
            <label className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase block text-center">Join Operation</label>
            <div className="flex justify-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 p-1 rounded-lg">
              {(['LEFT', 'INNER', 'RIGHT'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setJoinType(type)}
                  className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${
                    joinType === type
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <GitBranch className="w-5 h-5 text-brand-500 dark:text-brand-400 animate-pulse" />
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600" />
            <Table className="w-5 h-5 text-emerald-550 dark:text-emerald-400" />
          </div>

          <button
            onClick={handlePreview}
            disabled={isExecuting}
            className="w-full py-2 bg-brand-600 hover:bg-brand-505 text-white font-semibold text-xs rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Execute Join Query
          </button>
        </div>

        {/* Table B Selector */}
        <div className="space-y-3 bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-200 dark:border-slate-855 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center justify-center w-5 h-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">B</span>
            Context Dataset (Right)
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase">Table</label>
              <select
                value={tableB}
                onChange={(e) => {
                  setTableB(e.target.value);
                  setKeyB('');
                }}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:outline-none shadow-xs"
              >
                {tables.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.rowCount} rows)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase">Join Key Column</label>
              <select
                value={keyB}
                onChange={(e) => setKeyB(e.target.value)}
                className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:outline-none font-mono shadow-xs"
              >
                {colsB.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type.toLowerCase()})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-500/20 text-red-650 dark:text-red-400 rounded-xl text-xs shadow-xs font-semibold">
          <strong>Execution Failure:</strong> {error}
        </div>
      )}

      {successMsg && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-500/20 rounded-xl text-center shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-555 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Join Operation Saved</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold rounded-lg transition-colors shadow-xs"
          >
            Design Another Join
          </button>
        </div>
      )}

      {joinedPreview && !successMsg && (
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4 shadow-lg transition-colors duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                SQL Join Preview (First 20 records shown)
              </span>
              <p className="text-[10px] text-slate-500">
                DuckDB query matched **{joinedPreview.totalCount.toLocaleString()}** total rows.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Output Name</label>
                <input
                  type="text"
                  value={outputTableName}
                  onChange={(e) => setOutputTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 max-w-[150px] focus:outline-none focus:border-brand-500 font-mono shadow-xs"
                />
              </div>

              <button
                onClick={handleSaveJoin}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Save as Active Table
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-850 rounded-lg bg-white dark:bg-slate-950/50 max-h-[250px] shadow-inner">
            <table className="w-full text-left border-collapse text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  {joinedPreview.headers.map((h) => (
                    <th key={h} className="px-4 py-2.5 min-w-[120px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                {joinedPreview.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    {joinedPreview.headers.map((h) => (
                      <td key={h} className="px-4 py-2 max-w-[200px] truncate">
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
  );
};

export default RelationalJoinLab;
