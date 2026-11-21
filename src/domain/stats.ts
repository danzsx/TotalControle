import { formatMinutes } from './explain';
import { calculateDisciplineMetrics, calculateGlobalMetrics, flattenContents } from './mastery';
import type {
  ContentNode,
  CycleState,
  Discipline,
  ErrorOrigin,
  ErrorRecord,
  SessionRecord,
} from './types';

export type StudyUsageMode = 'integrated' | 'trails_only' | 'cycle_only' | 'empty';

export interface StudyContextSummary {
  mode: StudyUsageMode;
  hasActiveCycle: boolean;
  hasTrailContents: boolean;
  cycleDisciplineCount: number;
  totalTrailContents: number;
}

export function detectStudyContext(
  disciplines: Discipline[],
  cycleState: CycleState,
): StudyContextSummary {
  const active = disciplines.filter((d) => !d.deletedAt);
  const cycleDisciplineCount = active.filter((d) => d.inCycle).length;
  const totalTrailContents = active.reduce(
    (acc, d) => acc + flattenContents(d).length,
    0,
  );
  const hasActiveCycle =
    cycleDisciplineCount > 0 && (cycleState.plan?.blocks.length ?? 0) > 0;
  const hasTrailContents = totalTrailContents > 0;

  let mode: StudyUsageMode = 'empty';
  if (hasActiveCycle && hasTrailContents) mode = 'integrated';
  else if (hasTrailContents) mode = 'trails_only';
  else if (hasActiveCycle) mode = 'cycle_only';

  return {
    mode,
    hasActiveCycle,
    hasTrailContents,
    cycleDisciplineCount,
    totalTrailContents,
  };
}

export function findLastAccessedContent(
  disciplines: Discipline[],
): { discipline: Discipline; content: ContentNode } | null {
  let best: { discipline: Discipline; content: ContentNode; ts: number } | null =
    null;
  for (const discipline of disciplines) {
    if (discipline.deletedAt) continue;
    for (const content of flattenContents(discipline)) {
      const dateStr =
        content.lastStudiedAt ??
        (content.status !== 'nao_iniciado' ? content.updatedAt : null);
      if (!dateStr) continue;
      const ts = new Date(dateStr).getTime();
      if (!Number.isFinite(ts)) continue;
      if (!best || ts > best.ts) {
        best = { discipline, content, ts };
      }
    }
  }
  return best ? { discipline: best.discipline, content: best.content } : null;
}

export function localDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function totalStudiedMinutes(sessions: SessionRecord[]): number {
  return sessions.reduce((acc, s) => acc + s.studiedMinutes, 0);
}

export function cycleProgress(cycle: CycleState): {
  done: number;
  total: number;
  percent: number;
} {
  const total = cycle.plan?.blocks.length ?? 0;
  if (total === 0) return { done: 0, total: 0, percent: 0 };
  const done = Math.min(cycle.position, total);
  return { done, total, percent: Math.round((done / total) * 100) };
}

export function currentStreakDays(
  sessions: SessionRecord[],
  now: number = Date.now(),
): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.studiedMinutes > 0) days.add(localDateKey(s.endedAt));
  }
  if (days.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDateKey(cursor))) return 0;
  }

  while (days.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function dailyStudySeries(
  sessions: SessionRecord[],
  daysCount: number = 14,
  now: number = Date.now(),
): Array<{ dateKey: string; label: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = localDateKey(s.endedAt);
    map.set(key, (map.get(key) ?? 0) + s.studiedMinutes);
  }
  const result: Array<{ dateKey: string; label: string; minutes: number }> = [];
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (daysCount - 1));

  for (let i = 0; i < daysCount; i++) {
    const key = localDateKey(cursor);
    const label = `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    result.push({ dateKey: key, label, minutes: map.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function errorOriginDistribution(
  errors: ErrorRecord[],
): Array<{ origin: ErrorOrigin; count: number; percent: number }> {
  const active = errors.filter((e) => !e.deletedAt);
  const total = active.length;
  const counts = new Map<ErrorOrigin, number>();
  for (const e of active) {
    counts.set(e.origin, (counts.get(e.origin) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([origin, count]) => ({
      origin,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}


export function bestStreakDays(sessions: SessionRecord[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.studiedMinutes > 0) days.add(localDateKey(s.endedAt));
  }
  if (days.size === 0) return 0;

  const sorted = Array.from(days).sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    const curr = new Date(`${sorted[i]}T12:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current++;
      if (current > best) best = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return best;
}

