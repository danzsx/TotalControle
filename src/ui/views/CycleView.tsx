import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  ListOrdered,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { useApp, useSessionTimer } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import {
  explainAllocation,
  formatClock,
  formatMinutes,
} from '../../domain/explain';
import { flattenContents } from '../../domain/mastery';
import type { CycleSettings, Difficulty, DisciplineTheme } from '../../domain/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { TimerReadout } from '../components/ui/TimerReadout';

type RGB = [number, number, number];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    lerpChannel(a[0], b[0], t),
    lerpChannel(a[1], b[1], t),
    lerpChannel(a[2], b[2], t),
  ];
}

function rgbCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Interpolação inteligente de cor pelo progresso da sessão:
 * - 0% (início): azul sereno (#38BDF8 / #3B82F6)
 * - 50% (meio): turquesa/água (#2DD4BF / #0EA5E9)
 * - 100% (meta): verde menta/esmeralda (#10B981 / #34D399)
 */
function getProgressPalette(progressPct: number) {
  const t = Math.max(0, Math.min(1, progressPct / 100));

  const blueStart: RGB = [59, 130, 246];
  const blueEnd: RGB = [56, 189, 248];

  const tealStart: RGB = [14, 165, 233];
  const tealEnd: RGB = [45, 212, 191];

  const greenStart: RGB = [16, 185, 129];
  const greenEnd: RGB = [52, 211, 153];

  const primary =
    t < 0.5
      ? lerpRgb(blueStart, tealStart, t * 2)
      : lerpRgb(tealStart, greenStart, (t - 0.5) * 2);

  const secondary =
    t < 0.5
      ? lerpRgb(blueEnd, tealEnd, t * 2)
      : lerpRgb(tealEnd, greenEnd, (t - 0.5) * 2);

  return {
    ringStart: rgbCss(primary),
    ringEnd: rgbCss(secondary),
    glowSoft: rgbCss(secondary, 0.34),
    haloSoft: rgbCss(primary, 0.28),
    orbTint: rgbCss(secondary, 0.24),
  };
}

export const CycleView: React.FC = () => {
  const {
    disciplines,
    cycleSettings,
    cycleState,
    activeSession,
    setActiveTab,
    addCustomDiscipline,
    updateDiscipline,
    updateCycleSettings,
    jumpToCycleBlock,
    restartCycle,
    startBlockSession,
    pauseActiveSession,
    resumeActiveSession,
    setActiveSessionNotes,
    discardActiveSession,
    finishActiveSession,
    skipCurrentBlock,
    notify,
  } = useApp();
  const elapsedSessionMs = useSessionTimer();

  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [manualMinutes, setManualMinutes] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [showDisciplinesModal, setShowDisciplinesModal] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);

  useEffect(() => {
    if (!showSettings && !showSequenceModal && !showDisciplinesModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
        setShowSequenceModal(false);
        setShowDisciplinesModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSettings, showSequenceModal, showDisciplinesModal]);

  const [draftSettings, setDraftSettings] =
    useState<CycleSettings>(cycleSettings);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showAddDisc, setShowAddDisc] = useState(false);
  const [newDiscName, setNewDiscName] = useState('');
  const [newDiscTheme, setNewDiscTheme] = useState<DisciplineTheme>('sky');
  const [newDiscWeight, setNewDiscWeight] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [newDiscDiff, setNewDiscDiff] = useState<Difficulty>('medium');
  const [newDiscError, setNewDiscError] = useState<string | null>(null);

  const blocks = cycleState.plan?.blocks ?? [];
  const allocations = cycleState.plan?.allocations ?? [];
  const currentBlock = blocks[cycleState.position] ?? null;

  const currentBlockContents = useMemo(() => {
    if (!currentBlock) return [];
    const disc = disciplines.find((d) => d.id === currentBlock.disciplineId);
    return disc ? flattenContents(disc) : [];
  }, [currentBlock, disciplines]);

  const plannedMs = activeSession ? activeSession.plannedMinutes * 60_000 : 0;
  const progressPct =
    plannedMs > 0 ? Math.min(100, Math.round((elapsedSessionMs / plannedMs) * 100)) : 0;

  const palette = useMemo(
    () => getProgressPalette(activeSession ? progressPct : 0),
    [activeSession, progressPct],
  );

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    const res = await updateCycleSettings(draftSettings);
    if (!res.ok) {
      setSettingsError(res.error);
      return;
    }
    setShowSettings(false);
  };

  return (
    <div className="min-h-full flex flex-col gap-5 max-w-[1280px] mx-auto pt-1">
      <PageHeader
        badge={`Ciclo de Estudos · Ciclo #${cycleState.cycleNumber}`}
        badgeDotClassName={
          activeSession
            ? progressPct >= 75
              ? 'bg-[#10B981]'
              : 'bg-[#38BDF8]'
            : 'bg-[#38BDF8]'
        }
        title="Estudar Agora"
        subtitle="Um bloco de cada vez, no seu ritmo, com foco sereno e contínuo."
        actions={
          <>
            {blocks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSequenceModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_8px_rgba(17,24,39,0.03)] text-[13px] font-medium text-[#111827] hover:bg-[#FAFAF9] transition cursor-pointer"
              >
                <ListOrdered className="w-4 h-4 text-[#4B5563]" />
                Sequência ({blocks.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDisciplinesModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_8px_rgba(17,24,39,0.03)] text-[13px] font-medium text-[#111827] hover:bg-[#FAFAF9] transition cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#4B5563]" />
              Disciplinas e pesos
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftSettings(cycleSettings);
                setSettingsError(null);
                setShowSettings(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_8px_rgba(17,24,39,0.03)] text-[13px] font-medium text-[#4B5563] hover:bg-[#FAFAF9] hover:text-[#111827] transition cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              Ajustar ciclo
            </button>
            <button
              type="button"
              onClick={() => setConfirmRestartOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_8px_rgba(17,24,39,0.03)] text-[13px] font-medium text-[#4B5563] hover:bg-[#FAFAF9] hover:text-[#111827] transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar bloco 1
            </button>
          </>
        }
      />

      {/* Avisos do algoritmo de distribuição (quando aplicável) */}
      {(cycleState.plan?.warnings?.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-[#FEF9EC] border border-[#FDE68A] px-4 py-3 flex items-start gap-2.5 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            {cycleState.plan!.warnings.map((w, idx) => (
              <p key={idx}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Palco Principal em Tela Cheia: Estudar Agora / Sessão Ativa */}
      <section className="relative overflow-hidden rounded-[30px] surface-card p-8 md:p-14 flex-1 flex flex-col items-center justify-center">
        {/* Halo ambiente que transiciona suavemente do azul (início) para o verde (meta) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[280px] rounded-full blur-3xl transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, ${palette.haloSoft} 0%, rgba(224,242,254,0.22) 55%, transparent 100%)`,
          }}
        />

        {activeSession?.origin === 'trilha' ? (
          <div className="relative flex flex-col items-center text-center max-w-xl mx-auto space-y-5">
            <div className="w-20 h-20 rounded-full iridescent-orb" />
            <span className="text-xs font-medium text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-3.5 py-1 rounded-full">
              Sessão pela Trilha em andamento
            </span>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-[#111827]">
              {activeSession.disciplineName}
              {activeSession.contentTitle ? ` — ${activeSession.contentTitle}` : ''}
            </h3>
            <p className="text-sm text-[#6B7280]">
              Esta sessão foi iniciada diretamente na Trilha e não altera o bloco do ciclo.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('trails')}
              className="px-5 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] shadow-sm transition cursor-pointer"
            >
              Ir para a Trilha ({formatClock(elapsedSessionMs)})
            </button>
          </div>
        ) : activeSession ? (
          <div className="relative flex flex-col items-center text-center max-w-2xl w-full mx-auto space-y-6">
            {/* Círculo inteligente: azul no início -> turquesa no meio -> verde perto da meta */}
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg
                className="absolute inset-0 w-full h-full -rotate-90 transition-all duration-700"
                viewBox="0 0 180 180"
                aria-hidden="true"
                style={{
                  filter: `drop-shadow(0 0 10px ${palette.glowSoft})`,
                }}
              >
                <defs>
                  <linearGradient id="focusRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={palette.ringStart} />
                    <stop offset="100%" stopColor={palette.ringEnd} />
                  </linearGradient>
                </defs>
                <circle
                  cx="90"
                  cy="90"
                  r="82"
                  fill="none"
                  stroke="#F3F4F6"
                  strokeWidth="6.5"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="82"
                  fill="none"
                  stroke="url(#focusRingGrad)"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeDasharray={515.22}
                  strokeDashoffset={515.22 * (1 - progressPct / 100)}
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Orbe central com respiração calma e matiz que acompanha o progresso */}
              <div
                className={`relative w-36 h-36 rounded-full iridescent-orb transition-all duration-1000 ${
                  activeSession.status === 'running' ? 'orb-breathe' : 'opacity-85'
                }`}
                style={{
                  boxShadow: `inset 0 2px 8px rgba(255,255,255,0.85), 0 14px 38px ${palette.glowSoft}`,
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full transition-colors duration-1000"
                  style={{
                    background: `radial-gradient(circle at 68% 72%, ${palette.orbTint} 0%, transparent 72%)`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-colors duration-500 ${
                  activeSession.status === 'running'
                    ? progressPct >= 75
                      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
                      : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                    : 'bg-[#FEF9EC] border-[#FDE68A] text-[#92400E]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeSession.status === 'running'
                      ? progressPct >= 75
                        ? 'bg-[#10B981] animate-pulse'
                        : 'bg-[#38BDF8] animate-pulse'
                      : 'bg-[#D97706]'
                  }`}
                />
                {activeSession.status === 'running'
                  ? progressPct >= 90
                    ? 'Quase na meta'
                    : 'Em foco'
                  : 'Em pausa'}
              </span>

              <h3 className="font-display text-2xl md:text-3xl font-bold text-[#111827] tracking-tight">
                {activeSession.disciplineName}
              </h3>

              {activeSession.contentTitle && (
                <p className="text-sm text-[#6B7280]">
                  {activeSession.contentTitle}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <TimerReadout
                ms={elapsedSessionMs}
                className="text-5xl md:text-[60px] font-bold text-[#111827] leading-none"
              />
              <p className="text-xs text-[#6B7280] tabular-nums">
                Meta do bloco: {formatMinutes(activeSession.plannedMinutes)} · {progressPct}%
              </p>
            </div>

            <div className="w-full max-w-xl">
              <textarea
                rows={2}
                value={activeSession.notes}
                onChange={(e) => setActiveSessionNotes(e.target.value)}
                placeholder="Anotações da sessão (o que foi estudado, páginas, questões)..."
                className="w-full rounded-2xl p-3.5 text-sm text-left input-ambient"
              />
            </div>

            <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {activeSession.status === 'running' ? (
                  <button
                    type="button"
                    onClick={pauseActiveSession}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF9EC] border border-[#FDE68A] text-[#92400E] text-sm font-medium hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeActiveSession}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] shadow-sm transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    Retomar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmDiscardOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Descartar
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  placeholder="Ajustar min"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl text-sm tabular-nums input-ambient"
                />
                <button
                  type="button"
                  onClick={async () => {
                    let parsed: number | undefined = undefined;
                    if (manualMinutes.trim()) {
                      const num = Number(manualMinutes);
                      if (!Number.isFinite(num) || num < 1 || num > 1440) {
                        notify(
                          'Informe um tempo válido entre 1 e 1440 minutos.',
                          'warning',
                        );
                        return;
                      }
                      parsed = Math.round(num);
                    }
                    await finishActiveSession(parsed);
                    setManualMinutes('');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10B981] text-white text-sm font-medium hover:bg-[#059669] shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Concluir sessão
                </button>
              </div>
            </div>
          </div>
        ) : currentBlock ? (
          <div className="relative flex flex-col items-center text-center max-w-xl w-full mx-auto space-y-7">
            {/* Círculo de prontidão em azul suave (início da jornada) */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 180 180"
                aria-hidden="true"
              >
                <circle
                  cx="90"
                  cy="90"
                  r="82"
                  fill="none"
                  stroke="#E0F2FE"
                  strokeWidth="4"
                />
              </svg>
              <div
                className="w-32 h-32 rounded-full iridescent-orb orb-breathe"
                style={{
                  boxShadow:
                    'inset 0 2px 8px rgba(255,255,255,0.88), 0 14px 36px rgba(56,189,248,0.32)',
                }}
              />
            </div>

            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE]/80 px-3.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                Estudar agora · Bloco {currentBlock.index + 1} de {blocks.length}
              </span>
              <h3 className="font-display text-3xl md:text-[42px] font-bold text-[#111827] tracking-tight leading-tight">
                {currentBlock.disciplineName}
              </h3>
              <p className="text-sm text-[#6B7280]">
                {formatMinutes(currentBlock.plannedMinutes)} sugeridos · Ocorrência{' '}
                {currentBlock.occurrence}/{currentBlock.totalForDiscipline}
              </p>
            </div>

            {currentBlockContents.length > 0 && (
              <div className="w-full max-w-sm text-left">
                <label className="block text-xs text-[#6B7280] mb-1.5 text-center">
                  Vincular a um conteúdo da trilha (opcional)
                </label>
                <select
                  value={selectedContentId}
                  onChange={(e) => setSelectedContentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm input-ambient"
                >
                  <option value="">Estudo geral da disciplina</option>
                  {currentBlockContents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const found = currentBlockContents.find(
                    (c) => c.id === selectedContentId,
                  );
                  startBlockSession(
                    currentBlock,
                    found?.id ?? null,
                    found?.title ?? null,
                  );
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] shadow-sm transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Iniciar estudo
              </button>
              <button
                type="button"
                onClick={skipCurrentBlock}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#F3F4F6] text-[#111827] text-sm font-medium hover:bg-[#E5E7EB] transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4 text-[#4B5563]" />
                Pular bloco
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full iridescent-orb opacity-75" />
            <p className="text-sm text-[#6B7280]">
              Ative ao menos uma disciplina para gerar os blocos do ciclo.
            </p>
            <button
              type="button"
              onClick={() => setShowDisciplinesModal(true)}
              className="px-4 py-2 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] transition cursor-pointer"
            >
              Selecionar disciplinas
            </button>
          </div>
        )}
      </section>

      {/* Modal: Sequência Intercalada do Ciclo (sob demanda) */}
      {showSequenceModal && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSequenceModal(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[82vh] overflow-y-auto rounded-[28px] bg-white border border-[#EAE9E4] p-6 shadow-[0_24px_60px_rgba(17,24,39,0.14)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111827]">
                  Sequência Intercalada do Ciclo
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Clique em qualquer bloco para pular diretamente para ele.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSequenceModal(false)}
                className="w-8 h-8 rounded-full bg-[#FAFAF9] border border-[#EAE9E4] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                aria-label="Fechar sequência"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {blocks.map((b) => {
                const isCurrent = b.index === cycleState.position;
                const isDone = b.index < cycleState.position;
                const theme = DISCIPLINE_THEMES[b.theme];
                return (
                  <button
                    key={b.index}
                    type="button"
                    onClick={async () => {
                      await jumpToCycleBlock(b.index);
                      setShowSequenceModal(false);
                    }}
                    className={`px-3.5 py-2 rounded-2xl border text-left text-xs transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[#111827] text-white border-[#111827] shadow-sm'
                        : isDone
                          ? 'bg-[#F3F4F6]/70 text-[#9CA3AF] border-transparent'
                          : 'bg-[#FAFAF9] text-[#111827] border-[#EAE9E4] hover:border-[#D1D5DB] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {!isCurrent && (
                        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                      )}
                      <span>
                        {b.index + 1}. {b.disciplineName}
                      </span>
                    </div>
                    <div className="mt-0.5 opacity-80 tabular-nums">
                      {b.plannedMinutes} min ({b.occurrence}/{b.totalForDiscipline})
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Disciplinas e Pesos no Ciclo (sob demanda) */}
      {showDisciplinesModal && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDisciplinesModal(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[84vh] overflow-y-auto rounded-[28px] bg-white border border-[#EAE9E4] p-6 shadow-[0_24px_60px_rgba(17,24,39,0.14)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111827]">
                  Disciplinas e Pesos no Ciclo
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Marque quais disciplinas entram na rotação temporal. Desmarcar não apaga seu progresso nas trilhas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewDiscError(null);
                    setShowAddDisc((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F3F4F6] text-[#111827] text-xs font-medium hover:bg-[#E5E7EB] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar disciplina
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisciplinesModal(false)}
                  className="w-8 h-8 rounded-full bg-[#FAFAF9] border border-[#EAE9E4] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                  aria-label="Fechar disciplinas e pesos"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showAddDisc && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNewDiscError(null);
                  const res = await addCustomDiscipline({
                    name: newDiscName,
                    description: '',
                    theme: newDiscTheme,
                    weight: newDiscWeight,
                    difficulty: newDiscDiff,
                    inCycle: true,
                  });
                  if (!res.ok) {
                    setNewDiscError(res.error);
                    return;
                  }
                  setNewDiscName('');
                  setShowAddDisc(false);
                }}
                className="p-4 rounded-2xl surface-inset space-y-3"
              >
                {newDiscError && (
                  <p className="text-xs text-[#DC2626]">{newDiscError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    value={newDiscName}
                    onChange={(e) => setNewDiscName(e.target.value)}
                    placeholder="Nome da disciplina (ex.: Direito Civil)"
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm focus:outline-none focus:border-[#9CA3AF]"
                    autoFocus
                  />
                  <select
                    value={newDiscTheme}
                    onChange={(e) => setNewDiscTheme(e.target.value as DisciplineTheme)}
                    className="px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-xs"
                  >
                    {Object.values(DISCIPLINE_THEMES).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={newDiscWeight}
                      onChange={(e) =>
                        setNewDiscWeight(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                      }
                      className="flex-1 px-2.5 py-2 rounded-xl border border-[#EAE9E4] bg-white text-xs"
                    >
                      {[1, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>
                          Peso {w}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newDiscDiff}
                      onChange={(e) => setNewDiscDiff(e.target.value as Difficulty)}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-[#EAE9E4] bg-white text-xs"
                    >
                      <option value="easy">Fácil</option>
                      <option value="medium">Média</option>
                      <option value="hard">Difícil</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDisc(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#6B7280] hover:bg-[#E5E7EB]/60 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#111827] text-white hover:bg-[#1F2937] cursor-pointer"
                  >
                    Incluir no ciclo
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {disciplines.map((d) => {
                const alloc = allocations.find((a) => a.disciplineId === d.id);
                const theme = DISCIPLINE_THEMES[d.theme];
                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-2xl surface-inset flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={d.inCycle}
                          onChange={(e) =>
                            updateDiscipline(
                              { ...d, inCycle: e.target.checked },
                              `${d.name} ${e.target.checked ? 'incluída no' : 'removida do'} ciclo.`,
                            )
                          }
                          className="w-4 h-4 accent-[#111827]"
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                        <span className="font-semibold text-sm text-[#111827]">
                          {d.name}
                        </span>
                      </div>
                      {alloc && (
                        <p className="text-xs text-[#6B7280] mt-1 pl-6">
                          {explainAllocation(alloc)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <select
                        value={d.weight}
                        onChange={(e) =>
                          updateDiscipline({
                            ...d,
                            weight: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl border border-[#EAE9E4] bg-white text-xs text-[#111827]"
                      >
                        {[1, 2, 3, 4, 5].map((w) => (
                          <option key={w} value={w}>
                            Peso {w}
                          </option>
                        ))}
                      </select>
                      <select
                        value={d.difficulty}
                        onChange={(e) =>
                          updateDiscipline({
                            ...d,
                            difficulty: e.target.value as Difficulty,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl border border-[#EAE9E4] bg-white text-xs text-[#111827]"
                      >
                        <option value="easy">Fácil</option>
                        <option value="medium">Média</option>
                        <option value="hard">Difícil</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Parâmetros do Algoritmo de Distribuição */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <form
            onSubmit={handleSaveSettings}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-[28px] bg-white border border-[#EAE9E4] p-6 shadow-[0_24px_60px_rgba(17,24,39,0.14)] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111827]">
                Parâmetros do Algoritmo de Distribuição
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full bg-[#FAFAF9] border border-[#EAE9E4] flex items-center justify-center text-[#6B7280] hover:text-[#111827] cursor-pointer"
                aria-label="Fechar ajustes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {settingsError && (
              <p className="text-xs text-[#DC2626]">{settingsError}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">
                  Tempo total do ciclo (min)
                </label>
                <input
                  type="number"
                  step={5}
                  value={draftSettings.cycleMinutes}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      cycleMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl text-sm tabular-nums input-ambient"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">
                  Duração padrão da sessão (min)
                </label>
                <input
                  type="number"
                  step={5}
                  value={draftSettings.sessionMinutes}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      sessionMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl text-sm tabular-nums input-ambient"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">
                  Bloco mínimo (min)
                </label>
                <input
                  type="number"
                  step={5}
                  value={draftSettings.minBlockMinutes}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      minBlockMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl text-sm tabular-nums input-ambient"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#111827] hover:bg-[#1F2937] text-white shadow-sm transition cursor-pointer"
              >
                Aplicar parâmetros
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Descartar sessão em andamento?"
        message="O tempo acumulado nesta sessão será perdido e não será registrado no histórico nem avançará o ciclo."
        confirmLabel="Descartar sessão"
        danger
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={async () => {
          setConfirmDiscardOpen(false);
          await discardActiveSession();
        }}
      />

      <ConfirmDialog
        open={confirmRestartOpen}
        title="Reiniciar ciclo para o bloco 1?"
        message="A posição atual do ciclo voltará ao primeiro bloco planejado. Seu histórico de sessões já concluídas será mantido."
        confirmLabel="Reiniciar bloco 1"
        onCancel={() => setConfirmRestartOpen(false)}
        onConfirm={async () => {
          setConfirmRestartOpen(false);
          await restartCycle();
        }}
      />
    </div>
  );
};
