export interface SavedTable {
  tableName: string;
  buffer: Uint8Array;
  rowCount: number;
  columns: Array<{ name: string; type: string }>;
  savedAt: string;
}

class VaultService {
  private dbName = 'DatumSVault';
  private storeName = 'parquet_datasets';
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'tableName' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save a Parquet-compressed dataset buffer to IndexedDB.
   */
  async saveTable(
    tableName: string, 
    buffer: Uint8Array, 
    rowCount: number, 
    columns: Array<{ name: string; type: string }>
  ): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const record: SavedTable = {
        tableName,
        buffer,
        rowCount,
        columns,
        savedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load all saved tables from IndexedDB.
   */
  async loadAllTables(): Promise<SavedTable[]> {
    const db = await this.dbPromise;
    return new Promise<SavedTable[]>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a saved table from IndexedDB.
   */
  async deleteTable(tableName: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.delete(tableName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all records in the IndexedDB object store.
   */
  async clearVault(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cryptographic SHA-256 helper inside local memory sandbox.
   */
  async calculateHash(text: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Export the entire IndexedDB database sandbox state as a single consolidated JSON string.
   */
  async exportBackup(): Promise<string> {
    const tables = await this.loadAllTables();
    
    // Chunked high-performance, stack-safe base64 encoder
    const uint8ToBase64 = (arr: Uint8Array): string => {
      const chunks: string[] = [];
      const chunkSize = 0xffff;
      for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.subarray(i, i + chunkSize);
        chunks.push(String.fromCharCode.apply(null, chunk as any));
      }
      return btoa(chunks.join(''));
    };

    const backupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tables: tables.map(t => ({
        tableName: t.tableName,
        base64Buffer: uint8ToBase64(t.buffer),
        rowCount: t.rowCount,
        columns: t.columns,
        savedAt: t.savedAt
      }))
    };

    const payloadString = JSON.stringify(backupPayload);
    const checksum = await this.calculateHash(payloadString);

    return JSON.stringify({
      payload: backupPayload,
      checksum
    });
  }

  /**
   * Validate the cryptographic checksum seal and read the table details.
   */
  async importBackup(jsonText: string): Promise<{
    success: boolean;
    tablesCount: number;
    tablesDetail: string;
    verified: boolean;
    payload?: any;
    error?: string;
  }> {
    try {
      const envelope = JSON.parse(jsonText);
      if (!envelope.payload || !envelope.checksum) {
        return {
          success: false,
          tablesCount: 0,
          tablesDetail: '',
          verified: false,
          error: 'Invalid file format. Missing backup payload or checksum integrity seal.'
        };
      }

      const computedChecksum = await this.calculateHash(JSON.stringify(envelope.payload));
      const verified = computedChecksum === envelope.checksum;

      if (!verified) {
        return {
          success: false,
          tablesCount: 0,
          tablesDetail: '',
          verified: false,
          error: 'TAMPER-EVIDENT SIGNAL FAIL: Cryptographic checksum validation failed. Backup package has been altered.'
        };
      }

      const tables = envelope.payload.tables || [];
      const tablesDetail = tables.map((t: any) => `"${t.tableName}" (${t.rowCount.toLocaleString()} rows)`).join(', ');

      return {
        success: true,
        tablesCount: tables.length,
        tablesDetail: tablesDetail || 'No tables in backup',
        verified: true,
        payload: envelope.payload
      };
    } catch (err: any) {
      return {
        success: false,
        tablesCount: 0,
        tablesDetail: '',
        verified: false,
        error: `Import syntax error: ${err.message || err}`
      };
    }
  }

  /**
   * Restore all Parquet tables from backup back into IndexedDB store.
   */
  async restoreBackup(payload: any): Promise<void> {
    // Clear the vault first to ensure old/unrelated tables are purged
    await this.clearVault();

    const base64ToUint8 = (base64: string): Uint8Array => {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    const tables = payload.tables || [];
    for (const t of tables) {
      const buffer = base64ToUint8(t.base64Buffer);
      await this.saveTable(t.tableName, buffer, t.rowCount, t.columns);
    }
  }
}

export const vaultService = new VaultService();
export default vaultService;
