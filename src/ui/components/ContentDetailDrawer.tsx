import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { formatMinutes } from '../../domain/explain';
import { calculateContentMetrics } from '../../domain/mastery';
import { formatDateTimeBR, uid } from '../../domain/text';
import type { ContentNode, ContentStatus, Discipline } from '../../domain/types';
import { DimensionMeters } from './DimensionMeters';
import { TimerReadout } from './ui/TimerReadout';

interface ContentDetailDrawerProps {
  discipline: Discipline;
  content: ContentNode;
  onClose: () => void;
}

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'revisao', label: 'Em revisão' },
  { value: 'concluido', label: 'Concluído' },
];

export const ContentDetailDrawer: React.FC<ContentDetailDrawerProps> = ({
  discipline,
  content,
  onClose,
}) => {
  const {
    sessions,
    errors,
    activeSession,
    elapsedSessionMs,
    cycleState,
    updateContentNode,
    deleteContentNode,
    openRegisterErrorForContent,
    startTrailSessionForContent,
    startCycleSessionForContent,
    pauseActiveSession,
    resumeActiveSession,
    finishActiveSession,
  } = useApp();

  const isStudyingThisContent = activeSession?.contentId === content.id;
  const nextCycleBlock = cycleState.plan?.blocks[cycleState.position] ?? null;
  const matchesNextCycleBlock =
    !activeSession && nextCycleBlock?.disciplineId === discipline.id;

  const metrics = calculateContentMetrics({
    node: content,
    sessions,
    errors,
  });

  const linkedErrors = errors.filter(
    (e) => e.contentId === content.id && !e.deletedAt,
  );
  const linkedSessions = sessions.filter((s) => s.contentId === content.id);

  const handleStatusChange = async (nextStatus: ContentStatus) => {
    const now = new Date().toISOString();
    const updated: ContentNode = {
      ...content,
      status: nextStatus,
      completedAt:
        nextStatus === 'concluido' ? (content.completedAt ?? now) : null,
      lastStudiedAt: now,
      markedForReview: nextStatus === 'revisao' ? true : content.markedForReview,
      history: [
        {
          id: uid('hist'),
          date: now,
          action: `Status alterado para "${STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label}"`,
        },
        ...content.history,
      ],
    };
    await updateContentNode(
      discipline.id,
      updated,
      `Status de "${content.title}" alterado.`,
    );
  };

  const handleToggleChecklist = async (itemId: string) => {
    const now = new Date().toISOString();
    const nextChecklist = content.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    const nextStatus =
      content.status === 'nao_iniciado' && nextChecklist.some((i) => i.done)
        ? 'em_andamento'
        : content.status;

    await updateContentNode(discipline.id, {
      ...content,
      status: nextStatus,
      checklist: nextChecklist,
      lastStudiedAt: now,
    });
  };

  const handleExerciseChange = async (
    field: 'exercisesDone' | 'exercisesCorrect',
    value: number,
  ) => {
    const safeVal = Math.max(0, Math.round(value));
    const nextDone =
      field === 'exercisesDone'
        ? safeVal
        : Math.max(content.exercisesDone, safeVal);
    const nextCorrect =
      field === 'exercisesCorrect'
        ? Math.min(safeVal, nextDone)
        : Math.min(content.exercisesCorrect, nextDone);

    const now = new Date().toISOString();
    await updateContentNode(
      discipline.id,
      {
        ...content,
        status:
          content.status === 'nao_iniciado' && nextDone > 0
            ? 'em_andamento'
            : content.status,
        exercisesDone: nextDone,
        exercisesCorrect: nextCorrect,
        lastStudiedAt: now,
      },
      `Questões atualizadas em "${content.title}" (${nextCorrect}/${nextDone}).`,
    );
  };

  const handleCompleteReview = async () => {
    const now = new Date().toISOString();
    await updateContentNode(
      discipline.id,
      {
        ...content,
        status: 'concluido',
        markedForReview: false,
        reviewCount: content.reviewCount + 1,
        lastStudiedAt: now,
        completedAt: content.completedAt ?? now,
        history: [
          {
            id: uid('hist'),
            date: now,
            action: `Revisão #${content.reviewCount + 1} concluída`,
          },
          ...content.history,
        ],
      },
      `Revisão concluída em "${content.title}".`,
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#111827]/25 backdrop-blur-xs">
      <div className="w-full max-w-xl h-full bg-white border-l border-[#EAE9E4] shadow-[0_20px_60px_rgba(17,24,39,0.12)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
              <span className="font-semibold text-[#111827]">{discipline.name}</span>
              {content.editalRef && (
                <span className="font-mono px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[11px] text-[#4B5563]">
                  {content.editalRef}
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-[#111827]">
              {content.title}
            </h2>
            {content.description && (
              <p className="mt-1 text-sm text-[#6B7280]">{content.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
            aria-label="Fechar detalhes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métricas separadas */}
          <DimensionMeters
            completion={metrics.completion}
            performance={metrics.performance}
            mastery={metrics.mastery}
            compact
          />

          {/* Sessão em andamento neste conteúdo */}
          {isStudyingThisContent && activeSession && (
            <div className="p-4 rounded-2xl bg-[#EFF6FF]/85 border border-[#BFDBFE] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-[#1D4ED8] mb-0.5">
                  {activeSession.origin === 'trilha'
                    ? 'Sessão pela Trilha'
                    : `Sessão no Ciclo #${activeSession.cycleNumber}`}{' '}
                  · {activeSession.status === 'running' ? 'Em andamento' : 'Pausada'}
                </p>
                <TimerReadout
                  ms={elapsedSessionMs}
                  className="text-2xl font-bold text-[#111827]"
                />
              </div>
              <div className="flex items-center gap-2">
                {activeSession.status === 'running' ? (
                  <button
                    type="button"
                    onClick={pauseActiveSession}
                    className="px-3 py-1.5 rounded-xl bg-[#FEF9EC] border border-[#FDE68A] text-[#92400E] text-xs font-medium hover:bg-[#FEF3C7] transition cursor-pointer"
                  >
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeActiveSession}
                    className="px-3 py-1.5 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-medium transition cursor-pointer"
                  >
                    Retomar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => finishActiveSession()}
                  className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-medium transition cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          {/* Ações integradas entre módulos */}
          <div className="flex flex-wrap gap-2.5">
            {!isStudyingThisContent && (
              <button
                type="button"
                onClick={() =>
                  startTrailSessionForContent(discipline.id, content.id)
                }
                disabled={Boolean(activeSession)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] disabled:opacity-45 shadow-sm transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Estudar conteúdo
              </button>
            )}
            {matchesNextCycleBlock && (
              <button
                type="button"
                onClick={() =>
                  startCycleSessionForContent(discipline.id, content.id)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F3F4F6] text-[#111827] text-sm font-medium hover:bg-[#E5E7EB] transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Usar no bloco do ciclo
              </button>
            )}
            <button
              type="button"
              onClick={() => openRegisterErrorForContent(discipline.id, content.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FEF9EC] border border-[#FDE68A]/80 text-[#92400E] text-sm font-medium hover:bg-[#FEF3C7] transition cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              Registrar erro
            </button>
            {(content.status === 'revisao' || content.markedForReview) && (
              <button
                type="button"
                onClick={handleCompleteReview}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-sm font-medium hover:bg-[#D1FAE5] transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Concluir revisão
              </button>
            )}
          </div>

          {/* Relacionamentos resumidos */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]">
              <div className="flex items-center justify-center gap-1 text-xs text-[#6B7280]">
                <Clock className="w-3.5 h-3.5" />
                Tempo estudado
              </div>
              <p className="mt-1 font-display text-base font-bold text-[#111827] tabular-nums">
                {formatMinutes(metrics.studiedMinutes)}
              </p>
              <p className="text-[11px] text-[#6B7280]">
                {linkedSessions.length}{' '}
                {linkedSessions.length === 1 ? 'sessão' : 'sessões'}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]">
              <div className="flex items-center justify-center gap-1 text-xs text-[#6B7280]">
                <AlertCircle className="w-3.5 h-3.5" />
                Erros vinculados
              </div>
              <p className="mt-1 font-display text-base font-bold text-[#111827] tabular-nums">
                {linkedErrors.length}
              </p>
              <p className="text-[11px] text-[#6B7280]">
                {metrics.openErrors} abertos
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]">
              <div className="flex items-center justify-center gap-1 text-xs text-[#6B7280]">
                <RotateCcw className="w-3.5 h-3.5" />
                Revisões
              </div>
              <p className="mt-1 font-display text-base font-bold text-[#111827] tabular-nums">
                {content.reviewCount}
              </p>
              <p className="text-[11px] text-[#6B7280]">realizadas</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2">
              Status de conclusão
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    content.status === opt.value
                      ? 'bg-[#111827] text-white border-[#111827] shadow-sm'
                      : 'bg-white text-[#4B5563] border-[#EAE9E4] hover:bg-[#FAFAF9]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2.5">
              Etapas de estudo
            </h3>
            <div className="space-y-2">
              {content.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4] cursor-pointer hover:bg-white transition"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklist(item.id)}
                    className="w-4 h-4 accent-[#111827] rounded"
                  />
                  <span
                    className={`text-sm ${
                      item.done
                        ? 'line-through text-[#9CA3AF]'
                        : 'text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Desempenho em questões */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2.5">
              Desempenho em questões
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]">
                <label className="block text-xs text-[#6B7280] mb-1">
                  Questões resolvidas
                </label>
                <input
                  type="number"
                  min={0}
                  value={content.exercisesDone}
                  onChange={(e) =>
                    handleExerciseChange('exercisesDone', Number(e.target.value))
                  }
                  className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3 py-1.5 text-sm font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#9CA3AF]"
                />
              </div>
              <div className="p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]">
                <label className="block text-xs text-[#6B7280] mb-1">
                  Acertos
                </label>
                <input
                  type="number"
                  min={0}
                  max={content.exercisesDone}
                  value={content.exercisesCorrect}
                  onChange={(e) =>
                    handleExerciseChange('exercisesCorrect', Number(e.target.value))
                  }
                  className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3 py-1.5 text-sm font-medium text-[#111827] tabular-nums focus:outline-none focus:border-[#9CA3AF]"
                />
              </div>
            </div>
          </div>

          {/* Anotações e pontos de atenção */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5">
                Síntese e anotações
              </label>
              <textarea
                rows={3}
                value={content.notes}
                onChange={(e) =>
                  updateContentNode(discipline.id, {
                    ...content,
                    notes: e.target.value,
                  })
                }
                placeholder="Registre os pontos centrais deste conteúdo..."
                className="w-full rounded-2xl p-3 text-sm input-ambient"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5">
                Dificuldades percebidas
              </label>
              <textarea
                rows={2}
                value={content.difficulties}
                onChange={(e) =>
                  updateContentNode(discipline.id, {
                    ...content,
                    difficulties: e.target.value,
                  })
                }
                placeholder="O que ainda gera dúvida ou exige atenção?"
                className="w-full rounded-2xl p-3 text-sm input-ambient"
              />
            </div>
          </div>

          {/* Histórico do conteúdo */}
          {content.history.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2">
                Histórico deste conteúdo
              </h3>
              <div className="space-y-2">
                {content.history.slice(0, 6).map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 text-xs p-3 rounded-xl bg-[#FAFAF9] border border-[#EAE9E4]/70"
                  >
                    <div>
                      <p className="font-medium text-[#111827]">{h.action}</p>
                      {h.detail && (
                        <p className="text-[#6B7280] mt-0.5">{h.detail}</p>
                      )}
                    </div>
                    <span className="text-[#9CA3AF] shrink-0 tabular-nums">
                      {formatDateTimeBR(h.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-[#F3F4F6] bg-[#FAFAF9] flex items-center justify-between">
          <button
            type="button"
            onClick={async () => {
              await deleteContentNode(discipline.id, content);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover conteúdo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition cursor-pointer"
          >
            Concluir edição
          </button>
        </div>
      </div>
    </div>
  );
};

