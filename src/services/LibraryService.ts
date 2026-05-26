import firebaseService from './FirebaseService';
import duckDbService from './DuckDbService';
import agentManager from './AgentManager';
import eventBus from './EventBus';
import { 
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, writeBatch 
} from 'firebase/firestore';

export interface LibrarySession {
  id: string;
  name: string;
  datasetName: string;
  datasetSize: number;
  rowCount: number;
  columns: Array<{ name: string; type: string }>;
  datasetFileBase64?: string; // Loaded dynamically on resume
  chatHistory: any[];
  auditLogs: any[];
  strategicGoal: string;
  activeRoster: string[];
  timestamp: string;
  createdBy: string;
  organizationId: string;
}

const uint8ToBase64 = (arr: Uint8Array): string => {
  const chunks: string[] = [];
  const chunkSize = 0xffff;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode.apply(null, chunk as any));
  }
  return btoa(chunks.join(''));
};

const base64ToUint8 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

class LibraryService {
  private dbPromise: Promise<IDBDatabase>;
  private dbName = 'DatumSLibrary';
  private storeName = 'sessions';

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper to load IndexedDB session list.
   */
  private async loadLocalSessions(): Promise<LibrarySession[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper to save session locally in IndexedDB.
   */
  private async saveLocalSession(session: LibrarySession): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper to delete session locally in IndexedDB.
   */
  private async deleteLocalSession(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Fetch all sessions belonging to the current user (metadata only, payload omitted to save bandwidth).
   */
  async loadAllSessions(): Promise<LibrarySession[]> {
    const user = firebaseService.getCurrentUser();
    if (!user) throw new Error('No user is currently authenticated.');

    if (firebaseService.isFirebaseConfigured()) {
      const firestore = firebaseService.getFirestoreDb();
      if (!firestore) throw new Error('Cloud Firestore database not initialized.');

      try {
        const libraryColRef = collection(firestore, 'users', user.uid, 'library');
        const querySnapshot = await getDocs(libraryColRef);
        const sessions: LibrarySession[] = [];
        
        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          sessions.push({
            id: docSnapshot.id,
            name: data.name,
            datasetName: data.datasetName,
            datasetSize: data.datasetSize,
            rowCount: data.rowCount,
            columns: data.columns || [],
            chatHistory: [], // omit chat and audit list from general index query
            auditLogs: [],
            strategicGoal: data.strategicGoal || '',
            activeRoster: data.activeRoster || [],
            timestamp: data.timestamp,
            createdBy: data.createdBy,
            organizationId: data.organizationId,
          });
        });

        // Sort by timestamp descending
        return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err) {
        console.warn('[LibraryService] Firestore load failed, falling back to local IndexedDB:', err);
        return this.loadLocalSessions();
      }
    } else {
      // Offline mode
      const local = await this.loadLocalSessions();
      return local
        .filter(s => s.createdBy === user.email)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }

  /**
   * Fetch full session payload including dataset Parquet base64 string, chat history, and audit trail logs.
   */
  async loadSessionPayload(id: string): Promise<LibrarySession> {
    const user = firebaseService.getCurrentUser();
    if (!user) throw new Error('No user is currently authenticated.');

    if (firebaseService.isFirebaseConfigured()) {
      const firestore = firebaseService.getFirestoreDb();
      if (!firestore) throw new Error('Cloud Firestore database not initialized.');

      const sessionDocRef = doc(firestore, 'users', user.uid, 'library', id);
      const docSnapshot = await getDoc(sessionDocRef);

      if (!docSnapshot.exists()) {
        throw new Error(`Library session '${id}' not found in Cloud Firestore.`);
      }

      const data = docSnapshot.data();
      let fullBase64 = '';

      if (data.hasChunks) {
        // Reassemble chunks
        const chunksColRef = collection(firestore, 'users', user.uid, 'library', id, 'chunks');
        const chunkSnapshots = await getDocs(chunksColRef);
        const sortedChunks = chunkSnapshots.docs
          .map(d => d.data())
          .sort((a, b) => a.index - b.index);

        fullBase64 = sortedChunks.map(c => c.payload).join('');
      } else {
        fullBase64 = data.datasetFileBase64 || '';
      }

      return {
        id: docSnapshot.id,
        name: data.name,
        datasetName: data.datasetName,
        datasetSize: data.datasetSize,
        rowCount: data.rowCount,
        columns: data.columns || [],
        datasetFileBase64: fullBase64,
        chatHistory: data.chatHistory || [],
        auditLogs: data.auditLogs || [],
        strategicGoal: data.strategicGoal || '',
        activeRoster: data.activeRoster || [],
        timestamp: data.timestamp,
        createdBy: data.createdBy,
        organizationId: data.organizationId,
      };
    } else {
      // Offline mode
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);
        request.onsuccess = () => {
          if (!request.result) reject(new Error(`Local library session '${id}' not found.`));
          else resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * Save the current analysis context to a slot (Firestore/IndexedDB). Checks account bounds (10 slots, 50MB total).
   */
  async saveSession(sessionName: string, datasetName: string): Promise<void> {
    const user = firebaseService.getCurrentUser();
    if (!user) throw new Error('No user is currently authenticated.');

    // 1. Export in-memory table to Parquet bytes
    const buffer = await duckDbService.exportTableAsParquet(datasetName);
    const tableMeta = duckDbService.getActiveTables().find(t => t.name === datasetName);
    if (!tableMeta) throw new Error(`Table ${datasetName} metadata not found.`);

    // 2. Read chat history and audit trail logs
    const chatHistory = agentManager.getChatHistory();
    let auditLogs: any[] = [];
    try {
      const restored = localStorage.getItem('datum_s_compliance_audit_logs');
      if (restored) {
        auditLogs = JSON.parse(restored);
      }
    } catch (err) {
      console.warn('[LibraryService] Failed to read local audit logs:', err);
    }

    const strategicGoal = agentManager.getSpatialGoal();
    const activeRoster = agentManager.getSpatialRoster();

    // 3. Perform quota check (max 10 slots, max 50MB size total)
    const existingSessions = await this.loadAllSessions();
    
    // Limit 1: Slots (Max 10 per account)
    if (existingSessions.length >= 10) {
      throw new Error(`SLOT_LIMIT_EXCEEDED: You have utilized all 10 available library slots. Please purge an old session to save this workspace.`);
    }

    // Limit 2: Storage Size (Max 50MB aggregate dataset sizes)
    const currentTotalSize = existingSessions.reduce((sum, s) => sum + s.datasetSize, 0);
    const newDatasetSize = buffer.length;
    const maxCapacityBytes = 50 * 1024 * 1024; // 50MB

    if (currentTotalSize + newDatasetSize > maxCapacityBytes) {
      const currentMb = (currentTotalSize / (1024 * 1024)).toFixed(2);
      const newMb = (newDatasetSize / (1024 * 1024)).toFixed(2);
      throw new Error(`SIZE_LIMIT_EXCEEDED: Total library capacity exceeded (Max: 50MB). Current usage: ${currentMb}MB, New file size: ${newMb}MB. Please purge old datasets.`);
    }

    const base64 = uint8ToBase64(buffer);
    const sessionId = `lib-session-${Date.now()}`;

    const sessionRecord: LibrarySession = {
      id: sessionId,
      name: sessionName.trim(),
      datasetName,
      datasetSize: newDatasetSize,
      rowCount: tableMeta.rowCount,
      columns: tableMeta.columns,
      chatHistory,
      auditLogs,
      strategicGoal,
      activeRoster,
      timestamp: new Date().toISOString(),
      createdBy: user.email,
      organizationId: user.organizationId || 'sandbox',
    };

    if (firebaseService.isFirebaseConfigured()) {
      const firestore = firebaseService.getFirestoreDb();
      if (!firestore) throw new Error('Cloud Firestore database not initialized.');

      try {
        const sessionDocRef = doc(firestore, 'users', user.uid, 'library', sessionId);
        
        // Firestore 1MB limit check: 800KB size chunks limit
        const limit800KB = 800 * 1024;
        const hasChunks = base64.length > limit800KB;

        if (hasChunks) {
          // Write metadata without full base64 string
          const metadataRecord = { ...sessionRecord, hasChunks: true };
          delete metadataRecord.datasetFileBase64;
          await setDoc(sessionDocRef, metadataRecord);

          // Slice and write chunks into subcollection
          const batch = writeBatch(firestore);
          let index = 0;
          for (let offset = 0; offset < base64.length; offset += limit800KB) {
            const chunkPayload = base64.slice(offset, offset + limit800KB);
            const chunkDocRef = doc(firestore, 'users', user.uid, 'library', sessionId, 'chunks', `chunk_${index}`);
            batch.set(chunkDocRef, { index, payload: chunkPayload });
            index++;
          }
          await batch.commit();
        } else {
          // Write directly as a single document
          await setDoc(sessionDocRef, {
            ...sessionRecord,
            datasetFileBase64: base64,
            hasChunks: false,
          });
        }

        eventBus.emit('AUDIT_LOG', {
          action: 'LIBRARY_SAVE_SUCCESS',
          details: `Analysis session '${sessionName.trim()}' successfully backed up to Cloud Firestore. Size: ${(newDatasetSize / 1024).toFixed(1)} KB.`,
          status: 'success'
        });
      } catch (err: any) {
        console.warn('[LibraryService] Firestore upload failed, writing locally to IndexedDB:', err);
        sessionRecord.datasetFileBase64 = base64;
        await this.saveLocalSession(sessionRecord);
      }
    } else {
      // Offline mode
      sessionRecord.datasetFileBase64 = base64;
      await this.saveLocalSession(sessionRecord);

      eventBus.emit('AUDIT_LOG', {
        action: 'LIBRARY_SAVE_SUCCESS',
        details: `Analysis session '${sessionName.trim()}' successfully saved to browser local database. Size: ${(newDatasetSize / 1024).toFixed(1)} KB.`,
        status: 'success'
      });
    }

    eventBus.emit('LIBRARY_SESSIONS_UPDATED');
  }

  /**
   * Delete a saved session slot.
   */
  async deleteSession(id: string): Promise<void> {
    const user = firebaseService.getCurrentUser();
    if (!user) throw new Error('No user is currently authenticated.');

    if (firebaseService.isFirebaseConfigured()) {
      const firestore = firebaseService.getFirestoreDb();
      if (!firestore) throw new Error('Cloud Firestore database not initialized.');

      try {
        const sessionDocRef = doc(firestore, 'users', user.uid, 'library', id);
        
        // Try deleting chunks subcollection first
        const chunksColRef = collection(firestore, 'users', user.uid, 'library', id, 'chunks');
        const chunkSnapshots = await getDocs(chunksColRef);
        
        const batch = writeBatch(firestore);
        chunkSnapshots.forEach((chunkDoc) => {
          batch.delete(chunkDoc.ref);
        });
        await batch.commit();

        // Delete parent metadata doc
        await deleteDoc(sessionDocRef);

        eventBus.emit('AUDIT_LOG', {
          action: 'LIBRARY_DELETE_SUCCESS',
          details: `Session slot '${id}' purged from Cloud Firestore database.`,
          status: 'success'
        });
      } catch (err) {
        console.warn('[LibraryService] Firestore delete failed, deleting locally:', err);
        await this.deleteLocalSession(id);
      }
    } else {
      // Offline mode
      await this.deleteLocalSession(id);

      eventBus.emit('AUDIT_LOG', {
        action: 'LIBRARY_DELETE_SUCCESS',
        details: `Session slot '${id}' purged from local database vault.`,
        status: 'success'
      });
    }

    eventBus.emit('LIBRARY_SESSIONS_UPDATED');
  }

  /**
   * Restores an active LibrarySession context back into memory.
   */
  async restoreSession(session: LibrarySession): Promise<void> {
    if (!session.datasetFileBase64) {
      throw new Error(`Cannot restore session '${session.name}': Missing Parquet file payload.`);
    }

    // 1. Import dataset back into DuckDB-Wasm
    const buffer = base64ToUint8(session.datasetFileBase64);
    await duckDbService.importTableFromParquet(
      session.datasetName,
      buffer,
      session.columns,
      session.rowCount
    );

    // 2. Restore chat history
    agentManager.setChatHistory(session.chatHistory || []);

    // 3. Restore compliance audit trail logs
    try {
      localStorage.setItem('datum_s_compliance_audit_logs', JSON.stringify(session.auditLogs || []));
      // Trigger a local page refresh in component context
      eventBus.emit('AUDIT_LOG', {
        action: 'LIBRARY_RESTORE_SUCCESS',
        details: `Session context '${session.name}' restored successfully. Restored ${session.chatHistory?.length || 0} chat messages.`,
        status: 'success'
      });
    } catch (err) {
      console.warn('[LibraryService] Failed to restore local audit log cache:', err);
    }

    // 4. Restore SpatialBook goal and roster COMMITTEE
    agentManager.setSpatialGoal(session.strategicGoal || 'Perform a comprehensive 360-degree descriptive metrics scan and financial compliance health audit.');
    agentManager.setSpatialRoster(session.activeRoster || ['analyst', 'growth', 'cso']);

    // 5. Force reload of DuckDB schemas in the UI
    await duckDbService.refreshAllTablesMetadata();
  }
}

export const libraryService = new LibraryService();
export default libraryService;