export function studiedTodaySummary(
  sessions: SessionRecord[],
  now: number = Date.now(),
): { minutes: number; sessionsCount: number; hasStudiedToday: boolean } {
  const todayKey = localDateKey(new Date(now));
  let minutes = 0;
  let sessionsCount = 0;
  for (const s of sessions) {
    if (s.studiedMinutes > 0 && localDateKey(s.endedAt) === todayKey) {
      minutes += s.studiedMinutes;
      sessionsCount++;
    }
  }
  return {
    minutes,
    sessionsCount,
    hasStudiedToday: minutes > 0,
  };
}

export interface WeekDayStatus {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
  studied: boolean;
}

export interface WeeklySummary {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  deltaPercent: number | null;
  activeDaysThisWeek: number;
  weekDays: WeekDayStatus[];
}

const WEEKDAY_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const WEEKDAY_FULL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function weeklySummary(
  sessions: SessionRecord[],
  now: number = Date.now(),
): WeeklySummary {
  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    if (s.studiedMinutes <= 0) continue;
    const k = localDateKey(s.endedAt);
    dayMap.set(k, (dayMap.get(k) ?? 0) + s.studiedMinutes);
  }

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const todayKey = localDateKey(today);
  // 0 (Dom) -> 6, 1 (Seg) -> 0, ...
  const mondayOffset = (today.getDay() + 6) % 7;

  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const weekDays: WeekDayStatus[] = [];
  let thisWeekMinutes = 0;
  let activeDaysThisWeek = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = localDateKey(d);
    const minutes = dayMap.get(key) ?? 0;
    const isToday = key === todayKey;
    const isFuture = d.getTime() > today.getTime() && !isToday;
    const studied = minutes > 0;
    if (studied) activeDaysThisWeek++;
    thisWeekMinutes += minutes;
    weekDays.push({
      dateKey: key,
      shortLabel: WEEKDAY_SHORT[i],
      fullLabel: WEEKDAY_FULL[i],
      minutes,
      isToday,
      isFuture,
      studied,
    });
  }

  let lastWeekMinutes = 0;
  for (let i = 7; i >= 1; i--) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i);
    lastWeekMinutes += dayMap.get(localDateKey(d)) ?? 0;
  }

  let deltaPercent: number | null = null;
  if (lastWeekMinutes > 0) {
    deltaPercent = Math.round(
      ((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100,
    );
  } else if (thisWeekMinutes > 0) {
    deltaPercent = 100;
  }

  return {
    thisWeekMinutes,
    lastWeekMinutes,
    deltaPercent,
    activeDaysThisWeek,
    weekDays,
  };
}

export type TimeOfDayBucketId = 'morning' | 'afternoon' | 'night' | 'dawn';

export interface TimeOfDayBucket {
  id: TimeOfDayBucketId;
  label: string;
  rangeLabel: string;
  minutes: number;
  sessionsCount: number;
  percent: number;
}

export function timeOfDayDistribution(sessions: SessionRecord[]): {
  buckets: TimeOfDayBucket[];
  peakBucket: TimeOfDayBucket | null;
} {
  const defs: Array<{
    id: TimeOfDayBucketId;
    label: string;
    rangeLabel: string;
  }> = [
    { id: 'morning', label: 'Manhã', rangeLabel: '05h–11h' },
    { id: 'afternoon', label: 'Tarde', rangeLabel: '12h–17h' },
    { id: 'night', label: 'Noite', rangeLabel: '18h–23h' },
    { id: 'dawn', label: 'Madrugada', rangeLabel: '00h–04h' },
  ];

  const mins: Record<TimeOfDayBucketId, number> = {
    morning: 0,
    afternoon: 0,
    night: 0,
    dawn: 0,
  };
  const counts: Record<TimeOfDayBucketId, number> = {
    morning: 0,
    afternoon: 0,
    night: 0,
    dawn: 0,
  };

  let totalMinutes = 0;
  for (const s of sessions) {
    if (s.studiedMinutes <= 0) continue;
    const hour = new Date(s.startedAt).getHours();
    let id: TimeOfDayBucketId = 'night';
    if (hour >= 5 && hour < 12) id = 'morning';
    else if (hour >= 12 && hour < 18) id = 'afternoon';
    else if (hour >= 18) id = 'night';
    else id = 'dawn';

    mins[id] += s.studiedMinutes;
    counts[id] += 1;
    totalMinutes += s.studiedMinutes;
  }

  const buckets: TimeOfDayBucket[] = defs.map((d) => ({
    ...d,
    minutes: mins[d.id],
    sessionsCount: counts[d.id],
    percent: totalMinutes > 0 ? Math.round((mins[d.id] / totalMinutes) * 100) : 0,
  }));

  const sorted = [...buckets].sort((a, b) => b.minutes - a.minutes);
  const peakBucket = sorted[0] && sorted[0].minutes > 0 ? sorted[0] : null;

  return { buckets, peakBucket };
}

export function sessionOriginBreakdown(sessions: SessionRecord[]): {
  cycleMinutes: number;
  trailMinutes: number;
  cycleSessions: number;
  trailSessions: number;
  cyclePercent: number;
  trailPercent: number;
} {
  let cycleMinutes = 0;
  let trailMinutes = 0;
  let cycleSessions = 0;
  let trailSessions = 0;

  for (const s of sessions) {
    if (s.status === 'skipped' && s.studiedMinutes === 0) continue;
    if (s.origin === 'trilha') {
      trailMinutes += s.studiedMinutes;
      trailSessions++;
    } else {
      cycleMinutes += s.studiedMinutes;
      cycleSessions++;
    }
  }

  const total = cycleMinutes + trailMinutes;
  return {
    cycleMinutes,
    trailMinutes,
    cycleSessions,
    trailSessions,
    cyclePercent: total > 0 ? Math.round((cycleMinutes / total) * 100) : 0,
    trailPercent: total > 0 ? Math.round((trailMinutes / total) * 100) : 0,
  };
}

export interface HeatmapCell {
  dateKey: string;
  label: string;
  minutes: number;
  sessionsCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

export function heatmapSeries(
  sessions: SessionRecord[],
  weeks: number = 16,
  now: number = Date.now(),
): {
  columns: HeatmapCell[][];
  activeDaysCount: number;
  totalMinutesInWindow: number;
} {
  const minMap = new Map<string, number>();
  const countMap = new Map<string, number>();
  for (const s of sessions) {
    if (s.studiedMinutes <= 0) continue;
    const key = localDateKey(s.endedAt);
    minMap.set(key, (minMap.get(key) ?? 0) + s.studiedMinutes);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - mondayOffset);

  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - (weeks - 1) * 7);

  // Determinar quartis simples com base nos dias ativos da janela
  const windowMins: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startMonday);
    d.setDate(startMonday.getDate() + i);
    const m = minMap.get(localDateKey(d)) ?? 0;
    if (m > 0) windowMins.push(m);
  }
  const maxMin = Math.max(60, ...windowMins);

  const columns: HeatmapCell[][] = [];
  let activeDaysCount = 0;
  let totalMinutesInWindow = 0;

  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const d = new Date(startMonday);
      d.setDate(startMonday.getDate() + w * 7 + dIdx);
      const dateKey = localDateKey(d);
      const isFuture = d.getTime() > today.getTime();
      const minutes = isFuture ? 0 : (minMap.get(dateKey) ?? 0);
      const sessionsCount = isFuture ? 0 : (countMap.get(dateKey) ?? 0);
      if (minutes > 0) {
        activeDaysCount++;
        totalMinutesInWindow += minutes;
      }

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (minutes > 0) {
        const ratio = minutes / maxMin;
        if (ratio >= 0.75) level = 4;
        else if (ratio >= 0.45) level = 3;
        else if (ratio >= 0.2) level = 2;
        else level = 1;
      }

      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      col.push({ dateKey, label, minutes, sessionsCount, level, isFuture });
    }
    columns.push(col);
  }

  return { columns, activeDaysCount, totalMinutesInWindow };
}

