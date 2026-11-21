export interface DesktopBridge {
  isDesktop: boolean;
  loadDbBytes: () => Promise<{
    ok: boolean;
    source?: 'main' | 'backup' | 'none';
    bytes?: number[] | null;
    error?: string;
  }>;
  saveDbBytes: (bytesArray: number[]) => Promise<{ ok: boolean; error?: string }>;
  quarantineDb: () => Promise<{ ok: boolean; backupBytes?: number[] | null }>;
  getDbLocation: () => Promise<{
    dir: string;
    dbPath: string;
    backupPath: string;
    exists: boolean;
    sizeBytes: number;
  }>;
  revealDataFolder: () => Promise<boolean>;
  exportTextFile: (payload: {
    defaultName: string;
    content: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  exportSqliteFile: (payload: {
    defaultName: string;
    bytesArray: number[];
  }) => Promise<{ canceled: boolean; filePath?: string }>;
}

declare global {
  interface Window {
    totalControleDesktop?: DesktopBridge;
  }
}

const IDB_NAME = 'totalcontrole_sqlite_store';
const IDB_STORE = 'db_files';
const IDB_KEY = 'main_sqlite';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const res = req.result;
      resolve(res instanceof Uint8Array ? res : null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface StorageBackend {
  isDesktop: boolean;
  loadBytes(): Promise<Uint8Array | null>;
  saveBytes(bytes: Uint8Array): Promise<void>;
  getLocationLabel(): Promise<string>;
  revealFolder(): Promise<void>;
  exportText(defaultName: string, content: string): Promise<boolean>;
  exportBinary(defaultName: string, bytes: Uint8Array): Promise<boolean>;
}

export function createStorageBackend(): StorageBackend {
  const desktop =
    typeof window !== 'undefined' ? window.totalControleDesktop : undefined;

  if (desktop?.isDesktop) {
    return {
      isDesktop: true,
      async loadBytes() {
        const res = await desktop.loadDbBytes();
        if (res.ok && res.bytes) {
          return new Uint8Array(res.bytes);
        }
        return null;
      },
      async saveBytes(bytes) {
        const res = await desktop.saveDbBytes(Array.from(bytes));
        if (!res.ok) {
          throw new Error(res.error || 'Falha ao salvar banco SQLite em disco.');
        }
      },
      async getLocationLabel() {
        const loc = await desktop.getDbLocation();
        return loc.dbPath;
      },
      async revealFolder() {
        await desktop.revealDataFolder();
      },
      async exportText(defaultName, content) {
        const res = await desktop.exportTextFile({ defaultName, content });
        return !res.canceled;
      },
      async exportBinary(defaultName, bytes) {
        const res = await desktop.exportSqliteFile({
          defaultName,
          bytesArray: Array.from(bytes),
        });
        return !res.canceled;
      },
    };
  }

  return {
    isDesktop: false,
    async loadBytes() {
      return idbGet();
    },
    async saveBytes(bytes) {
      await idbSet(bytes);
    },
    async getLocationLabel() {
      return 'IndexedDB local (navegador)';
    },
    async revealFolder() {
      // Sem pasta nativa no navegador
    },
    async exportText(defaultName, content) {
      triggerBrowserDownload(
        defaultName,
        new Blob([content], { type: 'text/plain;charset=utf-8' }),
      );
      return true;
    },
    async exportBinary(defaultName, bytes) {
      triggerBrowserDownload(
        defaultName,
        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' }),
      );
      return true;
    },
  };
}

export class MemoryStorageBackend implements StorageBackend {
  isDesktop = false;
  private bytes: Uint8Array | null = null;

  async loadBytes(): Promise<Uint8Array | null> {
    return this.bytes ? new Uint8Array(this.bytes) : null;
  }

  async saveBytes(bytes: Uint8Array): Promise<void> {
    this.bytes = new Uint8Array(bytes);
  }

  async getLocationLabel(): Promise<string> {
    return 'Memória (teste)';
  }

  async revealFolder(): Promise<void> {}
  async exportText(): Promise<boolean> {
    return true;
  }
  async exportBinary(): Promise<boolean> {
    return true;
  }
}

