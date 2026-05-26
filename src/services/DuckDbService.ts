import * as duckdb from '@duckdb/duckdb-wasm';
import eventBus from './EventBus';
import vaultService from './VaultService';

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableMeta {
  name: string;
  rowCount: number;
  columns: TableColumn[];
  isSaved: boolean;
  savedAt?: string;
}

class DuckDbService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private tables: TableMeta[] = [];
  private isInitializing = false;
  private isInitialized = false;

  /**
   * Initializes the browser-native DuckDB-Wasm sandbox.
   * Loads web workers and WebAssembly modules from public CDNs.
   */
  async init(): Promise<{ db: duckdb.AsyncDuckDB; conn: duckdb.AsyncDuckDBConnection }> {
    if (this.db && this.conn) {
      return { db: this.db, conn: this.conn };
    }

    if (this.isInitializing) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.isInitialized && this.db && this.conn) {
            clearInterval(check);
            resolve({ db: this.db, conn: this.conn });
          }
        }, 100);
      });
    }

    this.isInitializing = true;
    console.log('[DuckDbService] Initializing DuckDB-Wasm Sandbox...');

    try {
      // 1. Configure paths to CDN-hosted DuckDB-Wasm web worker and WASM packages
      const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-mvp.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-eh.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-eh.worker.js',
        },
      };

      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
      );

      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger();
      
      const dbInstance = new duckdb.AsyncDuckDB(logger, worker);
      await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      const connection = await dbInstance.connect();

      this.db = dbInstance;
      this.conn = connection;
      this.isInitialized = true;
      this.isInitializing = false;
      console.log('[DuckDbService] DuckDB-Wasm Successfully Loaded!');

      // 2. Automatically sync and restore any saved datasets from IndexedDB Vault
      await this.restoreTablesFromVault();

      return { db: this.db, conn: this.conn };
    } catch (error) {
      this.isInitializing = false;
      console.error('[DuckDbService] Failed to load DuckDB-Wasm:', error);
      throw error;
    }
  }

  /**
   * Run raw analytical SQL queries. Calculates accurate runtime duration.
   */
  async query(sql: string): Promise<{ rows: any[]; durationMs: number }> {
    const { conn } = await this.init();
    const start = performance.now();

    try {
      const result = await conn.query(sql);
      const rows = result.toArray().map((row) => row.toJSON());
      const end = performance.now();
      
      // Clean up column names and JSON types if necessary
      const cleanRows = JSON.parse(
        JSON.stringify(rows, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );

      return {
        rows: cleanRows,
        durationMs: Math.round(end - start),
      };
    } catch (error) {
      console.error(`[DuckDbService] SQL Execution Error [${sql}]:`, error);
      throw error;
    }
  }

  /**
   * Import standard CSV files into the workspace.
   */
  async importCsv(tableName: string, csvText: string): Promise<TableMeta> {
    const { db } = await this.init();
    
    // Clean table names to prevent SQL injection and format naming
    const cleanName = tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const fileName = `${cleanName}.csv`;

    // 1. Write the text file directly to DuckDB's Virtual File System (VFS)
    await db.registerFileText(fileName, csvText);

    // 2. Compile table creation using native CSV autodetector
    const sql = `CREATE OR REPLACE TABLE ${cleanName} AS SELECT * FROM read_csv_auto('${fileName}')`;
    await this.query(sql);

    // 3. Inspect columns and compile schema
    const schema = await this.getTableSchema(cleanName);
    const countResult = await this.query(`SELECT COUNT(*) as count FROM ${cleanName}`);
    const rowCount = Number(countResult.rows[0]?.count || 0);

    const newTable: TableMeta = {
      name: cleanName,
      rowCount,
      columns: schema,
      isSaved: false,
    };

    // 4. Update memory cache and signal event bus
    this.tables = this.tables.filter((t) => t.name !== cleanName).concat(newTable);
    eventBus.emit('TABLES_UPDATED', this.tables);
    eventBus.emit('AUDIT_LOG', {
      action: 'INGEST_CSV',
      details: `Structured dataset '${cleanName}' loaded. Ingested ${rowCount} records.`,
      status: 'success'
    });

    return newTable;
  }

  /**
   * Ingest sheet data arrays parsed from Excel spreadsheet pages.
   */
  async importJsonRows(tableName: string, rows: any[]): Promise<TableMeta> {
    // Converts JSON records into CSV format to ingest efficiently via read_csv_auto
    if (rows.length === 0) {
      throw new Error('Cannot import an empty dataset.');
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(header => {
          const val = row[header];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(',')
      )
    ];

    return this.importCsv(tableName, csvLines.join('\n'));
  }

  /**
   * Sync and retrieve schemas
   */
  private async getTableSchema(tableName: string): Promise<TableColumn[]> {
    const info = await this.query(`PRAGMA table_info('${tableName}')`);
    return info.rows.map((row: any) => ({
      name: row.name,
      type: row.type || 'VARCHAR',
    }));
  }

  /**
   * Commits an active sandbox table into a compressed Parquet backup file and vaults it.
   */
  async saveTableToVault(tableName: string): Promise<void> {
    const { db } = await this.init();
    
    const table = this.tables.find((t) => t.name === tableName);
    if (!table) throw new Error(`Table ${tableName} not found in active workspace.`);

    const parquetFile = `${tableName}.parquet`;
    
    // 1. Render data into compressed Parquet inside DuckDB VFS
    await this.query(`COPY ${tableName} TO '${parquetFile}' (FORMAT PARQUET);`);

    // 2. Fetch binary buffer out of Virtual File System
    const buffer = await db.copyFileToBuffer(parquetFile);
    
    // 3. Persist in IndexedDB
    await vaultService.saveTable(tableName, buffer, table.rowCount, table.columns);

    // 4. Update memory cache status
    table.isSaved = true;
    table.savedAt = new Date().toISOString();
    
    this.tables = [...this.tables];
    eventBus.emit('TABLES_UPDATED', this.tables);
    eventBus.emit('AUDIT_LOG', {
      action: 'VAULT_SAVE',
      details: `Table '${tableName}' compressed to Parquet and persisted in IndexedDB Vault.`,
      status: 'success'
    });
  }

  /**
   * Export an active in-memory table as Parquet compressed Uint8Array bytes.
   */
  async exportTableAsParquet(tableName: string): Promise<Uint8Array> {
    const { db } = await this.init();
    const table = this.tables.find((t) => t.name === tableName);
    if (!table) throw new Error(`Table ${tableName} not found in active workspace.`);

    const tempFile = `${tableName}_export_${Date.now()}.parquet`;
    try {
      // 1. Export in-memory table to Parquet VFS file
      await this.query(`COPY ${tableName} TO '${tempFile}' (FORMAT PARQUET);`);
      // 2. Read file to buffer
      const buffer = await db.copyFileToBuffer(tempFile);
      return buffer;
    } finally {
      // Clean up VFS file
      try {
        await db.dropFile(tempFile);
      } catch (err) {
        console.warn(`[DuckDbService] Failed to clean up temp Parquet file ${tempFile}:`, err);
      }
    }
  }

  /**
   * Mount Parquet binary bytes back as an active memory table in the DuckDB sandbox.
   */
  async importTableFromParquet(tableName: string, buffer: Uint8Array, columns: TableColumn[], rowCount: number): Promise<void> {
    const { db } = await this.init();
    const parquetFile = `${tableName}.parquet`;

    // 1. Register binary buffer in VFS
    await db.registerFileBuffer(parquetFile, buffer);

    // 2. Restore table from Parquet
    await this.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${parquetFile}')`);

    const newTable: TableMeta = {
      name: tableName,
      rowCount,
      columns,
      isSaved: false,
    };

    // 3. Update active tables list
    this.tables = this.tables.filter((t) => t.name !== tableName);
    this.tables.push(newTable);
    
    eventBus.emit('TABLES_UPDATED', this.tables);
    eventBus.emit('AUDIT_LOG', {
      action: 'LIBRARY_INGEST_PARQUET',
      details: `Table '${tableName}' loaded from session workspace Parquet payload. Restored ${rowCount} rows.`,
      status: 'success'
    });
  }

  /**
   * Deletes an active dataset from the sandbox and local storage systems.
   */
  async deleteTable(tableName: string): Promise<void> {
    await this.query(`DROP TABLE IF EXISTS ${tableName}`);
    await vaultService.deleteTable(tableName);

    this.tables = this.tables.filter((t) => t.name !== tableName);
    eventBus.emit('TABLES_UPDATED', this.tables);
    eventBus.emit('AUDIT_LOG', {
      action: 'TABLE_DELETE',
      details: `Table '${tableName}' deleted from workspace and Vault storage.`,
      status: 'success'
    });
  }

  /**
   * Syncs and registers previously saved Parquet tables from IndexedDB upon loading.
   */
  private async restoreTablesFromVault(): Promise<void> {
    const { db } = await this.init();
    console.log('[DuckDbService] Loading persistent archives from Vault...');

    try {
      const savedTables = await vaultService.loadAllTables();
      
      for (const saved of savedTables) {
        const parquetFile = `${saved.tableName}.parquet`;
        
        // Register binary buffer in VFS
        await db.registerFileBuffer(parquetFile, saved.buffer);
        
        // Restore table from Parquet
        await this.query(`CREATE OR REPLACE TABLE ${saved.tableName} AS SELECT * FROM read_parquet('${parquetFile}')`);

        const restoredTable: TableMeta = {
          name: saved.tableName,
          rowCount: saved.rowCount,
          columns: saved.columns,
          isSaved: true,
          savedAt: saved.savedAt,
        };

        // Filter out table if it's already present in memory list to avoid duplicates
        this.tables = this.tables.filter((t) => t.name !== saved.tableName);
        this.tables.push(restoredTable);
      }

      if (savedTables.length > 0) {
        console.log(`[DuckDbService] Restored ${savedTables.length} tables from Vault.`);
        eventBus.emit('TABLES_UPDATED', this.tables);
      }
    } catch (err) {
      console.error('[DuckDbService] Failed to restore vaulted tables:', err);
    }
  }

  /**
   * Scans all tables present in the DuckDB instance, updates their row counts and schemas,
   * adds any newly created tables, and removes dropped ones.
   */
  async refreshAllTablesMetadata(): Promise<void> {
    try {
      const showTablesRes = await this.query('SHOW TABLES;');
      const activeNames = showTablesRes.rows.map((r: any) => r.name || r.table_name || Object.values(r)[0] as string);
      
      const newTablesList: TableMeta[] = [];
      
      for (const name of activeNames) {
        // Exclude system backup tables from workspace listing
        if (name.includes('_backup_')) continue;

        const schema = await this.getTableSchema(name);
        const countResult = await this.query(`SELECT COUNT(*) as count FROM ${name}`);
        const rowCount = Number(countResult.rows[0]?.count || 0);
        
        const existing = this.tables.find(t => t.name === name);
        newTablesList.push({
          name,
          rowCount,
          columns: schema,
          isSaved: existing ? existing.isSaved : false,
          savedAt: existing ? existing.savedAt : undefined
        });
      }
      
      this.tables = newTablesList;
      eventBus.emit('TABLES_UPDATED', this.tables);
    } catch (err) {
      console.warn('[DuckDbService] Failed to refresh all tables metadata:', err);
    }
  }

  /**
   * Returns metadata for all currently registered active tables.
   */
  getActiveTables(): TableMeta[] {
    return this.tables;
  }

  /**
   * Clears memory cache and re-loads persisted tables from Vault.
   */
  async reloadVault(): Promise<void> {
    // Drop all tables currently loaded to ensure they are cleaned in DuckDB VFS
    for (const t of this.tables) {
      try {
        await this.query(`DROP TABLE IF EXISTS ${t.name}`);
      } catch (err) {
        console.warn(`Failed to drop table ${t.name} during reload:`, err);
      }
    }
    this.tables = [];
    await this.restoreTablesFromVault();
  }
}

export const duckDbService = new DuckDbService();
export default duckDbService;
