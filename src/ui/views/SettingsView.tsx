import React, { useRef, useState } from 'react';
import {
  CloudOff,
  Database,
  Download,
  FolderOpen,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';

export const SettingsView: React.FC = () => {
  const {
    meta,
    dbLocationLabel,
    isDesktop,
    syncSummary,
    updateUserName,
    exportJsonBackup,
    exportSqliteBackup,
    restoreBackupJson,
    revealDataFolder,
    resetAllData,
    notify,
  } = useApp();

  const [nameInput, setNameInput] = useState(meta.userName);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await restoreBackupJson(text, restoreMode);
    if (!res.ok) {
      notify(res.error, 'error');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-1">
      <PageHeader
        badge="Configurações"
        badgeDotClassName="bg-[#10B981]"
        title="Perfil, Banco Local, Backup e Sincronização"
        subtitle="Gerencie suas preferências, arquivos locais e cópias de segurança."
      />

      {/* Perfil */}
      <section className="rounded-[26px] surface-card p-6 space-y-3">
        <h3 className="font-display text-base font-semibold text-[#111827]">
          Perfil de Estudo
        </h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await updateUserName(nameInput);
          }}
          className="flex flex-wrap gap-3"
        >
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Seu nome"
            className="flex-1 min-w-52 px-3.5 py-2 rounded-xl text-sm input-ambient"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium shadow-sm transition cursor-pointer"
          >
            Salvar nome
          </button>
        </form>
      </section>

      {/* Banco SQLite Compartilhado */}
      <section className="rounded-[26px] surface-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#38BDF8]" />
            <div>
              <h3 className="font-display text-base font-semibold text-[#111827]">
                Banco de Dados Compartilhado (SQLite Offline)
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Todos os módulos compartilham o mesmo arquivo relacional com rotação automática de backup.
              </p>
            </div>
          </div>
          {isDesktop && (
            <button
              type="button"
              onClick={revealDataFolder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111827] hover:bg-[#E5E7EB] transition cursor-pointer shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Abrir pasta
            </button>
          )}
        </div>

        <div className="p-3.5 rounded-2xl surface-inset font-mono text-xs text-[#4B5563] break-all">
          {dbLocationLabel || 'Carregando caminho...'}
        </div>
      </section>

      {/* Backup e Restauração */}
      <section className="rounded-[26px] surface-card p-6 space-y-4">
        <h3 className="font-display text-base font-semibold text-[#111827]">
          Backup e Restauração
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportJsonBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar Backup (.json)
          </button>
          <button
            type="button"
            onClick={exportSqliteBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-[#111827] text-sm font-medium hover:bg-[#E5E7EB] transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar Banco (.sqlite)
          </button>
        </div>

        <div className="pt-4 border-t border-[#F3F4F6] flex flex-wrap items-center gap-3">
          <select
            value={restoreMode}
            onChange={(e) =>
              setRestoreMode(e.target.value as 'merge' | 'replace')
            }
            className="px-3 py-2 rounded-xl border border-[#EAE9E4] text-sm bg-white text-[#111827]"
          >
            <option value="merge">Mesclar com dados atuais</option>
            <option value="replace">Substituir tudo pelo backup</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm font-medium text-[#111827] hover:bg-[#FAFAF9] shadow-[0_2px_8px_rgba(17,24,39,0.03)] transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importar Backup (.json)
          </button>
        </div>
      </section>

      {/* Arquitetura preparada para nuvem */}
      <section className="rounded-[26px] surface-card p-6 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-[#6B7280]" />
            <h3 className="font-display text-base font-semibold text-[#111827]">
              Sincronização em Nuvem (Preparada)
            </h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium">
            Modo 100% Offline
          </span>
        </div>
        <p className="text-xs text-[#6B7280] leading-relaxed">
          Dispositivo ID <span className="font-mono text-[#111827]">{meta.deviceId}</span> ·{' '}
          {syncSummary.pendingChanges} alterações locais registradas na fila{' '}
          <span className="font-mono text-[#111827]">sync_outbox</span> para futura sincronização incremental.
        </p>
      </section>

      {/* Reset */}
      <section className="rounded-[26px] bg-white/95 border border-[#FECACA] shadow-[0_8px_30px_rgba(220,38,38,0.04)] p-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#B91C1C]">
            Restaurar estado inicial
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Apaga todas as sessões, erros e trilhas personalizadas, retornando ao padrão inicial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEF2F2] text-[#DC2626] text-sm font-medium hover:bg-[#FEE2E2] transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </button>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Restaurar estado inicial"
        message="Esta ação removerá permanentemente todas as trilhas, sessões e erros salvos neste dispositivo. Exporte um backup antes de continuar."
        confirmLabel="Sim, restaurar"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetAllData();
          setConfirmReset(false);
        }}
      />
    </div>
  );
};