export interface JourneyLevelInfo {
  level: number;
  title: string;
  nextTitle: string | null;
  points: number;
  levelFloorPoints: number;
  nextLevelPoints: number | null;
  progressPercent: number;
}

const JOURNEY_LEVELS: Array<{ minPoints: number; title: string }> = [
  { minPoints: 0, title: 'Observador' },
  { minPoints: 80, title: 'Iniciado' },
  { minPoints: 220, title: 'Explorador' },
  { minPoints: 450, title: 'Cartógrafo' },
  { minPoints: 800, title: 'Construtor' },
  { minPoints: 1300, title: 'Estrategista' },
  { minPoints: 2000, title: 'Artífice' },
  { minPoints: 3000, title: 'Erudito' },
  { minPoints: 4400, title: 'Sábio' },
  { minPoints: 6200, title: 'Mestre' },
];

export function calculateJourneyLevel(
  disciplines: Discipline[],
  sessions: SessionRecord[],
  errors: ErrorRecord[],
  cycleState: CycleState,
): JourneyLevelInfo {
  const global = calculateGlobalMetrics(disciplines, sessions, errors);
  const activeErrors = errors.filter((e) => !e.deletedAt);
  const overcomeErrors = activeErrors.filter((e) => e.priority === 'superado').length;

  const points =
    Math.floor(global.totalStudiedMinutes / 5) +
    global.completedCount * 40 +
    global.exercisesDone * 2 +
    global.exercisesCorrect +
    overcomeErrors * 25 +
    cycleState.completedCycles * 60;

  let idx = 0;
  for (let i = JOURNEY_LEVELS.length - 1; i >= 0; i--) {
    if (points >= JOURNEY_LEVELS[i].minPoints) {
      idx = i;
      break;
    }
  }

  const current = JOURNEY_LEVELS[idx];
  const next = JOURNEY_LEVELS[idx + 1] ?? null;
  const progressPercent = next
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((points - current.minPoints) / (next.minPoints - current.minPoints)) *
              100,
          ),
        ),
      )
    : 100;

  return {
    level: idx + 1,
    title: current.title,
    nextTitle: next ? next.title : null,
    points,
    levelFloorPoints: current.minPoints,
    nextLevelPoints: next ? next.minPoints : null,
    progressPercent,
  };
}

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  current: number;
  target: number;
  unitLabel: string;
  progressPercent: number;
}

