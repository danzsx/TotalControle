export interface SyncOutboxItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'upsert' | 'delete';
  payloadJson: string;
  createdAt: string;
}

export interface SyncStatusSummary {
  mode: 'offline' | 'cloud-ready';
  pendingChanges: number;
  lastSyncAt: string | null;
}

/**
 * Contrato preparado para sincronização futura em nuvem (ex.: Supabase/REST).
 * A operação local é 100% offline; alterações ficam registradas na tabela
 * `sync_outbox` para envio incremental quando um provedor remoto for ativado.
 */
export interface CloudSyncProvider {
  readonly name: string;
  isConfigured(): boolean;
  pushOutbox(items: SyncOutboxItem[]): Promise<{ syncedIds: string[] }>;
}

export class OfflineNoopSyncProvider implements CloudSyncProvider {
  readonly name = 'offline-local';

  isConfigured(): boolean {
    return false;
  }

  async pushOutbox(): Promise<{ syncedIds: string[] }> {
    return { syncedIds: [] };
  }
}

