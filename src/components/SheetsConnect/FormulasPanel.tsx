import React, { useState } from 'react';
import { Sparkles, Plus, Book, Code } from 'lucide-react';
import agentManager from '../../services/AgentManager';
import { showAlert } from '../../services/DialogService';

interface FormulasPanelProps {
  activeCell: { row: number; col: number } | null;
  columnsList: string[];
  onApplyFormula: (formula: string) => void;
  onRegisterCustom: (name: string, jsBody: string) => void;
  customFormulas: Record<string, string>;
}

const FORMULA_DOCS = [
  { name: 'SUM', syntax: 'SUM(range)', desc: 'Sums all numeric values in a rectangular range. Example: =SUM(A1:B10)' },
  { name: 'AVERAGE', syntax: 'AVERAGE(range)', desc: 'Averages all numeric values in a range. Example: =AVERAGE(C1:C20)' },
  { name: 'MIN / MAX', syntax: 'MIN(range) / MAX(range)', desc: 'Returns the minimum or maximum value in a range. Example: =MIN(A1:A5)' },
  { name: 'COUNT', syntax: 'COUNT(range)', desc: 'Counts the number of cells that contain numbers. Example: =COUNT(D1:D10)' },
  { name: 'CONCAT', syntax: 'CONCAT(args...)', desc: 'Concatenates strings and cell values. Example: =CONCAT(A1, " ", B1)' },
  { name: 'IF', syntax: 'IF(condition, value_true, value_false)', desc: 'Evaluates condition, returns first value if true, second if false. Example: =IF(C2>100, "High", "Low")' },
  { name: 'VLOOKUP', syntax: 'VLOOKUP(value, range, col_index, [approx])', desc: 'Searches for a value in the first column of a range, and returns a value in the same row from a specified column. Example: =VLOOKUP(A1, B1:D20, 3, FALSE)' },
  { name: 'XLOOKUP', syntax: 'XLOOKUP(value, lookup_range, return_range)', desc: 'Modern lookup searching lookup_range for value, returning matching value in return_range. Example: =XLOOKUP(A1, B1:B10, C1:C10)' },
  { name: 'PIVOT', syntax: 'PIVOT(row_col, val_col, agg_fn)', desc: 'Dynamic column matrix aggregator. Example: =PIVOT(A1:A10, B1:B10, "SUM")' },
];

