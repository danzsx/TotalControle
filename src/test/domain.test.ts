import { describe, expect, it } from 'vitest';
import { DEFAULT_CYCLE_SETTINGS } from '../domain/constants';
import { computePlan } from '../domain/distribution';
import { calculateContentMetrics } from '../domain/mastery';
import { createCustomDiscipline, defaultChecklist } from '../domain/prebuiltTrails';
import {
  bestStreakDays,
  calculateJourneyLevel,
  computeMilestones,
  currentStreakDays,
  detectStudyContext,
  findLastAccessedContent,
  generateUserInsights,
  heatmapSeries,
  timeOfDayDistribution,
  weeklySummary,
} from '../domain/stats';
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_HEARTBEAT_MS,
  elapsedMs,
  heartbeat,
  pauseTimer,
  restoreSession,
  resumeTimer,
} from '../domain/timer';
import type { ActiveSession, ContentNode, ErrorRecord, SessionRecord } from '../domain/types';

describe('Ciclo — Algoritmo de Distribuição', () => {
  it('distribui exatamente o tempo total do ciclo e intercala sem repetições consecutivas', () => {
    const d1 = createCustomDiscipline({ name: 'Direito', description: '', theme: 'deep', weight: 5, difficulty: 'hard' });
    const d2 = createCustomDiscipline({ name: 'Português', description: '', theme: 'lavender', weight: 3, difficulty: 'medium' });
    const d3 = createCustomDiscipline({ name: 'Matemática', description: '', theme: 'sky', weight: 2, difficulty: 'easy' });

    const plan = computePlan([d1, d2, d3], DEFAULT_CYCLE_SETTINGS);

    const totalBlockMinutes = plan.blocks.reduce((acc, b) => acc + b.plannedMinutes, 0);
    expect(totalBlockMinutes).toBe(DEFAULT_CYCLE_SETTINGS.cycleMinutes);

    // Ordem de tempo respeita score: d1 >= d2 >= d3
    const m1 = plan.allocations.find((a) => a.disciplineId === d1.id)!.minutes;
    const m2 = plan.allocations.find((a) => a.disciplineId === d2.id)!.minutes;
    const m3 = plan.allocations.find((a) => a.disciplineId === d3.id)!.minutes;
    expect(m1).toBeGreaterThanOrEqual(m2);
    expect(m2).toBeGreaterThanOrEqual(m3);

    // Sem repetições consecutivas
    for (let i = 1; i < plan.blocks.length; i++) {
      expect(plan.blocks[i].disciplineId).not.toBe(plan.blocks[i - 1].disciplineId);
    }
  });
});

describe('Ciclo — Cronômetro Baseado em Timestamp & Recuperação', () => {
  it('acumula tempo corretamente entre pausas e recupera sessão após queda', () => {
    const base: ActiveSession = {
      id: 'sess_1',
      disciplineId: 'disc_1',
      disciplineName: 'Matemática',
      contentId: 'cnt_1',
      contentTitle: 'Frações',
      blockIndex: 0,
      cycleNumber: 1,
      plannedMinutes: 50,
      status: 'running',
      startedAt: new Date(1000).toISOString(),
      accumulatedMs: 0,
      lastResumedAt: 1000,
      lastHeartbeatAt: 1000,
      notes: '',
    };

    expect(elapsedMs(base, 31_000)).toBe(30_000);
    const paused = pauseTimer(base, 31_000);
    expect(paused.status).toBe('paused');
    expect(elapsedMs(paused, 90_000)).toBe(30_000);

    const resumed = resumeTimer(paused, 100_000);
    const beaten = heartbeat(resumed, 100_000 + HEARTBEAT_INTERVAL_MS);
    expect(elapsedMs(beaten, 120_000)).toBe(50_000);

    // Simula app fechado por mais tempo que STALE_HEARTBEAT_MS
    const restored = restoreSession(
      beaten,
      100_000 + HEARTBEAT_INTERVAL_MS + STALE_HEARTBEAT_MS + 10_000,
    );
    expect(restored.recovered).toBe(true);
    expect(restored.session.status).toBe('paused');
    expect(restored.session.accumulatedMs).toBe(30_000 + HEARTBEAT_INTERVAL_MS);
  });
});

