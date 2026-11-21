import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { PRIORITY_LIST, SELECTABLE_ORIGINS } from '../../domain/constants';
import { flattenContents } from '../../domain/mastery';
import { errorOriginDistribution } from '../../domain/stats';
import { normalizeText } from '../../domain/text';
import type {
  DisciplineTheme,
  ErrorOrigin,
  ErrorRecord,
  PriorityLevel,
} from '../../domain/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActiveReviewPanel } from '../components/errors/ActiveReviewPanel';
import { ErrorCard } from '../components/errors/ErrorCard';
import { OriginAnalyticsPanel } from '../components/errors/OriginAnalyticsPanel';
import { RegisterErrorModal } from '../components/errors/RegisterErrorModal';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';

type ErrorSubTab = 'library' | 'review' | 'analytics';

export const ErrorsView: React.FC = () => {
  const {
    disciplines,
    activeDiscipline,
    selectActiveDiscipline,
    errorsAllDisciplines,
    setErrorsAllDisciplines,
    errors,
    errorPrefill,
    clearErrorPrefill,
    registerError,
    submitErrorReview,
    deleteError,
    openContentInTrail,
  } = useApp();

  const [subTab, setSubTab] = useState<ErrorSubTab>('library');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | 'all'>('all');
  const [filterOrigin, setFilterOrigin] = useState<ErrorOrigin | 'all'>('all');
  const [confirmDeleteErr, setConfirmDeleteErr] = useState<ErrorRecord | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [prefillTarget, setPrefillTarget] = useState<{
    disciplineId?: string;
    contentId?: string;
  } | null>(null);

  // Estado sincronizado entre o dropdown superior e a barra lateral
  const selectedDiscId = errorsAllDisciplines
    ? 'all'
    : (activeDiscipline?.id ?? 'all');

  useEffect(() => {
    if (errorPrefill?.disciplineId) {
      setPrefillTarget({
        disciplineId: errorPrefill.disciplineId,
        contentId: errorPrefill.contentId,
      });
      setRegisterModalOpen(true);
      clearErrorPrefill();
    }
  }, [errorPrefill, clearErrorPrefill]);

  const lookupMap = useMemo(() => {
    const discNames = new Map<string, string>();
    const discThemes = new Map<string, DisciplineTheme>();
    const contentTitles = new Map<string, string>();
    for (const d of disciplines) {
      discNames.set(d.id, d.name);
      discThemes.set(d.id, d.theme);
      for (const c of flattenContents(d)) {
        contentTitles.set(c.id, c.title);
      }
    }
    return { discNames, discThemes, contentTitles };
  }, [disciplines]);

  const disciplineScopedErrors = useMemo(() => {
    if (selectedDiscId === 'all') return errors;
    return errors.filter((e) => e.disciplineId === selectedDiscId);
  }, [errors, selectedDiscId]);

  const filteredErrors = useMemo(() => {
    const q = normalizeText(search);
    return disciplineScopedErrors.filter((e) => {
      if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
      if (filterOrigin !== 'all' && e.origin !== filterOrigin) return false;
      if (q) {
        const disc = lookupMap.discNames.get(e.disciplineId) ?? '';
        const cnt = lookupMap.contentTitles.get(e.contentId) ?? '';
        const hay = normalizeText(
          `${e.description} ${e.correction} ${e.prevention} ${e.referenceQuestion?.examBoard ?? ''} ${disc} ${cnt}`,
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    disciplineScopedErrors,
    filterPriority,
    filterOrigin,
    search,
    lookupMap,
  ]);

  const allPendingQueue = useMemo(() => {
    const alta = errors.filter((e) => e.priority === 'alta');
    const media = errors.filter((e) => e.priority === 'media');
    return [...alta, ...media];
  }, [errors]);

  const scopedReviewQueue = useMemo(() => {
    const alta = disciplineScopedErrors.filter((e) => e.priority === 'alta');
    const media = disciplineScopedErrors.filter((e) => e.priority === 'media');
    return [...alta, ...media];
  }, [disciplineScopedErrors]);

  const overcomeCount = useMemo(
    () => disciplineScopedErrors.filter((e) => e.priority === 'superado').length,
    [disciplineScopedErrors],
  );

  const originStats = useMemo(
    () => errorOriginDistribution(disciplineScopedErrors),
    [disciplineScopedErrors],
  );

  const handleDisciplineDropdownChange = (val: string) => {
    if (val === 'all') {
      setErrorsAllDisciplines(true);
    } else {
      setErrorsAllDisciplines(false);
      void selectActiveDiscipline(val);
    }
  };

  const openNewErrorModal = () => {
    setPrefillTarget({
      disciplineId:
        selectedDiscId !== 'all' ? selectedDiscId : disciplines[0]?.id,
    });
    setRegisterModalOpen(true);
  };

  const scopeLabel =
    selectedDiscId === 'all'
      ? 'Todas as disciplinas'
      : (activeDiscipline?.name ?? 'Disciplina selecionada');

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto pt-1">
      <PageHeader
        badge="Caderno de Erros"
        badgeDotClassName="bg-[#F472B6]"
        title="Registro, Revisão Ativa e Análise de Origens"
        subtitle="Transforme erros de questão em pontos garantidos na prova."
        actions={
          <button
            type="button"
            onClick={openNewErrorModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-[13px] font-medium hover:bg-[#1F2937] shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar erro
          </button>
        }
      />

      {/* Sub-navegação sem duplicidade com "+ Registrar erro" */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Sub-navegação do caderno de erros"
          value={subTab}
          onChange={setSubTab}
          options={[
            {
              id: 'library',
              label: `Biblioteca (${disciplineScopedErrors.length})`,
            },
            {
              id: 'review',
              label: `Revisão ativa (${scopedReviewQueue.length})`,
            },
            { id: 'analytics', label: 'Análise por origem' },
          ]}
        />

        {/* Filtro rápido de escopo sincronizado com a barra lateral */}
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span className="hidden sm:inline">Disciplina ativa:</span>
          <select
            value={selectedDiscId}
            onChange={(e) => handleDisciplineDropdownChange(e.target.value)}
            aria-label="Filtrar por disciplina"
            className="px-3 py-1.5 rounded-xl border border-[#EAE9E4] bg-white text-xs font-medium text-[#111827] cursor-pointer"
          >
            <option value="all">Todas as disciplinas</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Biblioteca */}
      {subTab === 'library' && (
        <div className="space-y-4">
          <div className="rounded-[24px] surface-card p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar enunciado, banca, correção..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm input-ambient"
                />
              </div>
              <select
                value={filterPriority}
                onChange={(e) =>
                  setFilterPriority(e.target.value as PriorityLevel | 'all')
                }
                aria-label="Filtrar por prioridade"
                className="px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                <option value="all">Todas as prioridades</option>
                {PRIORITY_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={filterOrigin}
                onChange={(e) =>
                  setFilterOrigin(e.target.value as ErrorOrigin | 'all')
                }
                aria-label="Filtrar por origem"
                className="px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                <option value="all">Todas as origens</option>
                {SELECTABLE_ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280] pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                Alterações de prioridade são salvas automaticamente
              </span>
              {selectedDiscId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setErrorsAllDisciplines(true)}
                  className="text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:underline cursor-pointer"
                >
                  Mostrar todas as disciplinas ({errors.length})
                </button>
              )}
            </div>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="rounded-[26px] surface-card p-10 text-center space-y-3">
              <p className="text-sm text-[#6B7280]">
                {disciplineScopedErrors.length === 0 && selectedDiscId !== 'all'
                  ? `Nenhum erro registrado em ${scopeLabel}.`
                  : 'Nenhum erro encontrado com os filtros selecionados.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {selectedDiscId !== 'all' && errors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setErrorsAllDisciplines(true)}
                    className="px-4 py-2 rounded-xl border border-[#EAE9E4] bg-white text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] transition cursor-pointer"
                  >
                    Ver erros de todas as disciplinas
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewErrorModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar erro
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredErrors.map((err) => (
                <ErrorCard
                  key={err.id}
                  error={err}
                  disciplineName={
                    lookupMap.discNames.get(err.disciplineId) ?? 'Disciplina'
                  }
                  disciplineTheme={
                    lookupMap.discThemes.get(err.disciplineId) ?? 'sky'
                  }
                  contentTitle={
                    lookupMap.contentTitles.get(err.contentId) ?? 'Conteúdo'
                  }
                  isRevealed={Boolean(revealedIds[err.id])}
                  onToggleReveal={() =>
                    setRevealedIds((prev) => ({
                      ...prev,
                      [err.id]: !prev[err.id],
                    }))
                  }
                  onOpenInTrail={() =>
                    openContentInTrail(err.disciplineId, err.contentId)
                  }
                  onChangePriority={(nextPriority) =>
                    submitErrorReview(err, nextPriority, 'alteracao_rapida')
                  }
                  onRequestDelete={() => setConfirmDeleteErr(err)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revisão Ativa */}
      {subTab === 'review' && (
        <ActiveReviewPanel
          scopedQueue={scopedReviewQueue}
          allPendingQueue={allPendingQueue}
          totalErrorsCount={disciplineScopedErrors.length}
          overcomeCount={overcomeCount}
          isScopedByDiscipline={selectedDiscId !== 'all'}
          activeDisciplineName={activeDiscipline?.name}
          onShowAllDisciplines={() => setErrorsAllDisciplines(true)}
          onGoToLibrary={() => setSubTab('library')}
          onOpenRegister={openNewErrorModal}
          lookupMap={lookupMap}
          onOpenContentInTrail={openContentInTrail}
          onSubmitReview={(error, nextPriority) =>
            submitErrorReview(error, nextPriority, 'revisao_2_ciclo')
          }
          isModalOpen={registerModalOpen || Boolean(confirmDeleteErr)}
        />
      )}

      {/* Análise por Origem */}
      {subTab === 'analytics' && (
        <OriginAnalyticsPanel
          originStats={originStats}
          totalErrors={disciplineScopedErrors.length}
          scopeLabel={scopeLabel}
        />
      )}

      <RegisterErrorModal
        open={registerModalOpen}
        disciplines={disciplines}
        initialDisciplineId={prefillTarget?.disciplineId}
        initialContentId={prefillTarget?.contentId}
        onClose={() => setRegisterModalOpen(false)}
        onSubmit={registerError}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteErr)}
        title="Excluir registro de erro"
        message="Este registro e seu histórico de revisões serão removidos da biblioteca ativa."
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmDeleteErr(null)}
        onConfirm={async () => {
          if (confirmDeleteErr) await deleteError(confirmDeleteErr);
          setConfirmDeleteErr(null);
        }}
      />
    </div>
  );
};
