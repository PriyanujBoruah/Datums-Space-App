import duckDbService from './DuckDbService';

export interface ColumnStats {
  name: string;
  type: string;
  count: number;
  nullCount: number;
  distinctCount: number;
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  sum?: number;
  topValues?: { value: string; count: number }[];
}

export interface TemporalAggregation {
  columnName: string;
  timeGrain: 'year' | 'month' | 'day';
  data: { period: string; count: number }[];
}

export interface OutlierRow {
  rowNumber: number;
  columnName: string;
  value: number;
  lowerBound: number;
  upperBound: number;
  rowData: Record<string, any>;
}

export interface CorrelationCell {
  col1: string;
  col2: string;
  coefficient: number;
}

export interface ParetoCategory {
  category: string;
  value: number;
  ratio: number;
  rank: number;
}

export interface ParetoAnalysis {
  categoricalColumn: string;
  numericalColumn: string;
  totalCategories: number;
  categoriesIn80Percent: number;
  percentageDriving80: number;
  grandTotal: number;
  topCategories: ParetoCategory[];
  isApplicable: boolean;
}

export interface GroundTruthPackage {
  tableName: string;
  rowCount: number;
  columnsCount: number;
  columns: { name: string; type: string }[];
  columnDetails: ColumnStats[];
  temporalTrends: TemporalAggregation[];
  outliers: OutlierRow[];
  timestamp: string;
  correlationMatrix: CorrelationCell[];
  paretoAnalysis: ParetoAnalysis;
}

class SpatialBookEngine {
  /**
   * Helper to check if a type string is numeric in DuckDB.
   */
  isNumeric(type: string): boolean {
    const t = type.toUpperCase();
    return (
      t.includes('INT') ||
      t.includes('DOUBLE') ||
      t.includes('FLOAT') ||
      t.includes('DECIMAL') ||
      t.includes('REAL') ||
      t.includes('NUMERIC')
    );
  }

  /**
   * Helper to check if a type string represents dates/timestamps in DuckDB.
   */
  isDateOrTime(type: string, columnName: string): boolean {
    const t = type.toUpperCase();
    const c = columnName.toLowerCase();
    return (
      t.includes('DATE') ||
      t.includes('TIME') ||
      t.includes('TIMESTAMP') ||
      c.includes('date') ||
      c.includes('timestamp') ||
      c.includes('year')
    );
  }

