import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import { formatMinutes } from '../../domain/explain';
import {
  calculateDisciplineMetrics,
  calculateGlobalMetrics,
} from '../../domain/mastery';
import {
  bestStreakDays,
  calculateJourneyLevel,
  computeMilestones,
  currentStreakDays,
  dailyStudySeries,
  generateUserInsights,
  heatmapSeries,
  sessionOriginBreakdown,
  studiedTodaySummary,
  timeOfDayDistribution,
  weeklySummary,
  type HeatmapCell,
} from '../../domain/stats';

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

const PERIOD_OPTIONS: Array<{ id: PeriodFilter; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: 'all', label: 'Tudo' },
];

const HEATMAP_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#F3F4F6]',
  1: 'bg-[#D1FAE5]',
  2: 'bg-[#6EE7B7]',
  3: 'bg-[#34D399]',
  4: 'bg-[#059669]',
};

export const StatsView: React.FC = () => {
  const {
    activeExam,
    exams,
    disciplines,
    sessions,
    errors,
    allDisciplines,
    allSessions,
    allErrors,
    cycleState,
    totalCompletedCycles,
    setActiveTab,
  } = useApp();
  const [scope, setScope] = useState<'exam' | 'all'>('exam');
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [hoveredHeatCell, setHoveredHeatCell] = useState<HeatmapCell | null>(null);

  const scopedDisciplines = scope === 'exam' ? disciplines : allDisciplines;
  const scopedSessions = scope === 'exam' ? sessions : allSessions;
  const scopedErrors = scope === 'exam' ? errors : allErrors;
  const effectiveCycleState = useMemo(
    () =>
      scope === 'exam'
        ? cycleState
        : { ...cycleState, completedCycles: totalCompletedCycles },
    [scope, cycleState, totalCompletedCycles],
  );

  const activeDisciplines = useMemo(
    () => scopedDisciplines.filter((d) => !d.deletedAt),
    [scopedDisciplines],
  );

  const global = useMemo(
    () => calculateGlobalMetrics(activeDisciplines, scopedSessions, scopedErrors),
    [activeDisciplines, scopedSessions, scopedErrors],
  );

  const streak = useMemo(() => currentStreakDays(scopedSessions), [scopedSessions]);
  const bestStreak = useMemo(() => bestStreakDays(scopedSessions), [scopedSessions]);
  const today = useMemo(() => studiedTodaySummary(scopedSessions), [scopedSessions]);
  const week = useMemo(() => weeklySummary(scopedSessions), [scopedSessions]);
  const timeOfDay = useMemo(() => timeOfDayDistribution(scopedSessions), [scopedSessions]);
  const origin = useMemo(() => sessionOriginBreakdown(scopedSessions), [scopedSessions]);
  const heatmap = useMemo(() => heatmapSeries(scopedSessions, 16), [scopedSessions]);
  const journey = useMemo(
    () =>
      calculateJourneyLevel(
        activeDisciplines,
        scopedSessions,
        scopedErrors,
        effectiveCycleState,
      ),
    [activeDisciplines, scopedSessions, scopedErrors, effectiveCycleState],
  );
  const milestones = useMemo(
    () =>
      computeMilestones(
        activeDisciplines,
        scopedSessions,
        scopedErrors,
        effectiveCycleState,
      ),
    [activeDisciplines, scopedSessions, scopedErrors, effectiveCycleState],
  );
  const insights = useMemo(
    () => generateUserInsights(activeDisciplines, scopedSessions, scopedErrors),
    [activeDisciplines, scopedSessions, scopedErrors],
  );

  // Série filtrada pelo período selecionado
  const periodStats = useMemo(() => {
    const daysCount =
      period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const now = Date.now();
    const cutoff =
      period === 'all' ? 0 : now - (daysCount - 1) * 86_400_000;

    const filteredSessions = scopedSessions.filter((s) => {
      if (s.studiedMinutes <= 0) return false;
      if (period === 'all') return true;
      return new Date(s.endedAt).getTime() >= cutoff;
    });

    const totalMinutes = filteredSessions.reduce(
      (acc, s) => acc + s.studiedMinutes,
      0,
    );
    const sessionsCount = filteredSessions.length;
    const avgSessionMinutes =
      sessionsCount > 0 ? Math.round(totalMinutes / sessionsCount) : 0;

    const chartDays = period === '7d' ? 7 : period === '30d' ? 30 : 42;
    const series = dailyStudySeries(scopedSessions, chartDays, now);
    const activeDaysInChart = series.filter((d) => d.minutes > 0).length;
    const avgPerDay = Math.round(
      series.reduce((acc, d) => acc + d.minutes, 0) / Math.max(1, series.length),
    );

    return {
      totalMinutes,
      sessionsCount,
      avgSessionMinutes,
      series,
      activeDaysInChart,
      avgPerDay,
    };
  }, [scopedSessions, period]);

  // Disciplinas ordenadas por horas estudadas
  const disciplineBreakdown = useMemo(() => {
    const list = activeDisciplines.map((d) => {
      const m = calculateDisciplineMetrics(d, scopedSessions, scopedErrors);
      return {
        discipline: d,
        theme: DISCIPLINE_THEMES[d.theme],
        metrics: m,
      };
    });
    const totalDiscMinutes = list.reduce(
      (acc, item) => acc + item.metrics.totalStudiedMinutes,
      0,
    );
    return list
      .map((item) => ({
        ...item,
        sharePercent:
          totalDiscMinutes > 0
            ? Math.round((item.metrics.totalStudiedMinutes / totalDiscMinutes) * 100)
            : 0,
      }))
      .sort(
        (a, b) =>
          b.metrics.totalStudiedMinutes - a.metrics.totalStudiedMinutes ||
          b.metrics.mastery - a.metrics.mastery,
      );
  }, [activeDisciplines, scopedSessions, scopedErrors]);

  // Taxa de superação de erros
  const errorStats = useMemo(() => {
    const active = scopedErrors.filter((e) => !e.deletedAt);
    const overcome = active.filter((e) => e.priority === 'superado').length;
    const open = active.length - overcome;
    const rate = active.length > 0 ? Math.round((overcome / active.length) * 100) : null;
    return { total: active.length, overcome, open, rate };
  }, [scopedErrors]);

  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  // Cálculos do gráfico SVG de área/barras
  const maxChartMinutes = Math.max(
    30,
    ...periodStats.series.map((d) => d.minutes),
  );
  const hoveredPoint =
    hoveredDayIndex !== null ? periodStats.series[hoveredDayIndex] ?? null : null;

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto pt-1 pb-6">
      {/* Cabeçalho */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#EAE9E4] shadow-[0_1px_4px_rgba(0,0,0,0.03)] mb-2.5">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span className="text-[11.5px] font-medium text-[#4B5563]">
              Estatísticas &amp; Ritmo Pessoal ·{' '}
              {scope === 'exam'
                ? (activeExam?.name ?? 'Concurso ativo')
                : 'Todos os concursos'}
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-[#111827] leading-tight">
            Painel da sua Jornada
          </h2>
          <p className="text-[13.5px] text-[#6B7280] mt-1">
            Horas dedicadas, constância diária, marcos alcançados e leitura clara do seu ritmo.
          </p>
        </div>

        {/* Seletores de Escopo e Período */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {exams.length > 1 && (
            <div
              className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_10px_rgba(30,36,48,0.03)]"
              role="tablist"
              aria-label="Escopo das estatísticas"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'exam'}
                onClick={() => setScope('exam')}
                className={`px-3 py-1.5 rounded-xl text-[12.5px] font-medium transition-all cursor-pointer ${
                  scope === 'exam'
                    ? 'bg-[#1D4ED8] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                {activeExam?.name ?? 'Concurso ativo'}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'all'}
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 rounded-xl text-[12.5px] font-medium transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-[#1D4ED8] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                Todos os concursos
              </button>
            </div>
          )}

          <div
            className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_10px_rgba(30,36,48,0.03)]"
            role="tablist"
            aria-label="Período das estatísticas"
          >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setPeriod(opt.id);
                  setHoveredDayIndex(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          </div>
        </div>
      </header>

      {/* Linha 1: Hero Tempo & Ritmo + Streak & Nível de Clareza */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card Esquerdo: Tempo Estudado & Gráfico */}
        <section className="lg:col-span-7 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)] flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#6B7280]">
                <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                <span>
                  Tempo focado (
                  {PERIOD_OPTIONS.find((p) => p.id === period)?.label})
                </span>
              </div>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span className="font-display text-4xl font-bold tracking-tight text-[#111827] tabular-nums">
                  {formatMinutes(periodStats.totalMinutes)}
                </span>
                {week.deltaPercent !== null && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold tabular-nums ${
                      week.deltaPercent >= 0
                        ? 'bg-[#ECFDF3] text-[#15803D]'
                        : 'bg-[#FEF2F2] text-[#B91C1C]'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {week.deltaPercent >= 0 ? `+${week.deltaPercent}%` : `${week.deltaPercent}%`} esta semana
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-[#6B7280] mt-1 tabular-nums">
                {periodStats.sessionsCount}{' '}
                {periodStats.sessionsCount === 1 ? 'sessão' : 'sessões'} · média de{' '}
                {periodStats.avgSessionMinutes > 0
                  ? formatMinutes(periodStats.avgSessionMinutes)
                  : '0 min'}{' '}
                por sessão
              </p>
            </div>

            {/* Readout interativo do hover no gráfico */}
            <div className="text-right min-h-[38px]">
              {hoveredPoint ? (
                <div className="inline-flex flex-col items-end px-3 py-1.5 rounded-xl bg-[#111827] text-white text-[11.5px] tabular-nums shadow-sm">
                  <span className="text-white/70 text-[10.5px]">{hoveredPoint.label}</span>
                  <span className="font-semibold">
                    {hoveredPoint.minutes > 0
                      ? formatMinutes(hoveredPoint.minutes)
                      : 'Sem registro'}
                  </span>
                </div>
              ) : (
                <div className="inline-flex flex-col items-end px-3 py-1.5 rounded-xl bg-[#F7F7F5] border border-[#EAE9E4] text-[11.5px] tabular-nums">
                  <span className="text-[#9CA3AF] text-[10.5px]">
                    {period === '90d' || period === 'all'
                      ? 'Média (últimos 42 dias)'
                      : 'Média no gráfico'}
                  </span>
                  <span className="font-semibold text-[#111827]">
                    {formatMinutes(periodStats.avgPerDay)}/dia
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Gráfico de Barras Suaves + Linha de Média */}
          <div className="mt-6 relative">
            <div className="flex items-end gap-1 h-36 pt-3 relative">
              {/* Linha de média pontilhada */}
              {periodStats.avgPerDay > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-[#111827]/15 pointer-events-none z-10"
                  style={{
                    bottom: `${Math.min(
                      96,
                      Math.max(8, Math.round((periodStats.avgPerDay / maxChartMinutes) * 100)),
                    )}%`,
                  }}
                />
              )}

              {periodStats.series.map((day, idx) => {
                const pct = Math.round((day.minutes / maxChartMinutes) * 100);
                const isHovered = hoveredDayIndex === idx;
                return (
                  <div
                    key={day.dateKey}
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer relative"
                  >
                    <div className="w-full flex-1 flex items-end px-[1.5px]">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-200 ${
                          day.minutes > 0
                            ? isHovered
                              ? 'bg-gradient-to-t from-[#A7F3D0]/35 via-[#6EE7B7] to-[#10B981]'
                              : 'bg-gradient-to-t from-[#BAE6FD]/20 via-[#93C5FD]/60 to-[#60A5FA]/85'
                            : isHovered
                              ? 'bg-gradient-to-t from-[#F3F4F6]/30 to-[#D1D5DB]'
                              : 'bg-gradient-to-t from-[#F9FAFB]/40 to-[#E5E7EB]/70'
                        }`}
                        style={{
                          height: `${day.minutes > 0 ? Math.max(12, pct) : 14}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Eixo X limpo (primeiro, meio, último) */}
            <div className="flex items-center justify-between mt-2 text-[10.5px] text-[#9CA3AF] tabular-nums">
              <span>{periodStats.series[0]?.label}</span>
              <span>
                {
                  periodStats.series[
                    Math.floor(periodStats.series.length / 2)
                  ]?.label
                }
              </span>
              <span>
                {periodStats.series[periodStats.series.length - 1]?.label}
              </span>
            </div>
          </div>
        </section>

        {/* Card Direito: Sequência (Streak) + Gamificação Mínima */}
        <section className="lg:col-span-5 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)] flex flex-col justify-between gap-5">
          {/* Topo: Streak */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[11.5px] font-semibold text-[#1D4ED8]">
                <Flame className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Sequência de Foco</span>
              </div>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  today.hasStudiedToday
                    ? 'bg-[#ECFDF3] text-[#15803D]'
                    : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}
              >
                {today.hasStudiedToday
                  ? `Hoje: ${formatMinutes(today.minutes)}`
                  : 'Ainda sem estudo hoje'}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-4">
              <span className="font-display text-4xl font-bold text-[#111827] tabular-nums">
                {streak} {streak === 1 ? 'dia' : 'dias'}
              </span>
              <span className="text-[12.5px] text-[#6B7280] tabular-nums">
                Recorde: {bestStreak} {bestStreak === 1 ? 'dia' : 'dias'}
              </span>
            </div>

            {/* Bolinhas da semana (Seg - Dom) */}
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {week.weekDays.map((wd) => (
                <div
                  key={wd.dateKey}
                  title={`${wd.fullLabel} (${wd.dateKey.slice(5)}): ${
                    wd.minutes > 0 ? formatMinutes(wd.minutes) : 'Sem estudo'
                  }`}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-full h-8 rounded-xl flex items-center justify-center text-[11px] font-semibold transition-all ${
                      wd.studied
                        ? 'bg-[#EFF6FF] border border-[#93C5FD] text-[#1D4ED8]'
                        : wd.isToday
                          ? 'bg-white border border-[#60A5FA] text-[#1D4ED8]'
                          : wd.isFuture
                            ? 'bg-[#F9FAFB] border border-[#F3F4F6] text-[#9CA3AF]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {wd.studied ? '✓' : wd.shortLabel}
                  </div>
                  <span
                    className={`text-[9.5px] font-medium ${
                      wd.isToday ? 'text-[#1D4ED8] font-semibold' : 'text-[#6B7280]'
                    }`}
                  >
                    {wd.fullLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Base: Nível de Clareza (Gamificação Mínima e Agradável) */}
          <div className="pt-4 border-t border-[#EAE9E4]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center text-[12px] font-bold text-[#1D4ED8] tabular-nums shrink-0">
                  {journey.level}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#111827] leading-tight">
                    Nível {journey.level} · {journey.title}
                  </p>
                  <p className="text-[11px] text-[#6B7280] tabular-nums">
                    {journey.points} pontos de clareza
                  </p>
                </div>
              </div>
              {journey.nextTitle && journey.nextLevelPoints !== null && (
                <span className="text-[11px] font-semibold text-[#1D4ED8] tabular-nums">
                  {journey.progressPercent}%
                </span>
              )}
            </div>

            <div className="mt-2.5 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3B82F6] transition-all duration-500"
                style={{ width: `${Math.max(4, journey.progressPercent)}%` }}
              />
            </div>

            <p className="text-[11px] text-[#6B7280] mt-1.5 tabular-nums">
              {journey.nextTitle && journey.nextLevelPoints !== null
                ? `Faltam ${journey.nextLevelPoints - journey.points} pts para alcançar ${journey.nextTitle}`
                : 'Patamar máximo de maestria alcançado'}
            </p>
          </div>
        </section>
      </div>

      {/* Linha 2: 4 KPIs Escaneáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] bg-white border border-[#EAE9E4] p-5 shadow-[0_4px_20px_rgba(30,36,48,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#6B7280]">
              Total Acumulado
            </span>
            <Clock className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111827] mt-2 tabular-nums">
            {formatMinutes(global.totalStudiedMinutes)}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {scopedSessions.length}{' '}
            {scopedSessions.length === 1 ? 'sessão registrada' : 'sessões registradas'}
          </p>
        </div>

        <div className="rounded-[24px] bg-white border border-[#EAE9E4] p-5 shadow-[0_4px_20px_rgba(30,36,48,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#6B7280]">
              Esta Semana
            </span>
            <Sparkles className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111827] mt-2 tabular-nums">
            {formatMinutes(week.thisWeekMinutes)}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {week.activeDaysThisWeek} de 7 dias ativos na semana
          </p>
        </div>

        <div className="rounded-[24px] bg-white border border-[#EAE9E4] p-5 shadow-[0_4px_20px_rgba(30,36,48,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#6B7280]">
              Questões &amp; Acerto
            </span>
            <Target className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111827] mt-2 tabular-nums">
            {global.performance !== null ? `${global.performance}%` : '—'}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {global.exercisesDone > 0
              ? `${global.exercisesCorrect} de ${global.exercisesDone} acertos`
              : 'Nenhuma questão registrada'}
          </p>
        </div>

        <div className="rounded-[24px] bg-white border border-[#EAE9E4] p-5 shadow-[0_4px_20px_rgba(30,36,48,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#6B7280]">
              Domínio &amp; Erros
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111827] mt-2 tabular-nums">
            {global.mastery}%
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {errorStats.total > 0
              ? `${errorStats.overcome}/${errorStats.total} erros superados`
              : `${global.completedCount}/${global.totalContents} conteúdos concluídos`}
          </p>
        </div>
      </div>

      {/* Linha 3: Mapa de Constância (Heatmap 16 semanas) + Horário de Pico & Origem */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Heatmap 16 semanas */}
        <section className="lg:col-span-8 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-[16px] font-semibold text-[#111827]">
                Mapa de Constância (16 semanas)
              </h3>
              <p className="text-[12px] text-[#6B7280] tabular-nums">
                {hoveredHeatCell
                  ? `${hoveredHeatCell.label} · ${
                      hoveredHeatCell.minutes > 0
                        ? `${formatMinutes(hoveredHeatCell.minutes)} (${hoveredHeatCell.sessionsCount} ${
                            hoveredHeatCell.sessionsCount === 1 ? 'sessão' : 'sessões'
                          })`
                        : 'Sem estudo neste dia'
                    }`
                  : `${heatmap.activeDaysCount} dias ativos · ${formatMinutes(
                      heatmap.totalMinutesInWindow,
                    )} no período`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <span>Menos</span>
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <span
                  key={lvl}
                  className={`w-3 h-3 rounded-[3px] ${HEATMAP_COLORS[lvl]}`}
                />
              ))}
              <span>Mais</span>
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <div className="flex flex-col justify-between py-1 text-[10px] text-[#9CA3AF] shrink-0">
              <span>Seg</span>
              <span>Qua</span>
              <span>Sex</span>
              <span>Dom</span>
            </div>

            <div className="flex-1 grid grid-cols-16 gap-1.5">
              {heatmap.columns.map((col, cIdx) => (
                <div key={cIdx} className="grid grid-rows-7 gap-1.5">
                  {col.map((cell) => (
                    <div
                      key={cell.dateKey}
                      onMouseEnter={() => setHoveredHeatCell(cell)}
                      onMouseLeave={() => setHoveredHeatCell(null)}
                      className={`w-full aspect-square rounded-[4px] transition-transform hover:scale-110 ${
                        cell.isFuture
                          ? 'bg-[#F9FAFB] opacity-40'
                          : HEATMAP_COLORS[cell.level]
                      }`}
                      title={`${cell.label}: ${
                        cell.minutes > 0 ? formatMinutes(cell.minutes) : '0 min'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Horário de Pico & Origem do Estudo */}
        <section className="lg:col-span-4 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)] flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-display text-[16px] font-semibold text-[#111827]">
                Quando Você Rende Mais
              </h3>
              {timeOfDay.peakBucket && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">
                  Pico: {timeOfDay.peakBucket.label}
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {timeOfDay.buckets.map((b) => {
                const isPeak = timeOfDay.peakBucket?.id === b.id;
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#111827]">
                        {b.label}{' '}
                        <span className="text-[#9CA3AF] font-normal">
                          ({b.rangeLabel})
                        </span>
                      </span>
                      <span className="text-[#4B5563] tabular-nums font-medium">
                        {b.percent}% · {formatMinutes(b.minutes)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPeak
                            ? 'bg-gradient-to-r from-[#60A5FA] to-[#38BDF8]'
                            : 'bg-[#CBD5E1]'
                        }`}
                        style={{ width: `${b.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Origem do estudo: Ciclo vs Trilha */}
          <div className="pt-4 border-t border-[#F3F4F6]">
            <div className="flex items-center justify-between text-[12px] mb-2">
              <span className="font-medium text-[#6B7280]">Origem das horas</span>
              <span className="text-[11px] text-[#6B7280] tabular-nums">
                Ciclo {origin.cyclePercent}% · Trilha {origin.trailPercent}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden flex">
              {origin.cyclePercent > 0 && (
                <div
                  className="h-full bg-[#60A5FA]"
                  style={{ width: `${origin.cyclePercent}%` }}
                  title={`Ciclo: ${formatMinutes(origin.cycleMinutes)}`}
                />
              )}
              {origin.trailPercent > 0 && (
                <div
                  className="h-full bg-[#34D399]"
                  style={{ width: `${origin.trailPercent}%` }}
                  title={`Trilha: ${formatMinutes(origin.trailMinutes)}`}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Linha 4: Distribuição por Disciplina + Insights da Jornada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Disciplinas */}
        <section className="lg:col-span-7 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-[16px] font-semibold text-[#111827]">
                Horas e Domínio por Disciplina
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Distribuição proporcional do seu esforço entre as matérias.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('trails')}
              className="text-[12px] font-semibold text-[#111827] hover:underline cursor-pointer"
            >
              Ver trilhas
            </button>
          </div>

          {disciplineBreakdown.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#6B7280]">
              Adicione sua primeira disciplina na Trilha para acompanhar a distribuição.
            </div>
          ) : (
            <>
              {/* Barra empilhada proporcional */}
              <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden flex mb-5">
                {disciplineBreakdown.map((item) =>
                  item.sharePercent > 0 ? (
                    <div
                      key={item.discipline.id}
                      style={{
                        width: `${item.sharePercent}%`,
                        backgroundColor: item.theme.accentHex,
                      }}
                      title={`${item.discipline.name}: ${item.sharePercent}%`}
                    />
                  ) : null,
                )}
              </div>

              <div className="space-y-3">
                {disciplineBreakdown.map((item) => (
                  <div
                    key={item.discipline.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.theme.dot}`}
                      />
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#111827] truncate">
                          {item.discipline.name}
                        </p>
                        <p className="text-[11.5px] text-[#6B7280] tabular-nums">
                          Trilha {item.metrics.completion}% · Domínio{' '}
                          {item.metrics.mastery}%
                          {item.metrics.performance !== null
                            ? ` · ${item.metrics.performance}% acerto`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <p className="text-[13.5px] font-semibold text-[#111827]">
                        {formatMinutes(item.metrics.totalStudiedMinutes)}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {item.sharePercent}% do total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Insights Automáticos */}
        <section className="lg:col-span-5 rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="font-display text-[16px] font-semibold text-[#111827]">
                Insights da sua Jornada
              </h3>
            </div>
            <Compass className="w-4 h-4 text-[#9CA3AF]" />
          </div>

          <div className="space-y-3">
            {insights.map((ins) => {
              const style =
                ins.tone === 'positive'
                  ? 'bg-[#ECFDF3]/70 border-[#BBF7D0]/80'
                  : ins.tone === 'focus'
                    ? 'bg-[#EFF6FF]/60 border-[#BFDBFE]/80'
                    : 'bg-[#F7F7F5] border-[#EAE9E4]';
              const tagStyle =
                ins.tone === 'positive'
                  ? 'bg-white text-[#15803D]'
                  : ins.tone === 'focus'
                    ? 'bg-white text-[#1D4ED8]'
                    : 'bg-white text-[#4B5563]';

              return (
                <div
                  key={ins.id}
                  className={`rounded-2xl border p-4 transition-colors ${style}`}
                >
                  <span
                    className={`inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${tagStyle}`}
                  >
                    {ins.tag}
                  </span>
                  <h4 className="text-[13.5px] font-semibold text-[#111827] leading-snug">
                    {ins.title}
                  </h4>
                  <p className="text-[12px] text-[#4B5563] mt-1 leading-relaxed">
                    {ins.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Linha 5: Marcos Serenos (Gamificação Mínima) */}
      <section className="rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_8px_30px_rgba(30,36,48,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-[#2563EB]" />
            <h3 className="font-display text-[16px] font-semibold text-[#111827]">
              Marcos Serenos
            </h3>
          </div>
          <span className="text-[12px] font-medium text-[#6B7280] tabular-nums">
            {unlockedCount} de {milestones.length} desbloqueados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl p-4 border transition-all ${
                m.unlocked
                  ? 'bg-[#F8FAFC] border-[#BFDBFE]/80 shadow-[0_4px_16px_rgba(37,99,235,0.04)]'
                  : 'bg-[#FAFAF8] border-[#EAE9E4]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    m.unlocked
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#E5E7EB] text-[#9CA3AF]'
                  }`}
                >
                  {m.unlocked && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <span
                  className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                    m.unlocked
                      ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'bg-[#F3F4F6] text-[#6B7280]'
                  }`}
                >
                  {m.unlocked
                    ? 'Conquistado'
                    : `${Math.min(m.current, m.target)}/${m.target} ${m.unitLabel}`}
                </span>
              </div>

              <h4 className="text-[13.5px] font-semibold text-[#111827]">
                {m.title}
              </h4>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5 leading-snug">
                {m.description}
              </p>

              {!m.unlocked && (
                <div className="mt-3 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3B82F6] transition-all"
                    style={{ width: `${Math.max(4, m.progressPercent)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
