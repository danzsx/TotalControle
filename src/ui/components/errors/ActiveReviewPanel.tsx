import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flame,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  DISCIPLINE_THEMES,
  ORIGINS,
  PRIORITIES,
} from '../../../domain/constants';
import type {
  DisciplineTheme,
  ErrorRecord,
  PriorityLevel,
} from '../../../domain/types';
import {
  ORIGIN_REVIEW_TIPS,
  formatRelativeErrorAge,
  parseErrorDescription,
} from './errorHelpers';

interface ActiveReviewPanelProps {
  /** Erros pendentes (alta + media) já ordenados */
  scopedQueue: ErrorRecord[];
  /** Todos os erros pendentes do caderno (para alternar escopo rapidamente) */
  allPendingQueue: ErrorRecord[];
  totalErrorsCount: number;
  overcomeCount: number;
  isScopedByDiscipline: boolean;
  activeDisciplineName?: string;
  onShowAllDisciplines: () => void;
  onGoToLibrary: () => void;
  onOpenRegister: () => void;
  lookupMap: {
    discNames: Map<string, string>;
    discThemes: Map<string, DisciplineTheme>;
    contentTitles: Map<string, string>;
  };
  onOpenContentInTrail: (disciplineId: string, contentId: string) => void;
  onSubmitReview: (
    error: ErrorRecord,
    newPriority: PriorityLevel,
  ) => Promise<void>;
  isModalOpen?: boolean;
}

function formatRecallSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ActiveReviewPanel: React.FC<ActiveReviewPanelProps> = ({
  scopedQueue,
  allPendingQueue,
  totalErrorsCount,
  overcomeCount,
  isScopedByDiscipline,
  activeDisciplineName,
  onShowAllDisciplines,
  onGoToLibrary,
  onOpenRegister,
  lookupMap,
  onOpenContentInTrail,
  onSubmitReview,
  isModalOpen = false,
}) => {
  const [revealCorrection, setRevealCorrection] = useState(false);
  const [deferredOrder, setDeferredOrder] = useState<string[]>([]);
  const [recallSeconds, setRecallSeconds] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionOvercome, setSessionOvercome] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [evolutionBanner, setEvolutionBanner] = useState<{
    message: string;
    tone: 'success' | 'neutral';
  } | null>(null);

  const orderedQueue = useMemo(() => {
    if (deferredOrder.length === 0) return scopedQueue;
    const deferredSet = new Set(deferredOrder);
    const front = scopedQueue.filter((e) => !deferredSet.has(e.id));
    const back = deferredOrder
      .map((id) => scopedQueue.find((e) => e.id === id))
      .filter((e): e is ErrorRecord => Boolean(e));
    return [...front, ...back];
  }, [scopedQueue, deferredOrder]);

  const currentItem = orderedQueue[0] ?? null;

  // Reinicia cronômetro de evocação ao trocar de card
  useEffect(() => {
    setRecallSeconds(0);
    setRevealCorrection(false);
  }, [currentItem?.id]);

  useEffect(() => {
    if (!currentItem || revealCorrection) return;
    const interval = setInterval(() => {
      setRecallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentItem, revealCorrection]);

  const handleClassify = useCallback(
    async (nextPriority: PriorityLevel) => {
      if (!currentItem || submitting) return;
      setSubmitting(true);
      try {
        await onSubmitReview(currentItem, nextPriority);
        setSessionReviewed((prev) => prev + 1);
        setDeferredOrder((prev) => prev.filter((id) => id !== currentItem.id));

        const remainingAfter =
          nextPriority === 'superado'
            ? Math.max(0, orderedQueue.length - 1)
            : orderedQueue.length;

        if (nextPriority === 'superado') {
          setSessionOvercome((prev) => prev + 1);
          setEvolutionBanner({
            message:
              remainingAfter === 0
                ? 'Ponto dominado! Fila pendente zerada.'
                : `Ponto dominado! Restam ${remainingAfter} ${remainingAfter === 1 ? 'pendente' : 'pendentes'} nesta fila.`,
            tone: 'success',
          });
        } else if (nextPriority === 'media') {
          setEvolutionBanner({
            message:
              'Movido para Prioridade Média — volta na próxima rodada de consolidação.',
            tone: 'neutral',
          });
        } else {
          setEvolutionBanner({
            message:
              'Mantido em Prioridade Alta — vai seguir no topo para reforço rápido.',
            tone: 'neutral',
          });
        }
        setRevealCorrection(false);
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem, orderedQueue.length, onSubmitReview, submitting],
  );

  const handleSkip = useCallback(() => {
    if (!currentItem || orderedQueue.length <= 1) return;
    setDeferredOrder((prev) => [
      ...prev.filter((id) => id !== currentItem.id),
      currentItem.id,
    ]);
    setRevealCorrection(false);
  }, [currentItem, orderedQueue.length]);

  // Atalhos de teclado: Espaço para revelar, 1/2/3 para classificar
  useEffect(() => {
    if (isModalOpen || !currentItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!revealCorrection && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealCorrection(true);
        return;
      }

      if (revealCorrection) {
        if (e.key === '1') {
          e.preventDefault();
          void handleClassify('alta');
        } else if (e.key === '2') {
          e.preventDefault();
          void handleClassify('media');
        } else if (e.key === '3') {
          e.preventDefault();
          void handleClassify('superado');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentItem, handleClassify, isModalOpen, revealCorrection]);

  const highCount = scopedQueue.filter((e) => e.priority === 'alta').length;
  const mediumCount = scopedQueue.filter((e) => e.priority === 'media').length;
  const masteryRate =
    totalErrorsCount > 0
      ? Math.round((overcomeCount / totalErrorsCount) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Barra de progresso e evolução da revisão ativa */}
      <div className="rounded-[24px] surface-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Fila pendente
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-xl font-bold text-[#111827] tabular-nums">
                {orderedQueue.length}
              </span>
              <span className="text-xs text-[#6B7280]">
                ({highCount} alta · {mediumCount} média)
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-[#EAE9E4] hidden sm:block" />

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Evolução no caderno
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-sm font-semibold text-[#111827] tabular-nums">
                {overcomeCount}/{totalErrorsCount} superados ({masteryRate}%)
              </span>
            </div>
          </div>

          {sessionReviewed > 0 && (
            <>
              <div className="h-8 w-px bg-[#EAE9E4] hidden md:block" />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-medium text-[#047857] tabular-nums">
                <Flame className="w-3.5 h-3.5" />
                Nesta sessão: {sessionReviewed}{' '}
                {sessionReviewed === 1 ? 'revisado' : 'revisados'}
                {sessionOvercome > 0 ? ` · ${sessionOvercome} superado(s)` : ''}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isScopedByDiscipline && activeDisciplineName && (
            <button
              type="button"
              onClick={onShowAllDisciplines}
              className="text-xs font-medium px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] transition cursor-pointer"
            >
              Ver todas pendentes ({allPendingQueue.length})
            </button>
          )}
        </div>
      </div>

      {/* Feedback de evolução pós-ação */}
      {evolutionBanner && (
        <div
          className={`rounded-2xl px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-2 border ${
            evolutionBanner.tone === 'success'
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
              : 'bg-[#FAFAF9] border-[#EAE9E4] text-[#4B5563]'
          }`}
        >
          <span>{evolutionBanner.message}</span>
          <button
            type="button"
            onClick={() => setEvolutionBanner(null)}
            className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Card principal de evocação ativa */}
      <section className="rounded-[26px] surface-card p-6 md:p-8">
        {!currentItem ? (
          <div className="text-center py-8 max-w-md mx-auto space-y-3">
            <CheckCircle2 className="w-11 h-11 text-[#10B981] mx-auto" />
            <h3 className="font-display text-xl font-bold text-[#111827]">
              {isScopedByDiscipline && allPendingQueue.length > 0
                ? `Tudo em dia em ${activeDisciplineName}`
                : 'Fila de revisão ativa concluída'}
            </h3>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {isScopedByDiscipline && allPendingQueue.length > 0
                ? `Você zerou os erros pendentes desta disciplina. Ainda há ${allPendingQueue.length} pendente(s) em outras matérias.`
                : totalErrorsCount === 0
                  ? 'Registre os erros das suas baterias de questões para treinar recuperação ativa aqui.'
                  : 'Todos os registros desta fila estão marcados como superados.'}
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              {isScopedByDiscipline && allPendingQueue.length > 0 && (
                <button
                  type="button"
                  onClick={onShowAllDisciplines}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition cursor-pointer"
                >
                  Revisar outras disciplinas ({allPendingQueue.length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {totalErrorsCount === 0 ? (
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-4 py-2 rounded-xl bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition cursor-pointer"
                >
                  Registrar primeiro erro
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoToLibrary}
                  className="px-4 py-2 rounded-xl border border-[#EAE9E4] bg-white text-[#374151] text-xs font-medium hover:bg-[#F9FAFB] transition cursor-pointer"
                >
                  Voltar à Biblioteca
                </button>
              )}
            </div>
          </div>
        ) : (
          (() => {
            const parsed = parseErrorDescription(currentItem.description);
            const discName =
              lookupMap.discNames.get(currentItem.disciplineId) ??
              'Disciplina';
            const discTheme =
              lookupMap.discThemes.get(currentItem.disciplineId) ?? 'sky';
            const theme = DISCIPLINE_THEMES[discTheme];
            const contentTitle =
              lookupMap.contentTitles.get(currentItem.contentId) ??
              'Conteúdo';
            const orig = ORIGINS[currentItem.origin];
            const prio = PRIORITIES[currentItem.priority];
            const ageLabel = formatRelativeErrorAge(
              currentItem.registrationDate,
              currentItem.createdAt,
            );

            return (
              <div className="max-w-2xl mx-auto space-y-5">
                {/* Metadados do card */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`}
                    />
                    <span className="font-semibold text-[#111827]">
                      {discName}
                    </span>
                    <span className="text-[#9CA3AF]">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenContentInTrail(
                          currentItem.disciplineId,
                          currentItem.contentId,
                        )
                      }
                      className="text-[#4B5563] hover:text-[#111827] hover:underline truncate max-w-[260px] cursor-pointer"
                    >
                      {contentTitle}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-medium ${orig.badgeBg} ${orig.badgeText}`}
                    >
                      {orig.label}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-medium ${prio.badgeBg} ${prio.badgeText}`}
                    >
                      {prio.label}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium tabular-nums"
                      title="Tempo de evocação neste card"
                    >
                      <Clock className="w-3 h-3 text-[#6B7280]" />
                      {formatRecallSeconds(recallSeconds)}
                    </span>
                  </div>
                </div>

                {/* Conexão com origem do erro e histórico temporal */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#F7F7F5] border border-[#EAE9E4] text-xs text-[#4B5563]">
                  <span>
                    <strong className="text-[#111827]">Foco na prova:</strong>{' '}
                    {ORIGIN_REVIEW_TIPS[currentItem.origin]}
                  </span>
                  <span className="text-[11px] text-[#6B7280] tabular-nums shrink-0">
                    Registrado {ageLabel} · {currentItem.reviewHistory.length}{' '}
                    {currentItem.reviewHistory.length === 1
                      ? 'revisão'
                      : 'revisões'}
                    {currentItem.referenceQuestion?.examBoard
                      ? ` · ${currentItem.referenceQuestion.examBoard}`
                      : ''}
                  </span>
                </div>

                {/* Enunciado / Bloco de evocação */}
                <div className="p-5 rounded-2xl surface-inset space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      Pense na regra ou pegadinha antes de abrir
                    </p>
                    {currentItem.referenceQuestion?.examBoard && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4B5563]">
                        <FileText className="w-3 h-3 text-[#9CA3AF]" />
                        {currentItem.referenceQuestion.examBoard}
                      </span>
                    )}
                  </div>

                  <p className="text-base text-[#111827] leading-relaxed whitespace-pre-wrap">
                    {parsed.statement}
                  </p>

                  {parsed.bottleneck && (
                    <div className="pt-2.5 border-t border-[#EAE9E4] text-xs text-[#4B5563] flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#92400E]">Gargalo:</strong>{' '}
                        {parsed.bottleneck}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ação de revelar ou classificar */}
                {!revealCorrection ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRevealCorrection(true)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] shadow-sm transition cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      Ver gabarito e fundamento
                      <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 text-white/90">
                        Espaço
                      </kbd>
                    </button>
                    {orderedQueue.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSkip}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#EAE9E4] bg-white text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition cursor-pointer"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        Pular por agora
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="p-5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#047857]">
                        Fundamento correto
                      </p>
                      <p className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">
                        {currentItem.correction}
                      </p>
                      {currentItem.prevention && (
                        <div className="pt-2.5 border-t border-[#A7F3D0] text-xs text-[#065F46] flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#059669]" />
                          <span>
                            <strong>Como evitar na prova:</strong>{' '}
                            {currentItem.prevention}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-center text-[11.5px] font-medium text-[#6B7280]">
                        Como foi sua evocação?
                      </p>
                      <div className="flex flex-wrap justify-center gap-2.5">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleClassify('alta')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEE2E2] text-[#B91C1C] text-sm font-medium hover:bg-[#FECACA] disabled:opacity-60 transition cursor-pointer"
                        >
                          <span>Errei de novo · Manter Alta</span>
                          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#B91C1C]/10">
                            1
                          </kbd>
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleClassify('media')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEF9EC] border border-[#FDE68A] text-[#B45309] text-sm font-medium hover:bg-[#FEF3C7] disabled:opacity-60 transition cursor-pointer"
                        >
                          <span>Com dúvida · Mover p/ Média</span>
                          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#B45309]/10">
                            2
                          </kbd>
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleClassify('superado')}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium shadow-sm disabled:opacity-60 transition cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Dominei · Marcar Superado</span>
                          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/20 text-white">
                            3
                          </kbd>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </section>
    </div>
  );
};
