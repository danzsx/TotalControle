import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import { formatMinutes } from '../../domain/explain';
import {
  calculateDisciplineMetrics,
  calculateGlobalMetrics,
  findNextDiscovery,
  getReviewSuggestions,
} from '../../domain/mastery';
import {
  currentStreakDays,
  detectStudyContext,
  findLastAccessedContent,
} from '../../domain/stats';
import { AnalogClock } from '../components/AnalogClock';
import { CardInspectorModal } from '../components/cards/CardInspectorModal';
import { TradingCard3D } from '../components/cards/TradingCard3D';

export const DashboardView: React.FC = () => {
  const {
    meta,
    activeExam,
    disciplines,
    activeDiscipline,
    sessions,
    errors,
    cycleState,
    activeSession,
    evaluatedCards,
    cardsEnabled,
    setActiveTab,
    startBlockSession,
    openContentInTrail,
    selectActiveDiscipline,
  } = useApp();

  const [inspectCardIndex, setInspectCardIndex] = useState<number | null>(null);

  const global = calculateGlobalMetrics(disciplines, sessions, errors);
  const streak = currentStreakDays(sessions);
  const studyContext = detectStudyContext(disciplines, cycleState);
  const nextBlock = cycleState.plan?.blocks[cycleState.position] ?? null;
  const lastAccessed = findLastAccessedContent(disciplines);
  const nextContent = findNextDiscovery(activeDiscipline);
  const featuredTrailItem = lastAccessed
    ? { discipline: lastAccessed.discipline, content: lastAccessed.content, isLastAccessed: true }
    : activeDiscipline && nextContent
      ? { discipline: activeDiscipline, content: nextContent, isLastAccessed: false }
      : null;

  const reviewSuggestions = getReviewSuggestions(disciplines, errors);
  const suggestedContentIds = new Set(reviewSuggestions.map((s) => s.content.id));
  const extraHighErrors = errors.filter(
    (e) => e.priority === 'alta' && !suggestedContentIds.has(e.contentId),
  );
  const reviewPointsCount = reviewSuggestions.length + extraHighErrors.length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Passos dinâmicos do Roteiro de descoberta
  const hasStartedAnyContent = disciplines.some((d) =>
    d.levels.some((l) =>
      l.modules.some((m) =>
        m.contents.some((c) => c.status !== 'nao_iniciado'),
      ),
    ),
  );
  const unlockedCardsCount = evaluatedCards.filter(
    (c) => c.evaluation.unlocked,
  ).length;
  const discoverySteps = [
    {
      label: 'Escolher uma disciplina',
      done: Boolean(activeDiscipline),
    },
    {
      label: 'Explorar a trilha visual',
      done: hasStartedAnyContent,
    },
    {
      label: 'Registrar primeiros exercícios',
      done: global.exercisesDone > 0,
    },
    {
      label: 'Desbloquear primeira carta',
      done: unlockedCardsCount > 0,
    },
  ];

  // Disciplina em foco no squircle central
  const focusDiscipline = activeDiscipline ?? disciplines[0] ?? null;

  // Carta em destaque do catálogo real (última desbloqueada ou próxima conquista mais próxima)
  const featuredCardIndex = useMemo(() => {
    if (evaluatedCards.length === 0) return -1;
    const unlockedWithDates = evaluatedCards
      .map((item, idx) => ({ item, idx }))
      .filter((x) => x.item.evaluation.unlocked)
      .sort((a, b) =>
        (b.item.unlockedAt ?? '').localeCompare(a.item.unlockedAt ?? ''),
      );
    if (unlockedWithDates.length > 0) return unlockedWithDates[0].idx;

    const closestLocked = evaluatedCards
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => b.item.evaluation.progressPct - a.item.evaluation.progressPct);
    return closestLocked[0]?.idx ?? 0;
  }, [evaluatedCards]);

  const featuredCard =
    featuredCardIndex >= 0 ? evaluatedCards[featuredCardIndex] : null;

  // Pílulas flutuantes ao redor do squircle central (até 3 disciplinas)
  const floatingDisciplines = disciplines
    .filter((d) => d.id !== focusDiscipline?.id)
    .slice(0, 3);

  const renderFloatingPill = (d: (typeof disciplines)[number], extraClass = '') => {
    const m = calculateDisciplineMetrics(d, sessions, errors);
    const t = DISCIPLINE_THEMES[d.theme];
    return (
      <button
        key={d.id}
        type="button"
        onClick={() => selectActiveDiscipline(d.id)}
        className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/95 hover:bg-white border border-[#EAE9E4] shadow-[0_6px_20px_rgba(30,36,48,0.045)] hover:shadow-[0_10px_26px_rgba(30,36,48,0.08)] transition-all text-left cursor-pointer max-w-[230px] ${extraClass}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-[#111827] truncate group-hover:text-[#2B4C7E] transition-colors">
            {d.name}
          </p>
          <p className="text-[11px] text-[#6B7280] tabular-nums">
            {m.completion}% trilha · {m.mastery}% domínio
          </p>
        </div>
      </button>
    );
  };

  // Ação principal da barra inferior
  const handleContinueJourney = async () => {
    if (activeSession) {
      setActiveTab(activeSession.origin === 'trilha' ? 'trails' : 'cycle');
      return;
    }
    if (studyContext.mode === 'cycle_only' && nextBlock) {
      await startBlockSession(nextBlock);
      setActiveTab('cycle');
      return;
    }
    if (featuredTrailItem) {
      openContentInTrail(
        featuredTrailItem.discipline.id,
        featuredTrailItem.content.id,
      );
      return;
    }
    if (nextBlock) {
      await startBlockSession(nextBlock);
      setActiveTab('cycle');
      return;
    }
    setActiveTab('trails');
  };

  return (
    <div className="min-h-full flex flex-col justify-between gap-6 max-w-[1280px] mx-auto pt-1">
      {/* Cabeçalho sereno + Relógio analógico */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#EAE9E4] shadow-[0_1px_4px_rgba(0,0,0,0.03)] mb-3">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
            <span className="text-[11.5px] font-medium text-[#4B5563]">
              {activeExam
                ? `${activeExam.name} · O conhecimento como uma jornada iluminada`
                : 'O conhecimento como uma jornada iluminada'}
            </span>
          </div>

          <h2 className="font-display text-3xl md:text-[34px] font-bold tracking-tight text-[#111827] leading-tight">
            {greeting}, {meta.userName}.
          </h2>
          <p className="text-[13.5px] text-[#6B7280] mt-1">
            Não tenha pressa para chegar. Descubra o prazer de avançar.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              title="Abrir painel completo de estatísticas"
              className="px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#EAE9E4] hover:border-[#D1D5DB] text-[11.5px] text-[#4B5563] shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition cursor-pointer"
            >
              <span className="text-[#9CA3AF]">Tempo: </span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {formatMinutes(global.totalStudiedMinutes)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              title="Abrir painel completo de estatísticas"
              className="px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#EAE9E4] hover:border-[#D1D5DB] text-[11.5px] text-[#4B5563] shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition cursor-pointer"
            >
              <span className="text-[#9CA3AF]">Sequência: </span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {streak} {streak === 1 ? 'dia' : 'dias'}
              </span>
            </button>
          </div>
          <AnalogClock />
        </div>
      </header>

      {/* Palco central orgânico (estilo Be a Master) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center my-auto py-2">
        {/* Coluna Esquerda: Roteiro de descoberta + Reencontro sereno */}
        <div className={`${cardsEnabled ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-3.5`}>
          {/* Card Lavanda: Roteiro de descoberta */}
          <section className="discovery-card-gradient rounded-[24px] p-5 border border-[#E9D5FF]/70 shadow-[0_8px_28px_rgba(139,92,246,0.06)]">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-display text-[14px] font-semibold text-[#1E1B4B]">
                Roteiro de descoberta
              </h3>
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
            </div>

            <ul className="space-y-2.5">
              {discoverySteps.map((step) => (
                <li
                  key={step.label}
                  className="flex items-center gap-2.5 text-[12.5px]"
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#7C3AED] shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#A78BFA] shrink-0" />
                  )}
                  <span
                    className={
                      step.done
                        ? 'text-[#312E81] font-medium'
                        : 'text-[#4C1D95]/75'
                    }
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Card Branco: Reencontro sereno */}
          <section className="rounded-[24px] bg-white/95 border border-[#EAE9E4] p-5 shadow-[0_4px_20px_rgba(30,36,48,0.03)]">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#16A34A]" />
              <h3 className="font-display text-[13.5px] font-semibold text-[#111827]">
                Reencontro sereno
              </h3>
            </div>

            {reviewPointsCount > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[12.5px] text-[#4B5563] leading-relaxed">
                  Que tal revisitar alguns conhecimentos? Há{' '}
                  <span className="font-semibold text-[#111827] tabular-nums">
                    {reviewPointsCount}{' '}
                    {reviewPointsCount === 1 ? 'ponto pronto' : 'pontos prontos'}
                  </span>{' '}
                  para brilhar de novo.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (reviewSuggestions[0]) {
                      openContentInTrail(
                        reviewSuggestions[0].discipline.id,
                        reviewSuggestions[0].content.id,
                      );
                    } else {
                      setActiveTab('errors');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#166534] hover:text-[#15803D] transition cursor-pointer"
                >
                  Revisitar agora
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#6B7280] leading-relaxed">
                Tudo em paz por aqui. Nenhum ponto crítico pendente no momento.
              </p>
            )}
          </section>
        </div>

        {/* Coluna Central: Squircle iridescente + Pílulas de disciplinas */}
        <div className={`${cardsEnabled ? 'lg:col-span-5' : 'lg:col-span-7'} flex flex-col items-center justify-center py-4`}>
          {/* Pílulas superiores */}
          {floatingDisciplines.length > 0 && (
            <div className="w-full max-w-[440px] flex flex-wrap items-center justify-between gap-3 mb-5 px-2">
              {floatingDisciplines[0] &&
                renderFloatingPill(floatingDisciplines[0], '-translate-y-1')}
              {floatingDisciplines[1] &&
                renderFloatingPill(floatingDisciplines[1], 'translate-y-1')}
            </div>
          )}

          {/* Squircle Iridescente Central */}
          <div className="relative flex flex-col items-center">
            <div className="w-48 h-48 md:w-52 md:h-52 rounded-[42px] iridescent-squircle flex flex-col items-center justify-center px-5 text-center select-none transition-transform duration-500 hover:scale-[1.02]">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#1E293B]/70">
                Domínio Geral
              </span>
              <span className="font-display text-[54px] font-bold text-[#111827] tabular-nums leading-none mt-1">
                {global.mastery}%
              </span>

              {/* Pílula inclinada da disciplina ativa */}
              <button
                type="button"
                onClick={() => setActiveTab('trails')}
                title="Abrir trilha da disciplina em foco"
                className="-rotate-2 mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/85 hover:bg-white backdrop-blur-md border border-white shadow-[0_4px_14px_rgba(15,23,42,0.08)] max-w-[185px] transition cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />
                <span className="text-[11.5px] font-semibold text-[#111827] truncate">
                  {focusDiscipline?.name ?? 'Explorar trilhas'}
                </span>
              </button>
            </div>

            {/* Micro-resumo discreto abaixo do squircle */}
            <p className="mt-4 text-[11.5px] text-[#6B7280] tabular-nums text-center">
              {global.completedCount}/{global.totalContents} conteúdos ·{' '}
              {global.completion}% trilha ·{' '}
              {global.performance !== null
                ? `${global.performance}% questões`
                : 'sem questões'}
            </p>
          </div>

          {/* Pílula inferior */}
          {floatingDisciplines[2] && (
            <div className="w-full max-w-[420px] flex justify-start mt-4 px-2">
              {renderFloatingPill(floatingDisciplines[2])}
            </div>
          )}
        </div>

        {/* Coluna Direita: Carta Colecionável 3D Real (unificada com o Catálogo) */}
        {cardsEnabled && (
          <div className="lg:col-span-4 flex flex-col items-center">
            {featuredCard && (
              <div className="w-full max-w-[270px]">
                <TradingCard3D
                  item={featuredCard}
                  size="catalog"
                  onOpenInspector={() => setInspectCardIndex(featuredCardIndex)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className="mt-3.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#111827] transition cursor-pointer"
            >
              Ver catálogo de cartas ({unlockedCardsCount}/{evaluatedCards.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Barra Flutuante Inferior */}
      <section className="rounded-[22px] bg-white/95 border border-[#EAE9E4] px-5 py-3.5 shadow-[0_6px_24px_rgba(30,36,48,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              activeSession
                ? 'bg-[#2563EB]'
                : featuredTrailItem
                  ? DISCIPLINE_THEMES[featuredTrailItem.discipline.theme].dot
                  : 'bg-[#38BDF8]'
            }`}
          />
          <div className="min-w-0">
            {activeSession ? (
              <>
                <p className="text-[11.5px] text-[#6B7280] truncate">
                  Sessão em andamento · {activeSession.disciplineName}
                </p>
                <p className="text-[14px] font-semibold text-[#111827] truncate">
                  {activeSession.contentTitle ?? 'Bloco de estudo ativo'}
                </p>
              </>
            ) : studyContext.mode === 'cycle_only' && nextBlock ? (
              <>
                <p className="text-[11.5px] text-[#6B7280] truncate">
                  Próximo bloco do ciclo · {formatMinutes(nextBlock.plannedMinutes)}
                </p>
                <p className="text-[14px] font-semibold text-[#111827] truncate">
                  {nextBlock.disciplineName}
                </p>
              </>
            ) : featuredTrailItem ? (
              <>
                <p className="text-[11.5px] text-[#6B7280] truncate">
                  Próxima descoberta em {featuredTrailItem.discipline.name}
                </p>
                <p className="text-[14px] font-semibold text-[#111827] truncate">
                  {featuredTrailItem.content.title}
                </p>
              </>
            ) : nextBlock ? (
              <>
                <p className="text-[11.5px] text-[#6B7280] truncate">
                  Próximo bloco programado · {formatMinutes(nextBlock.plannedMinutes)}
                </p>
                <p className="text-[14px] font-semibold text-[#111827] truncate">
                  {nextBlock.disciplineName}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11.5px] text-[#6B7280]">
                  Pronto para iniciar sua jornada
                </p>
                <p className="text-[14px] font-semibold text-[#111827]">
                  Explore uma trilha ou configure seu ciclo de estudos
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleContinueJourney}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-medium transition cursor-pointer shadow-sm"
          >
            {studyContext.mode === 'cycle_only' && nextBlock && !activeSession ? (
              <>
                <Play className="w-3.5 h-3.5" />
                Iniciar bloco
              </>
            ) : (
              <>
                Continuar jornada
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(studyContext.mode === 'cycle_only' ? 'cycle' : 'trails')
            }
            className="px-4 py-2.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] text-[13px] font-medium transition cursor-pointer"
          >
            {studyContext.mode === 'cycle_only' ? 'Ver ciclo' : 'Ver trilha'}
          </button>

          {studyContext.hasActiveCycle && studyContext.mode !== 'cycle_only' && (
            <button
              type="button"
              onClick={() => setActiveTab('cycle')}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] text-[13px] font-medium transition cursor-pointer"
              title="Abrir ciclo de estudos"
            >
              <Clock className="w-3.5 h-3.5 text-[#4B5563]" />
              Ciclo
            </button>
          )}
        </div>
      </section>

      {/* Modal de Inspeção 3D da carta em destaque */}
      <CardInspectorModal
        items={evaluatedCards}
        activeIndex={inspectCardIndex}
        onClose={() => setInspectCardIndex(null)}
        onSelectIndex={(idx) => setInspectCardIndex(idx)}
      />
    </div>
  );
};