export const FormulasPanel: React.FC<FormulasPanelProps> = ({
  activeCell,
  columnsList,
  onApplyFormula,
  onRegisterCustom,
  customFormulas,
}) => {
  // Custom formula state
  const [customName, setCustomName] = useState('');
  const [customBody, setCustomBody] = useState('(x) => x * 2');

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState('');

  const handleCreateCustom = () => {
    if (!customName.trim()) {
      showAlert('Formula name cannot be blank.', 'Validation Error');
      return;
    }
    const cleanName = customName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanName) {
      showAlert('Formula name must contain only letters, numbers, and underscores.', 'Validation Error');
      return;
    }

    try {
      // Test compile
      const fn = new Function(`return ${customBody}`)();
      if (typeof fn !== 'function') {
        throw new Error('Provided string does not evaluate to a function.');
      }
      onRegisterCustom(cleanName, customBody);
      setCustomName('');
      showAlert(`Custom formula =${cleanName}() registered successfully! You can now use it in cells.`, 'Formula Registered');
    } catch (err: any) {
      showAlert(`Failed to compile Javascript: ${err.message || err}`, 'Compilation Error');
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGeneratedResult('');

    const contextColumns = columnsList.length > 0 
      ? `The columns present are: ${columnsList.join(', ')}.` 
      : 'Columns are labeled A, B, C etc.';

    const systemPrompt = `You are a spreadsheet formula assistant.
Spreadsheet context:
- Rows are 1-indexed.
- Columns are labeled alphabetically: A, B, C ... Z.
- ${contextColumns}

Your task:
Write a spreadsheet formula based on this English request: "${aiPrompt}"

Requirements:
1. Return ONLY the raw formula starting with "=" (e.g. =SUM(A1:A10) or =IF(C2>100, B2*1.1, B2)).
2. Do not write any explanations or wrapping markdown blocks. Return only the formula text.
3. Keep the formula compatible with standard spreadsheet engines. Supported formulas: SUM, AVERAGE, MIN, MAX, COUNT, CONCAT, IF, AND, OR, NOT, VLOOKUP, XLOOKUP.

Return formula string:`;

    try {
      const result = await agentManager.generateTextFromPrompt(systemPrompt);
      setGeneratedResult(result.trim());
    } catch (err: any) {
      showAlert(`AI generation failed: ${err.message || err}`, 'AI Error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 text-xs h-full overflow-y-auto pr-1">
      {/* 1. AI Formula Generator */}
      <div className="bg-slate-100/40 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3.5">
        <div className="flex items-center gap-1.5 text-brand-650 dark:text-brand-400 font-extrabold uppercase tracking-wider text-[10px]">
          <Sparkles className="w-4 h-4 text-brand-500" />
          AI Formula Generator
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
          Describe what you want to calculate in English, and the platform will assemble a valid spreadsheet formula.
        </p>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="e.g. Calculate 18% tax on column C if country is India (column B), otherwise calculate 5%."
          rows={3}
          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-2 text-[10.5px] outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400/80 leading-normal"
        />

        <button
          onClick={handleGenerateAI}
          disabled={generating || !aiPrompt.trim()}
          className="w-full py-2 bg-brand-650 hover:bg-brand-600 disabled:bg-brand-700/50 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
        >
          {generating ? (
            <>
              <span className="w-3 h-3 border border-white border-t-transparent animate-spin rounded-full block" />
              <span>Generating Formula...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Formula</span>
            </>
          )}
        </button>

        {generatedResult && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Generated Result</span>
            <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850 font-mono text-[10.5px] text-slate-850 dark:text-slate-250 select-all leading-normal flex items-center justify-between">
              <span>{generatedResult}</span>
            </div>
            {activeCell ? (
              <button
                onClick={() => onApplyFormula(generatedResult)}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-brand-650 dark:text-brand-400 font-bold rounded-md text-[10px] transition-all"
              >
                Apply to Selected Cell
              </button>
            ) : (
              <p className="text-[9px] text-amber-500 text-center font-medium">Select a grid cell to apply this formula.</p>
            )}
          </div>
        )}
      </div>

      {/* 2. Custom Javascript Formula Creator */}
      <div className="border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3.5 bg-white dark:bg-slate-950/20">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-350 font-extrabold uppercase tracking-wider text-[10px]">
          <Code className="w-4 h-4 text-slate-400" />
          Register Custom Formula
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
          Define your own mathematical or text mutations in raw Javascript, then invoke them directly as formulas.
        </p>

        <div className="space-y-2">
          <div className="space-y-0.5">
            <label className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold">Formula Name</label>
            <input
              type="text"
              placeholder="e.g. MULTIPLY_BY_FIVE"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2 py-1.5 text-[10.5px] font-mono outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="space-y-0.5">
            <label className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold">JS Body / Arrow Function</label>
            <textarea
              placeholder="(x) => x * 5"
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-2 text-[10.5px] font-mono outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200 leading-normal"
            />
          </div>

          <button
            onClick={handleCreateCustom}
            disabled={!customName.trim() || !customBody.trim()}
            className="w-full py-1.8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 hover:text-brand-650 dark:hover:text-brand-400 font-bold border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Custom Formula
          </button>
        </div>

        {Object.keys(customFormulas).length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">My Formulas</span>
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {Object.entries(customFormulas).map(([name, code]) => (
                <div key={name} className="flex justify-between items-center p-1.5 bg-slate-50/50 dark:bg-slate-900/40 rounded border border-slate-100 dark:border-slate-850">
                  <span className="font-mono font-bold text-slate-750 dark:text-slate-300 text-[10px]">{name}</span>
                  <span className="font-mono text-[9px] text-slate-455 truncate max-w-[150px]">{code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Formulas Documentation */}
      <div className="border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3.5 bg-white dark:bg-slate-950/20">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-350 font-extrabold uppercase tracking-wider text-[10px]">
          <Book className="w-4 h-4 text-slate-400" />
          Standard Reference Docs
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
          {FORMULA_DOCS.map((doc) => (
            <div key={doc.name} className="space-y-0.5 border-b border-slate-100 dark:border-slate-900 pb-2 last:border-b-0 last:pb-0">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[10px] bg-slate-100 dark:bg-slate-900 px-1 py-0.2 rounded">{doc.name}</span>
                <span className="text-[9px] text-slate-400 font-medium">{doc.syntax}</span>
              </div>
              <p className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-normal">{doc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