export function computeMilestones(
  disciplines: Discipline[],
  sessions: SessionRecord[],
  errors: ErrorRecord[],
  cycleState: CycleState,
  now: number = Date.now(),
): MilestoneBadge[] {
  const global = calculateGlobalMetrics(disciplines, sessions, errors);
  const bestStreak = Math.max(
    currentStreakDays(sessions, now),
    bestStreakDays(sessions),
  );
  const overcomeErrors = errors.filter(
    (e) => !e.deletedAt && e.priority === 'superado',
  ).length;

  const defs: Array<{
    id: string;
    title: string;
    description: string;
    current: number;
    target: number;
    unitLabel: string;
  }> = [
    {
      id: 'first_hour',
      title: 'Primeira Hora',
      description: 'Acumule 60 minutos de estudo focado.',
      current: global.totalStudiedMinutes,
      target: 60,
      unitLabel: 'min',
    },
    {
      id: 'streak_7',
      title: 'Ritmo Semanal',
      description: 'Estude por 7 dias consecutivos.',
      current: bestStreak,
      target: 7,
      unitLabel: 'dias',
    },
    {
      id: 'first_card',
      title: 'Primeira Carta',
      description: 'Conclua seu primeiro conteúdo na trilha.',
      current: global.completedCount,
      target: 1,
      unitLabel: 'conteúdo',
    },
    {
      id: 'deep_10h',
      title: '10 Horas de Foco',
      description: 'Alcance 10 horas totais de estudo.',
      current: Math.floor(global.totalStudiedMinutes / 60),
      target: 10,
      unitLabel: 'h',
    },
    {
      id: 'questions_50',
      title: 'Prática Consistente',
      description: 'Resolva 50 questões ao longo das trilhas.',
      current: global.exercisesDone,
      target: 50,
      unitLabel: 'questões',
    },
    {
      id: 'error_overcome',
      title: 'Ciclo de Superação',
      description: 'Supere 5 erros no Caderno de Erros.',
      current: overcomeErrors,
      target: 5,
      unitLabel: 'erros',
    },
    {
      id: 'first_cycle',
      title: 'Ciclo Completo',
      description: 'Feche 1 ciclo completo de estudos.',
      current: cycleState.completedCycles,
      target: 1,
      unitLabel: 'ciclo',
    },
    {
      id: 'master_50h',
      title: 'Jornada de 50h',
      description: 'Construa 50 horas de dedicação acumulada.',
      current: Math.floor(global.totalStudiedMinutes / 60),
      target: 50,
      unitLabel: 'h',
    },
  ];

  return defs.map((d) => ({
    ...d,
    unlocked: d.current >= d.target,
    progressPercent: Math.min(100, Math.round((d.current / d.target) * 100)),
  }));
}

export interface UserInsight {
  id: string;
  tone: 'positive' | 'focus' | 'neutral';
  title: string;
  description: string;
  tag: string;
}