describe('Domínio Unificado — Separação Conclusão, Desempenho e Domínio Real', () => {
  it('separa conclusão de conteúdo, acerto em questões e domínio real ponderado por erros e estudo', () => {
    const node: ContentNode = {
      id: 'cnt_1',
      disciplineId: 'disc_1',
      levelId: 'lvl_1',
      moduleId: 'mod_1',
      title: 'Atos Administrativos',
      description: '',
      sortOrder: 0,
      status: 'concluido',
      checklist: defaultChecklist().map((c) => ({ ...c, done: true })),
      completedAt: new Date().toISOString(),
      exercisesDone: 10,
      exercisesCorrect: 8,
      difficulty: 3,
      markedForReview: false,
      reviewCount: 1,
      lastStudiedAt: new Date().toISOString(),
      notes: '',
      difficulties: '',
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      syncStatus: 'pending',
    };

    const session: SessionRecord = {
      id: 's1',
      disciplineId: 'disc_1',
      disciplineName: 'Direito',
      disciplineTheme: 'sage',
      contentId: 'cnt_1',
      contentTitle: 'Atos Administrativos',
      cycleNumber: 1,
      blockIndex: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      plannedMinutes: 50,
      studiedMinutes: 60,
      status: 'completed',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const openError: ErrorRecord = {
      id: 'e1',
      disciplineId: 'disc_1',
      contentId: 'cnt_1',
      description: 'Confundiu anulação com revogação',
      correction: 'Anulação = ilegalidade; revogação = mérito.',
      prevention: '',
      priority: 'alta',
      origin: 'confusao',
      registrationDate: '18/11/2026',
      overcomeAt: null,
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      syncStatus: 'pending',
    };

    const withOpenErr = calculateContentMetrics({
      node,
      sessions: [session],
      errors: [openError],
    });
    expect(withOpenErr.completion).toBe(100);
    expect(withOpenErr.performance).toBe(80);
    expect(withOpenErr.openErrors).toBe(1);

    const withOvercomeErr = calculateContentMetrics({
      node,
      sessions: [session],
      errors: [{ ...openError, priority: 'superado', overcomeAt: new Date().toISOString() }],
    });
    expect(withOvercomeErr.mastery).toBeGreaterThan(withOpenErr.mastery);
  });
});

describe('Independência Trilhas vs Ciclo — Contexto e Último Conteúdo', () => {
  it('detecta corretamente os modos trails_only, cycle_only, integrated e empty', () => {
    const discWithContent = createCustomDiscipline({
      name: 'Português',
      description: '',
      theme: 'lavender',
      inCycle: false,
    });
    discWithContent.levels[0].modules[0].contents.push({
      id: 'cnt_regencia',
      disciplineId: discWithContent.id,
      levelId: discWithContent.levels[0].id,
      moduleId: discWithContent.levels[0].modules[0].id,
      title: 'Regência Verbal',
      description: '',
      sortOrder: 0,
      status: 'em_andamento',
      checklist: defaultChecklist(),
      completedAt: null,
      exercisesDone: 0,
      exercisesCorrect: 0,
      difficulty: 2,
      markedForReview: false,
      reviewCount: 0,
      lastStudiedAt: '2026-11-18T10:00:00.000Z',
      notes: '',
      difficulties: '',
      history: [],
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
    });

    const emptyCycleState = {
      plan: computePlan([discWithContent], DEFAULT_CYCLE_SETTINGS),
      position: 0,
      cycleNumber: 1,
      completedCycles: 0,
    };

    expect(detectStudyContext([discWithContent], emptyCycleState).mode).toBe(
      'trails_only',
    );
    expect(findLastAccessedContent([discWithContent])?.content.id).toBe(
      'cnt_regencia',
    );

    const cycleOnlyDisc = createCustomDiscipline({
      name: 'Direito',
      description: '',
      theme: 'deep',
      inCycle: true,
    });
    const activeCycleState = {
      plan: computePlan([cycleOnlyDisc], DEFAULT_CYCLE_SETTINGS),
      position: 0,
      cycleNumber: 1,
      completedCycles: 0,
    };
    expect(detectStudyContext([cycleOnlyDisc], activeCycleState).mode).toBe(
      'cycle_only',
    );

    expect(
      detectStudyContext([discWithContent, cycleOnlyDisc], activeCycleState).mode,
    ).toBe('integrated');

    expect(
      detectStudyContext([], {
        plan: null,
        position: 0,
        cycleNumber: 1,
        completedCycles: 0,
      }).mode,
    ).toBe('empty');
  });
});


describe('Estatísticas do Usuário — Streak, Gamificação e Insights', () => {
  const makeSession = (
    id: string,
    daysAgo: number,
    hour: number,
    minutes: number,
    nowMs: number,
    origin: 'ciclo' | 'trilha' = 'ciclo',
  ): SessionRecord => {
    const start = new Date(nowMs);
    start.setDate(start.getDate() - daysAgo);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    return {
      id,
      origin,
      disciplineId: 'disc_1',
      disciplineName: 'Matemática',
      disciplineTheme: 'sky',
      contentId: null,
      contentTitle: null,
      cycleNumber: 1,
      blockIndex: 0,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      plannedMinutes: 50,
      studiedMinutes: minutes,
      status: 'completed',
      notes: '',
      createdAt: end.toISOString(),
      updatedAt: end.toISOString(),
      syncStatus: 'pending',
    };
  };

  it('calcula streak atual, melhor streak, distribuição por período e heatmap', () => {
    const now = new Date('2026-11-19T14:00:00').getTime();
    const sessions: SessionRecord[] = [
      // Sequência antiga de 4 dias (10..13 dias atrás)
      makeSession('s1', 13, 9, 45, now),
      makeSession('s2', 12, 9, 50, now),
      makeSession('s3', 11, 10, 40, now),
      makeSession('s4', 10, 8, 60, now),
      // Sequência atual de 2 dias (ontem e hoje)
      makeSession('s5', 1, 9, 30, now),
      makeSession('s6', 0, 9, 45, now, 'trilha'),
    ];

    expect(currentStreakDays(sessions, now)).toBe(2);
    expect(bestStreakDays(sessions)).toBe(4);

    const week = weeklySummary(sessions, now);
    expect(week.thisWeekMinutes).toBeGreaterThanOrEqual(75);
    expect(week.weekDays).toHaveLength(7);

    const tod = timeOfDayDistribution(sessions);
    expect(tod.peakBucket?.id).toBe('morning');
    expect(tod.peakBucket?.percent).toBe(100);

    const heat = heatmapSeries(sessions, 4, now);
    expect(heat.columns).toHaveLength(4);
    expect(heat.activeDaysCount).toBe(6);
  });

  it('calcula nível da jornada, marcos serenos e insights sem erros', () => {
    const now = new Date('2026-11-19T14:00:00').getTime();
    const d1 = createCustomDiscipline({
      name: 'Português',
      description: '',
      theme: 'lavender',
    });
    const sessions = [makeSession('s1', 0, 10, 70, now)];
    const cycleState = {
      plan: null,
      position: 0,
      cycleNumber: 1,
      completedCycles: 1,
    };

    const level = calculateJourneyLevel([d1], sessions, [], cycleState);
    expect(level.level).toBeGreaterThanOrEqual(1);
    expect(level.points).toBeGreaterThan(0);

    const milestones = computeMilestones([d1], sessions, [], cycleState, now);
    expect(milestones.find((m) => m.id === 'first_hour')?.unlocked).toBe(true);
    expect(milestones.find((m) => m.id === 'first_cycle')?.unlocked).toBe(true);

    const insights = generateUserInsights([d1], sessions, [], now);
    expect(insights.length).toBeGreaterThan(0);
  });
});
