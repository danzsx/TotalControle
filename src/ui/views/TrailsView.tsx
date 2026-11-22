import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  FolderInput,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useApp, useSessionTimer } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import {
  calculateContentMetrics,
  calculateDisciplineMetrics,
} from '../../domain/mastery';
import { TRAIL_TEMPLATES } from '../../domain/prebuiltTrails';
import { normalizeText } from '../../domain/text';
import type {
  ContentStatus,
  Difficulty,
  DisciplineTheme,
} from '../../domain/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContentDetailDrawer } from '../components/ContentDetailDrawer';
import { DimensionMeters } from '../components/DimensionMeters';
import { EditalImportModal } from '../components/EditalImportModal';
import { PageHeader } from '../components/ui/PageHeader';
import { TimerReadout } from '../components/ui/TimerReadout';

const STATUS_BADGE: Record<
  ContentStatus,
  { label: string; bg: string; text: string }
> = {
  nao_iniciado: { label: 'Não iniciado', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' },
  em_andamento: { label: 'Em andamento', bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]' },
  revisao: { label: 'Em revisão', bg: 'bg-[#FEF9EC]', text: 'text-[#B45309]' },
  concluido: { label: 'Concluído', bg: 'bg-[#ECFDF5]', text: 'text-[#047857]' },
};

export const TrailsView: React.FC = () => {
  const {
    exams,
    activeExam,
    disciplines,
    activeDiscipline,
    sessions,
    errors,
    activeSession,
    selectActiveDiscipline,
    addDisciplineFromTemplate,
    addDisciplinesFromTemplates,
    addCustomDiscipline,
    updateDiscipline,
    deleteDiscipline,
    addContentToModule,
    selectedContentForDrawer,
    setSelectedContentForDrawer,
    pauseActiveSession,
    resumeActiveSession,
    finishActiveSession,
    discardActiveSession,
    notify,
  } = useApp();
  const elapsedSessionMs = useSessionTimer();

  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'todos'>('todos');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showEditalModal, setShowEditalModal] = useState(false);
  const [confirmDeleteDiscId, setConfirmDeleteDiscId] = useState<string | null>(null);
  const [confirmDiscardSession, setConfirmDiscardSession] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  useEffect(() => {
    if (!showCatalogModal && !showMoveModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCatalogModal(false);
        setShowMoveModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCatalogModal, showMoveModal]);

  const existingTemplateIds = useMemo(
    () =>
      new Set(
        disciplines
          .map((d) => d.templateId)
          .filter((id): id is string => Boolean(id)),
      ),
    [disciplines],
  );
  const existingDiscNames = useMemo(
    () => new Set(disciplines.map((d) => normalizeText(d.name))),
    [disciplines],
  );
  const isTemplateAdded = (tpl: (typeof TRAIL_TEMPLATES)[number]) =>
    existingTemplateIds.has(tpl.id) || existingDiscNames.has(normalizeText(tpl.name));
  const missingTemplates = useMemo(
    () => TRAIL_TEMPLATES.filter((tpl) => !isTemplateAdded(tpl)),
    [existingTemplateIds, existingDiscNames],
  );
  const [targetExamId, setTargetExamId] = useState<string>('');
  const [includeInCycle, setIncludeInCycle] = useState(false);

  // Novo conteúdo inline
  const [addingToModule, setAddingToModule] = useState<{
    levelId: string;
    moduleId: string;
  } | null>(null);
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentDesc, setNewContentDesc] = useState('');

  // Nova disciplina personalizada
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customTheme, setCustomTheme] = useState<DisciplineTheme>('sky');
  const [customWeight, setCustomWeight] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [customDiff, setCustomDiff] = useState<Difficulty>('medium');
  const [customError, setCustomError] = useState<string | null>(null);

  const discMetrics = useMemo(() => {
    if (!activeDiscipline) return null;
    return calculateDisciplineMetrics(activeDiscipline, sessions, errors);
  }, [activeDiscipline, sessions, errors]);

  const drawerContent = useMemo(() => {
    if (!selectedContentForDrawer) return null;
    const disc = disciplines.find(
      (d) => d.id === selectedContentForDrawer.disciplineId,
    );
    if (!disc) return null;
    for (const l of disc.levels) {
      for (const m of l.modules) {
        const found = m.contents.find(
          (c) => c.id === selectedContentForDrawer.contentId,
        );
        if (found) return { discipline: disc, content: found };
      }
    }
    return null;
  }, [disciplines, selectedContentForDrawer]);

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    const res = await addCustomDiscipline({
      name: customName,
      description: customDesc,
      theme: customTheme,
      weight: customWeight,
      difficulty: customDiff,
      inCycle: includeInCycle,
    });
    if (!res.ok) {
      setCustomError(res.error);
      return;
    }
    setCustomName('');
    setCustomDesc('');
    setShowCatalogModal(false);
  };

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto pt-1">
      {/* Cabeçalho e seletor de disciplinas */}
      <PageHeader
        badge="Trilhas de Aprendizagem"
        badgeDotClassName="bg-[#7C3AED]"
        title="Mapa Estruturado de Conteúdos"
        subtitle="O que aprender, em qual sequência pedagógica e sua evolução em cada disciplina."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowEditalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F3EEFF] text-[#5B21B6] border border-[#DDD6FE] text-[13px] font-semibold hover:bg-[#EDE9FE] shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Importar Edital
            </button>
            <button
              type="button"
              onClick={() => {
                setIncludeInCycle(disciplines.some((d) => d.inCycle));
                setShowCatalogModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-[13px] font-medium hover:bg-[#1F2937] shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova disciplina / trilha
            </button>
          </div>
        }
      />

      {/* Cronômetro compacto quando estudando diretamente pela Trilha */}
      {activeSession?.origin === 'trilha' && (
        <section className="rounded-[26px] bg-[#EFF6FF]/85 border border-[#BFDBFE] shadow-[0_8px_28px_rgba(59,130,246,0.06)] p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-[#1D4ED8]">
              {activeSession.status === 'running'
                ? 'Sessão em curso pela Trilha'
                : 'Sessão pausada na Trilha'}
            </span>
            <p className="font-display text-lg font-bold text-[#111827] truncate">
              {activeSession.disciplineName}
              {activeSession.contentTitle ? ` — ${activeSession.contentTitle}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <TimerReadout
              ms={elapsedSessionMs}
              className="text-2xl font-bold text-[#111827] mr-2"
            />
            {activeSession.status === 'running' ? (
              <button
                type="button"
                onClick={pauseActiveSession}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FEF9EC] border border-[#FDE68A] text-[#92400E] text-xs font-medium hover:bg-[#FEF3C7] transition cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                Pausar
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeActiveSession}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Retomar
              </button>
            )}
            <button
              type="button"
              onClick={() => finishActiveSession()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-medium transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Concluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscardSession(true)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs text-[#DC2626] hover:bg-white/70 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Descartar
            </button>
          </div>
        </section>
      )}

      {/* Abas de disciplinas */}
      <div className="flex flex-wrap items-center gap-2">
        {disciplines.map((d) => {
          const isSelected = activeDiscipline?.id === d.id;
          const theme = DISCIPLINE_THEMES[d.theme];
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => selectActiveDiscipline(d.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[13px] font-medium border transition cursor-pointer ${
                isSelected
                  ? 'bg-white border-[#EAE9E4] text-[#111827] font-semibold shadow-[0_2px_10px_rgba(17,24,39,0.05)]'
                  : 'bg-white/55 border-transparent text-[#6B7280] hover:bg-white/90 hover:text-[#111827]'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
              {d.name}
            </button>
          );
        })}
      </div>

      {activeDiscipline && discMetrics ? (
        <>
          {/* Painel da disciplina */}
          <section className="rounded-[26px] surface-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-[#111827]">
                  {activeDiscipline.name}
                </h3>
                <p className="text-sm text-[#6B7280] mt-1">
                  {activeDiscipline.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {exams.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const other = exams.find((x) => x.id !== (activeDiscipline.examId || activeExam?.id));
                      setTargetExamId(other?.id ?? '');
                      setShowMoveModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#1D4ED8] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition cursor-pointer"
                    title="Mover esta disciplina para outro concurso"
                  >
                    <FolderInput className="w-3.5 h-3.5" />
                    Mudar de concurso
                  </button>
                )}

                {disciplines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDiscId(activeDiscipline.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover disciplina
                  </button>
                )}
              </div>
            </div>

            <DimensionMeters
              completion={discMetrics.completion}
              performance={discMetrics.performance}
              mastery={discMetrics.mastery}
            />

            {/* Filtro de status */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F3F4F6]">
              <span className="text-xs text-[#6B7280] mr-1">Filtrar:</span>
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'nao_iniciado', label: 'Não iniciados' },
                  { id: 'em_andamento', label: 'Em andamento' },
                  { id: 'revisao', label: 'Em revisão' },
                  { id: 'concluido', label: 'Concluídos' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[#111827] text-white shadow-xs'
                      : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Níveis e Conteúdos */}
          <div className="space-y-5">
            {activeDiscipline.levels.map((level) => (
              <section
                key={level.id}
                className="rounded-[26px] surface-card p-6"
              >
                <div className="mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7C3AED]">
                    {level.landscapeName || 'Etapa'}
                  </span>
                  <h4 className="font-display text-lg font-bold text-[#111827]">
                    {level.title}
                  </h4>
                  {level.subtitle && (
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {level.subtitle}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {level.modules.map((mod) => {
                    const filtered = mod.contents.filter((c) =>
                      statusFilter === 'todos' ? true : c.status === statusFilter,
                    );
                    return (
                      <div
                        key={mod.id}
                        className="rounded-2xl surface-inset p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold text-[#111827]">
                            {mod.title}
                          </h5>
                          <button
                            type="button"
                            onClick={() =>
                              setAddingToModule({
                                levelId: level.id,
                                moduleId: mod.id,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#111827] hover:text-[#4B5563] transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Adicionar conteúdo
                          </button>
                        </div>

                        {addingToModule?.moduleId === mod.id && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!newContentTitle.trim()) return;
                              await addContentToModule(
                                activeDiscipline.id,
                                level.id,
                                mod.id,
                                {
                                  title: newContentTitle,
                                  description: newContentDesc,
                                  difficulty: 2,
                                },
                              );
                              setNewContentTitle('');
                              setNewContentDesc('');
                              setAddingToModule(null);
                            }}
                            className="mb-3 p-3.5 rounded-2xl bg-white border border-[#EAE9E4] shadow-[0_4px_14px_rgba(17,24,39,0.03)] space-y-2"
                          >
                            <input
                              type="text"
                              value={newContentTitle}
                              onChange={(e) => setNewContentTitle(e.target.value)}
                              placeholder="Título do conteúdo..."
                              className="w-full px-3 py-1.5 rounded-xl text-sm input-ambient"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newContentDesc}
                              onChange={(e) => setNewContentDesc(e.target.value)}
                              placeholder="Descrição breve (opcional)..."
                              className="w-full px-3 py-1.5 rounded-xl text-xs input-ambient"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAddingToModule(null)}
                                className="px-3 py-1.5 rounded-xl text-xs text-[#6B7280] hover:bg-[#F3F4F6] cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#111827] text-white hover:bg-[#1F2937] cursor-pointer"
                              >
                                Salvar
                              </button>
                            </div>
                          </form>
                        )}

                        {filtered.length === 0 ? (
                          <p className="text-xs text-[#6B7280] py-2">
                            Nenhum conteúdo neste filtro.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {filtered.map((cnt) => {
                              const cm = calculateContentMetrics({
                                node: cnt,
                                sessions,
                                errors,
                              });
                              const badge = STATUS_BADGE[cnt.status];
                              return (
                                <button
                                  key={cnt.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedContentForDrawer({
                                      disciplineId: activeDiscipline.id,
                                      contentId: cnt.id,
                                    })
                                  }
                                  className="text-left p-3.5 rounded-2xl bg-white border border-[#EAE9E4] hover:border-[#D1D5DB] hover:shadow-[0_6px_20px_rgba(17,24,39,0.04)] transition cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {cnt.status === 'concluido' ? (
                                        <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                                      ) : cnt.status === 'revisao' ? (
                                        <RotateCcw className="w-4 h-4 text-[#D97706] shrink-0" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                                      )}
                                      <span className="text-sm font-semibold text-[#111827] truncate">
                                        {cnt.title}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.bg} ${badge.text}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>

                                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[#6B7280] tabular-nums">
                                    <span>Conclusão {cm.completion}%</span>
                                    <span>
                                      Questões{' '}
                                      {cm.performance !== null
                                        ? `${cm.performance}%`
                                        : '—'}
                                    </span>
                                    <span className="font-semibold text-[#111827]">
                                      Domínio {cm.mastery}%
                                    </span>
                                    {cm.studiedMinutes > 0 && (
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {cm.studiedMinutes}m
                                      </span>
                                    )}
                                    {cm.openErrors > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[#DC2626]">
                                        <AlertCircle className="w-3 h-3" />
                                        {cm.openErrors}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-[26px] surface-card p-10 text-center text-sm text-[#6B7280]">
          Crie ou selecione uma disciplina para visualizar sua trilha.
        </div>
      )}

      {/* Drawer de conteúdo */}
      {drawerContent && (
        <ContentDetailDrawer
          discipline={drawerContent.discipline}
          content={drawerContent.content}
          onClose={() => setSelectedContentForDrawer(null)}
        />
      )}

      {/* Modal de catálogo / nova disciplina */}
      {showCatalogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Adicionar Disciplina e Trilha"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCatalogModal(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[28px] bg-white border border-[#EAE9E4] p-6 shadow-[0_24px_60px_rgba(17,24,39,0.14)] space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#111827]">
                Adicionar Disciplina e Trilha
              </h3>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-sm text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Opção independente de ciclo */}
            <label className="flex items-center gap-2.5 p-3.5 rounded-2xl surface-inset cursor-pointer">
              <input
                type="checkbox"
                checked={includeInCycle}
                onChange={(e) => setIncludeInCycle(e.target.checked)}
                className="w-4 h-4 accent-[#111827]"
              />
              <span className="text-xs text-[#4B5563]">
                Também incluir no Ciclo de Estudos (opcional — você pode estudar só pela trilha)
              </span>
            </label>

            {/* Modelos prontos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">
                  Trilhas pré-estruturadas (Edital Analista de TI)
                </h4>
                <button
                  type="button"
                  disabled={missingTemplates.length === 0}
                  onClick={async () => {
                    if (missingTemplates.length === 0) return;
                    await addDisciplinesFromTemplates(missingTemplates, {
                      inCycle: includeInCycle,
                    });
                    setShowCatalogModal(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  {missingTemplates.length === 0
                    ? 'Todas já adicionadas'
                    : `Adicionar restantes (${missingTemplates.length})`}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TRAIL_TEMPLATES.map((tpl) => {
                  const theme = DISCIPLINE_THEMES[tpl.theme];
                  const added = isTemplateAdded(tpl);
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={added}
                      onClick={async () => {
                        if (added) return;
                        await addDisciplineFromTemplate(tpl, {
                          inCycle: includeInCycle,
                        });
                        setShowCatalogModal(false);
                      }}
                      className={`text-left p-4 rounded-2xl surface-inset transition ${
                        added
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:bg-white hover:border-[#D1D5DB] hover:shadow-[0_4px_16px_rgba(17,24,39,0.04)] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`} />
                          <span className="font-semibold text-sm text-[#111827] truncate">
                            {tpl.name}
                          </span>
                        </div>
                        {added && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857] shrink-0">
                            Adicionada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] line-clamp-2">
                        {tpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Criação personalizada */}
            <form
              onSubmit={handleCreateCustom}
              className="pt-4 border-t border-[#F3F4F6] space-y-3"
            >
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">
                Ou criar disciplina personalizada
              </h4>
              {customError && (
                <p className="text-xs text-[#DC2626]">{customError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nome da disciplina (ex.: Estatística)"
                  className="px-3.5 py-2 rounded-xl text-sm input-ambient"
                />
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Descrição breve..."
                  className="px-3.5 py-2 rounded-xl text-sm input-ambient"
                />
              </div>
              <div className={`grid ${includeInCycle ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
                <select
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value as DisciplineTheme)}
                  className="px-3 py-2 rounded-xl border border-[#EAE9E4] text-sm bg-white text-[#111827]"
                >
                  {Object.values(DISCIPLINE_THEMES).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {includeInCycle && (
                  <>
                    <select
                      value={customWeight}
                      onChange={(e) =>
                        setCustomWeight(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                      }
                      className="px-3 py-2 rounded-xl border border-[#EAE9E4] text-sm bg-white text-[#111827]"
                    >
                      {[1, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>
                          Peso no ciclo: {w}
                        </option>
                      ))}
                    </select>
                    <select
                      value={customDiff}
                      onChange={(e) => setCustomDiff(e.target.value as Difficulty)}
                      className="px-3 py-2 rounded-xl border border-[#EAE9E4] text-sm bg-white text-[#111827]"
                    >
                      <option value="easy">Dificuldade: Fácil</option>
                      <option value="medium">Dificuldade: Média</option>
                      <option value="hard">Dificuldade: Difícil</option>
                    </select>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium shadow-sm transition cursor-pointer"
                >
                  Criar disciplina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Mover Disciplina de Concurso */}
      {showMoveModal && activeDiscipline && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mudar de Concurso"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMoveModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-[28px] bg-white border border-[#EAE9E4] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                <FolderInput className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#111827]">
                  Mudar de Concurso
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Mover a disciplina <strong>{activeDiscipline.name}</strong> para outro concurso.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Selecione o concurso de destino:
              </label>
              <select
                value={targetExamId}
                onChange={(e) => setTargetExamId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm bg-white text-[#111827] focus:outline-none focus:border-[#2563EB]"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {ex.id === (activeDiscipline.examId || activeExam?.id) ? ' (Atual)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F3F4F6]">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!targetExamId || targetExamId === (activeDiscipline.examId || activeExam?.id)}
                onClick={async () => {
                  if (!targetExamId || targetExamId === (activeDiscipline.examId || activeExam?.id)) return;
                  const targetExam = exams.find((x) => x.id === targetExamId);
                  await updateDiscipline(
                    { ...activeDiscipline, examId: targetExamId },
                    `Disciplina "${activeDiscipline.name}" movida para "${targetExam?.name ?? 'outro concurso'}".`,
                  );
                  setShowMoveModal(false);
                  notify(`Disciplina "${activeDiscipline.name}" movida para "${targetExam?.name ?? 'outro concurso'}".`, 'success');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition cursor-pointer"
              >
                Confirmar mudança
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteDiscId)}
        title="Remover disciplina"
        message="Os conteúdos, sessões de estudo e erros vinculados a esta disciplina serão removidos da visualização ativa. Deseja continuar?"
        confirmLabel="Remover"
        danger
        onCancel={() => setConfirmDeleteDiscId(null)}
        onConfirm={async () => {
          if (confirmDeleteDiscId) {
            await deleteDiscipline(confirmDeleteDiscId);
          }
          setConfirmDeleteDiscId(null);
        }}
      />

      <EditalImportModal
        open={showEditalModal}
        onClose={() => setShowEditalModal(false)}
        defaultIncludeInCycle={disciplines.some((d) => d.inCycle)}
      />

      <ConfirmDialog
        open={confirmDiscardSession}
        title="Descartar sessão em andamento?"
        message="O tempo acumulado desta sessão pela Trilha será descartado e não será salvo no histórico."
        confirmLabel="Descartar"
        danger
        onCancel={() => setConfirmDiscardSession(false)}
        onConfirm={async () => {
          setConfirmDiscardSession(false);
          await discardActiveSession();
        }}
      />
    </div>
  );
};