export function generateUserInsights(
  disciplines: Discipline[],
  sessions: SessionRecord[],
  errors: ErrorRecord[],
  now: number = Date.now(),
): UserInsight[] {
  const insights: UserInsight[] = [];
  const activeDisciplines = disciplines.filter((d) => !d.deletedAt);
  const global = calculateGlobalMetrics(activeDisciplines, sessions, errors);
  const streak = currentStreakDays(sessions, now);
  const best = bestStreakDays(sessions);
  const today = studiedTodaySummary(sessions, now);
  const { peakBucket } = timeOfDayDistribution(sessions);
  const week = weeklySummary(sessions, now);

  if (sessions.length === 0) {
    insights.push({
      id: 'welcome',
      tone: 'neutral',
      tag: 'Começo',
      title: 'Sua jornada começa no primeiro bloco',
      description:
        'Registre sua primeira sessão no Ciclo de Estudos ou na Trilha para desbloquear mapas de ritmo, horários de pico e insights personalizados.',
    });
    return insights;
  }

  // 1. Melhor horário
  if (peakBucket && peakBucket.percent > 0) {
    insights.push({
      id: 'peak-window',
      tone: 'positive',
      tag: 'Ritmo circadiano',
      title: `Seu pico de foco é pela ${peakBucket.label}`,
      description: `${peakBucket.percent}% do seu tempo de estudo (${formatMinutes(peakBucket.minutes)}) acontece entre ${peakBucket.rangeLabel}. Reserve tópicos mais densos para essa janela.`,
    });
  }

  // 2. Sequência & consistência semanal
  if (streak > 0 && !today.hasStudiedToday) {
    insights.push({
      id: 'streak-protect',
      tone: 'focus',
      tag: 'Sequência ativa',
      title: `Mantenha sua sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`,
      description:
        'Você ainda não registrou minutos hoje. Mesmo uma sessão curta de 15 minutos preserva seu ritmo contínuo.',
    });
  } else if (streak >= 3) {
    insights.push({
      id: 'streak-strong',
      tone: 'positive',
      tag: 'Consistência',
      title: `${streak} dias seguidos de constância`,
      description:
        streak >= best
          ? `Você está no seu recorde pessoal (${best} dias) e já acumulou ${formatMinutes(week.thisWeekMinutes)} nesta semana.`
          : `Faltam ${best - streak} ${best - streak === 1 ? 'dia' : 'dias'} para igualar seu recorde de ${best} dias seguidos.`,
    });
  }

  // 3. Equilíbrio entre disciplinas (destaque vs atenção)
  if (activeDisciplines.length >= 2) {
    const withMetrics = activeDisciplines.map((d) => ({
      discipline: d,
      metrics: calculateDisciplineMetrics(d, sessions, errors),
    }));

    const attention = [...withMetrics].sort((a, b) => {
      const scoreA = a.metrics.openErrorsCount * 15 - a.metrics.mastery;
      const scoreB = b.metrics.openErrorsCount * 15 - b.metrics.mastery;
      return scoreB - scoreA;
    })[0];

    if (
      attention &&
      (attention.metrics.openErrorsCount > 0 || attention.metrics.mastery < 40)
    ) {
      insights.push({
        id: 'discipline-attention',
        tone: 'focus',
        tag: 'Ponto de atenção',
        title: `${attention.discipline.name} pede um pouco mais de carinho`,
        description:
          attention.metrics.openErrorsCount > 0
            ? `Há ${attention.metrics.openErrorsCount} ${attention.metrics.openErrorsCount === 1 ? 'erro em aberto' : 'erros em aberto'} e domínio atual de ${attention.metrics.mastery}%. Uma revisão direcionada aqui gera alto retorno.`
            : `Domínio atual em ${attention.metrics.mastery}% com ${formatMinutes(attention.metrics.totalStudiedMinutes)} estudados. Que tal avançar um tópico da trilha?`,
      });
    }
  }

  // 4. Questões e Caderno de Erros
  const activeErrors = errors.filter((e) => !e.deletedAt);
  const overcome = activeErrors.filter((e) => e.priority === 'superado').length;
  if (global.exercisesDone >= 10 && global.performance !== null) {
    insights.push({
      id: 'accuracy',
      tone: global.performance >= 75 ? 'positive' : 'neutral',
      tag: 'Desempenho',
      title: `${global.performance}% de aproveitamento em ${global.exercisesDone} questões`,
      description:
        activeErrors.length > 0
          ? `Você já superou ${overcome} de ${activeErrors.length} registros no Caderno de Erros (${Math.round((overcome / activeErrors.length) * 100)}% de resolução).`
          : 'Continue registrando seus erros difíceis para transformar pontos fracos em domínio sólido.',
    });
  }

  return insights.slice(0, 4);
}