  /**
   * Computes a fully deterministic statistical ground-truth analysis package directly from DuckDB.
   */
  async generateGroundTruthPackage(tableName: string): Promise<GroundTruthPackage> {
    const tables = duckDbService.getActiveTables();
    const meta = tables.find((t) => t.name === tableName);
    if (!meta) {
      throw new Error(`Table '${tableName}' not found in active database workspace.`);
    }

    const rowCount = meta.rowCount;
    const columnsCount = meta.columns.length;
    const columns = meta.columns;

    const columnDetails: ColumnStats[] = [];
    const temporalTrends: TemporalAggregation[] = [];
    const outliers: OutlierRow[] = [];

    // Process each column programmatically
    for (const col of columns) {
      const escapedCol = `"${col.name}"`;

      // 1. Basic counts (non-nulls, nulls, distinct counts)
      const countQuery = `SELECT 
        COUNT(${escapedCol}) as non_null,
        COUNT(DISTINCT ${escapedCol}) as distinct_val
      FROM ${tableName}`;
      
      const counts = await duckDbService.query(countQuery);
      const nonNullCount = Number(counts.rows[0]?.non_null || 0);
      const nullCount = rowCount - nonNullCount;
      const distinctCount = Number(counts.rows[0]?.distinct_val || 0);

      const colStats: ColumnStats = {
        name: col.name,
        type: col.type,
        count: rowCount,
        nullCount,
        distinctCount,
      };

      // 2. Numeric Profiling
      if (this.isNumeric(col.type)) {
        try {
          const numQuery = `SELECT 
            MIN(${escapedCol}) as min_val, 
            MAX(${escapedCol}) as max_val, 
            AVG(${escapedCol}) as avg_val, 
            STDDEV(${escapedCol}) as stddev_val,
            CAST(SUM(${escapedCol}) AS DOUBLE) as sum_val,
            QUANTILE_CONT(${escapedCol}, 0.25) as p25,
            QUANTILE_CONT(${escapedCol}, 0.50) as p50,
            QUANTILE_CONT(${escapedCol}, 0.75) as p75
          FROM ${tableName} 
          WHERE ${escapedCol} IS NOT NULL`;

          const numStats = await duckDbService.query(numQuery);
          const row = numStats.rows[0];

          if (row) {
            colStats.min = row.min_val !== null ? Number(row.min_val) : undefined;
            colStats.max = row.max_val !== null ? Number(row.max_val) : undefined;
            colStats.avg = row.avg_val !== null ? Number(row.avg_val) : undefined;
            colStats.stddev = row.stddev_val !== null ? Number(row.stddev_val) : undefined;
            colStats.sum = row.sum_val !== null ? Number(row.sum_val) : undefined;
            colStats.p25 = row.p25 !== null ? Number(row.p25) : undefined;
            colStats.p50 = row.p50 !== null ? Number(row.p50) : undefined;
            colStats.p75 = row.p75 !== null ? Number(row.p75) : undefined;

            // 3. IQR Outlier Detection programmatically
            if (colStats.p25 !== undefined && colStats.p75 !== undefined) {
              const iqr = colStats.p75 - colStats.p25;
              const lowerBound = colStats.p25 - 1.5 * iqr;
              const upperBound = colStats.p75 + 1.5 * iqr;

              const outlierQuery = `SELECT *, 
                row_number() OVER () as duckdb_row_num 
              FROM ${tableName} 
              WHERE ${escapedCol} < ${lowerBound} OR ${escapedCol} > ${upperBound}
              LIMIT 15`;

              const outlierResults = await duckDbService.query(outlierQuery);
              
              outlierResults.rows.forEach((outlierRow, index) => {
                const val = Number(outlierRow[col.name]);
                // Remove internal duckdb_row_num from raw data presentation
                const rowData = { ...outlierRow };
                delete rowData.duckdb_row_num;

                outliers.push({
                  rowNumber: Number(outlierRow.duckdb_row_num || index + 1),
                  columnName: col.name,
                  value: val,
                  lowerBound,
                  upperBound,
                  rowData,
                });
              });
            }
          }
        } catch (err) {
          console.warn(`[SpatialBookEngine] Numeric profile failed for col '${col.name}':`, err);
        }
      } else {
        // 4. Categorical Profiling (Top unique frequencies)
        try {
          const catQuery = `SELECT 
            CAST(${escapedCol} as VARCHAR) as val, 
            COUNT(*) as freq 
          FROM ${tableName} 
          WHERE ${escapedCol} IS NOT NULL
          GROUP BY val 
          ORDER BY freq DESC 
          LIMIT 6`;

          const catResults = await duckDbService.query(catQuery);
          colStats.topValues = catResults.rows.map((row) => ({
            value: row.val || '(Empty)',
            count: Number(row.freq),
          }));
        } catch (err) {
          console.warn(`[SpatialBookEngine] Categorical profile failed for col '${col.name}':`, err);
        }
      }

      // 5. Temporal trend profiling if the column is a date/time
      if (this.isDateOrTime(col.type, col.name)) {
        try {
          // Attempt month-level strftime trend extraction
          const timeQuery = `SELECT 
            strftime(CAST(${escapedCol} as TIMESTAMP), '%Y-%m') as period, 
            COUNT(*) as count 
          FROM ${tableName} 
          WHERE ${escapedCol} IS NOT NULL
          GROUP BY period 
          ORDER BY period ASC 
          LIMIT 30`;

          const timeResults = await duckDbService.query(timeQuery);
          // If query returned periods, keep it
          if (timeResults.rows.length > 0 && timeResults.rows[0].period !== null) {
            temporalTrends.push({
              columnName: col.name,
              timeGrain: 'month',
              data: timeResults.rows.map((r) => ({
                period: r.period,
                count: Number(r.count),
              })),
            });
          }
        } catch (err) {
          console.log(`[SpatialBookEngine] Temporal trend scan failed for col '${col.name}' (non-date structure).`);
        }
      }

      columnDetails.push(colStats);
    }

    // --- ADVANCED CALCULATIONS FOR PARETO & CORRELATION MATRIX ---
    const numericCols = columns.filter(c => this.isNumeric(c.type));
    const categoricalCols = columns.filter(c => 
      !this.isNumeric(c.type) && 
      !this.isDateOrTime(c.type, c.name) && 
      !c.name.toLowerCase().includes('id') && 
      !c.name.toLowerCase().includes('email') && 
      !c.name.toLowerCase().includes('url') && 
      !c.name.toLowerCase().includes('phone')
    );

    // 1. Calculate Pairwise Correlation Matrix
    const correlationMatrix: CorrelationCell[] = [];
    const numColsForCorr = numericCols.slice(0, 10); // Cap at 10 columns for a clean 10x10 UI heatmap

    for (const col of numColsForCorr) {
      correlationMatrix.push({
        col1: col.name,
        col2: col.name,
        coefficient: 1.0
      });
    }

    if (numColsForCorr.length >= 2) {
      const selectParts: string[] = [];
      for (let i = 0; i < numColsForCorr.length; i++) {
        for (let j = i + 1; j < numColsForCorr.length; j++) {
          selectParts.push(`corr("${numColsForCorr[i].name}", "${numColsForCorr[j].name}") as "corr_${i}_${j}"`);
        }
      }

      try {
        const corrQuery = `SELECT ${selectParts.join(', ')} FROM ${tableName}`;
        const corrRes = await duckDbService.query(corrQuery);
        const row = corrRes.rows[0];
        if (row) {
          for (let i = 0; i < numColsForCorr.length; i++) {
            for (let j = i + 1; j < numColsForCorr.length; j++) {
              const val = row[`corr_${i}_${j}`];
              const coeff = val !== null && !isNaN(Number(val)) ? Number(val) : 0.0;
              
              correlationMatrix.push({
                col1: numColsForCorr[i].name,
                col2: numColsForCorr[j].name,
                coefficient: coeff
              });
              correlationMatrix.push({
                col1: numColsForCorr[j].name,
                col2: numColsForCorr[i].name,
                coefficient: coeff
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[SpatialBookEngine] Pearson correlation matrix query failed:`, err);
      }
    }

    // 2. Calculate Programmatic Pareto (80/20) Analysis
    let paretoAnalysis: ParetoAnalysis = {
      categoricalColumn: '',
      numericalColumn: '',
      totalCategories: 0,
      categoriesIn80Percent: 0,
      percentageDriving80: 0,
      grandTotal: 0,
      topCategories: [],
      isApplicable: false
    };

    // Find the best numerical candidate (price, revenue, etc.)
    const numColCandidate = numericCols.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('price') || n.includes('revenue') || n.includes('sales') || n.includes('amount') || n.includes('review') || n.includes('count') || n.includes('qty') || n.includes('quantity');
    }) || numericCols[0] || null;

    // Find the best categorical candidate
    const catColCandidate = categoricalCols.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('neighbourhood') || n.includes('neighborhood') || n.includes('category') || n.includes('type') || n.includes('group') || n.includes('host') || n.includes('city') || n.includes('region') || n.includes('country') || n.includes('product') || n.includes('brand');
    }) || categoricalCols[0] || null;

    if (numColCandidate && catColCandidate) {
      try {
        const paretoQuery = `
          WITH grouped AS (
            SELECT 
              CAST("${catColCandidate.name}" AS VARCHAR) as category, 
              CAST(SUM(ABS("${numColCandidate.name}")) AS DOUBLE) as val
            FROM ${tableName}
            WHERE "${catColCandidate.name}" IS NOT NULL AND "${numColCandidate.name}" IS NOT NULL
            GROUP BY category
          ),
          sorted AS (
            SELECT 
              category,
              val,
              ROW_NUMBER() OVER (ORDER BY val DESC) as rank
            FROM grouped
            WHERE val > 0
          ),
          running AS (
            SELECT
              category,
              val,
              rank,
              CAST(SUM(val) OVER (ORDER BY val DESC) AS DOUBLE) as running_sum,
              CAST(SUM(val) OVER () AS DOUBLE) as grand_total
            FROM sorted
          )
          SELECT 
            category,
            val,
            rank,
            running_sum,
            grand_total,
            CAST(running_sum / grand_total AS DOUBLE) as ratio
          FROM running
          ORDER BY rank ASC;
        `;

        const paretoRes = await duckDbService.query(paretoQuery);
        const rows = paretoRes.rows;

        if (rows.length > 0) {
          const grandTotal = Number(rows[0].grand_total || 0);
          let categoriesIn80Percent = 0;
          
          for (let i = 0; i < rows.length; i++) {
            if (Number(rows[i].ratio) >= 0.8) {
              categoriesIn80Percent = i + 1;
              break;
            }
          }
          if (categoriesIn80Percent === 0 && rows.length > 0) {
            categoriesIn80Percent = rows.length;
          }

          const totalCategories = rows.length;
          const percentageDriving80 = totalCategories > 0 ? (categoriesIn80Percent / totalCategories) * 100 : 0;

          const topCategories: ParetoCategory[] = rows.map((r: any) => ({
            category: r.category || '(Empty)',
            value: Number(r.val || 0),
            ratio: Number(r.ratio || 0),
            rank: Number(r.rank || 0)
          }));

          paretoAnalysis = {
            categoricalColumn: catColCandidate.name,
            numericalColumn: numColCandidate.name,
            totalCategories,
            categoriesIn80Percent,
            percentageDriving80,
            grandTotal,
            topCategories,
            isApplicable: true
          };
        }
      } catch (err) {
        console.warn(`[SpatialBookEngine] Pareto analysis computation failed:`, err);
      }
    }

    return {
      tableName,
      rowCount,
      columnsCount,
      columns,
      columnDetails,
      temporalTrends,
      outliers: outliers.slice(0, 30), // Cap at 30 outliers to prevent context clogging
      timestamp: new Date().toISOString(),
      correlationMatrix,
      paretoAnalysis
    };
  }
}

export const spatialBookEngine = new SpatialBookEngine();
export default spatialBookEngine;
