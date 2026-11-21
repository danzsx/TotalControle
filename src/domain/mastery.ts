import type {
  ContentNode,
  Discipline,
  ErrorRecord,
  SeparatedMetrics,
  SessionRecord,
} from './types';

export function flattenContents(discipline: Discipline): ContentNode[] {
  const list: ContentNode[] = [];
  for (const level of discipline.levels) {
    for (const mod of level.modules) {
      for (const content of mod.contents) {
        if (!content.deletedAt) list.push(content);
      }
    }
  }
  return list;
}

export interface ContentMetricsInput {
  node: ContentNode;
  sessions?: SessionRecord[];
  errors?: ErrorRecord[];
}

/**
 * Calcula separadamente:
 * 1. completion (0-100): conclusão estruturada do conteúdo (status + checklist).
 * 2. performance (0-100 | null): desempenho objetivo em questões (acertos / feitas).
 * 3. mastery (0-100): domínio real do conhecimento, integrando conclusão, questões,
 *    tempo de estudo ativo, taxa de superação de erros e revisões.
 */
export function calculateContentMetrics({
  node,
  sessions = [],
  errors = [],
}: ContentMetricsInput): {
  completion: number;
  performance: number | null;
  mastery: number;
  studiedMinutes: number;
  openErrors: number;
  overcomeErrors: number;
} {
  const totalSteps = node.checklist.length;
  const doneSteps = node.checklist.filter((c) => c.done).length;
  const checklistRatio = totalSteps > 0 ? doneSteps / totalSteps : 0;

  let completion = 0;
  if (node.status === 'concluido') {
    completion = 100;
  } else if (node.status === 'revisao') {
    completion = Math.max(80, Math.round(checklistRatio * 100));
  } else if (node.status === 'em_andamento') {
    completion = Math.max(15, Math.round(checklistRatio * 90));
  }

  const performance =
    node.exercisesDone > 0
      ? Math.round((node.exercisesCorrect / node.exercisesDone) * 100)
      : null;

  const linkedSessions = sessions.filter((s) => s.contentId === node.id);
  const studiedMinutes = linkedSessions.reduce(
    (acc, s) => acc + s.studiedMinutes,
    0,
  );

  const linkedErrors = errors.filter(
    (e) => e.contentId === node.id && !e.deletedAt,
  );
  const openErrors = linkedErrors.filter((e) => e.priority !== 'superado').length;
  const overcomeErrors = linkedErrors.filter(
    (e) => e.priority === 'superado',
  ).length;

  // Domínio real:
  // - Conclusão estruturada (30 pts)
  // - Aproveitamento em questões (40 pts)
  // - Volume de prática e estudo ativo (15 pts)
  // - Consolidação por revisão e resolução de erros (15 pts)
  const completionScore =
    node.status === 'concluido'
      ? 30
      : node.status === 'revisao'
        ? 25
        : checklistRatio * 20;

  const perfScore = performance !== null ? (performance / 100) * 40 : 0;
  const exerciseVolume = Math.min(1, node.exercisesDone / 10) * 8;
  const studyTimeVolume = Math.min(1, studiedMinutes / 60) * 7;

  let consolidationScore =
    (node.reviewCount > 0 ? 6 : 0) +
    (node.status === 'concluido' && (performance ?? 0) >= 75 ? 4 : 0);

  if (linkedErrors.length > 0) {
    const overcomeRatio = overcomeErrors / linkedErrors.length;
    consolidationScore += Math.round(overcomeRatio * 5);
  } else if (node.status === 'concluido') {
    consolidationScore += 5;
  }

  // Penalidade suave caso haja erros de prioridade alta ainda abertos neste conteúdo
  const highPriorityOpen = linkedErrors.filter(
    (e) => e.priority === 'alta',
  ).length;
  const openPenalty = Math.min(15, highPriorityOpen * 5);

  const mastery = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completionScore +
          perfScore +
          exerciseVolume +
          studyTimeVolume +
          consolidationScore -
          openPenalty,
      ),
    ),
  );

  return {
    completion,
    performance,
    mastery,
    studiedMinutes,
    openErrors,
    overcomeErrors,
  };
}

export function calculateDisciplineMetrics(
  discipline: Discipline,
  sessions: SessionRecord[] = [],
  errors: ErrorRecord[] = [],
): SeparatedMetrics {
  const contents = flattenContents(discipline);
  const discSessions = sessions.filter((s) => s.disciplineId === discipline.id);
  const discErrors = errors.filter(
    (e) => e.disciplineId === discipline.id && !e.deletedAt,
  );
  const totalStudiedMinutes = discSessions.reduce(
    (acc, s) => acc + s.studiedMinutes,
    0,
  );
  const openErrorsCount = discErrors.filter(
    (e) => e.priority !== 'superado',
  ).length;
  const overcomeErrorsCount = discErrors.filter(
    (e) => e.priority === 'superado',
  ).length;

  if (contents.length === 0) {
    return {
      completion: 0,
      performance: null,
      mastery: 0,
      completedCount: 0,
      inProgressCount: 0,
      reviewCount: 0,
      totalContents: 0,
      exercisesDone: 0,
      exercisesCorrect: 0,
      totalStudiedMinutes,
      openErrorsCount,
      overcomeErrorsCount,
    };
  }

  let completedCount = 0;
  let inProgressCount = 0;
  let reviewCount = 0;
  let exercisesDone = 0;
  let exercisesCorrect = 0;
  let completionSum = 0;
  let weightedMasterySum = 0;
  let weightSum = 0;

  for (const c of contents) {
    if (c.status === 'concluido') completedCount++;
    if (c.status === 'em_andamento') inProgressCount++;
    if (c.status === 'revisao' || c.markedForReview) reviewCount++;
    exercisesDone += c.exercisesDone;
    exercisesCorrect += c.exercisesCorrect;

    const cm = calculateContentMetrics({
      node: c,
      sessions: discSessions,
      errors: discErrors,
    });
    completionSum += cm.completion;
    const weight = 0.8 + c.difficulty * 0.2;
    weightSum += weight;
    weightedMasterySum += cm.mastery * weight;
  }

  const completion = Math.round(completionSum / contents.length);
  const performance =
    exercisesDone > 0 ? Math.round((exercisesCorrect / exercisesDone) * 100) : null;
  const mastery = weightSum > 0 ? Math.round(weightedMasterySum / weightSum) : 0;

  return {
    completion,
    performance,
    mastery,
    completedCount,
    inProgressCount,
    reviewCount,
    totalContents: contents.length,
    exercisesDone,
    exercisesCorrect,
    totalStudiedMinutes,
    openErrorsCount,
    overcomeErrorsCount,
  };
}

export function calculateGlobalMetrics(
  disciplines: Discipline[],
  sessions: SessionRecord[] = [],
  errors: ErrorRecord[] = [],
): SeparatedMetrics {
  const active = disciplines.filter((d) => !d.deletedAt);
  if (active.length === 0) {
    return {
      completion: 0,
      performance: null,
      mastery: 0,
      completedCount: 0,
      inProgressCount: 0,
      reviewCount: 0,
      totalContents: 0,
      exercisesDone: 0,
      exercisesCorrect: 0,
      totalStudiedMinutes: 0,
      openErrorsCount: 0,
      overcomeErrorsCount: 0,
    };
  }

  let completionSum = 0;
  let masterySum = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let reviewCount = 0;
  let totalContents = 0;
  let exercisesDone = 0;
  let exercisesCorrect = 0;
  let countedDisciplines = 0;

  for (const d of active) {
    const dm = calculateDisciplineMetrics(d, sessions, errors);
    if (dm.totalContents > 0) {
      completionSum += dm.completion;
      masterySum += dm.mastery;
      countedDisciplines++;
    }
    completedCount += dm.completedCount;
    inProgressCount += dm.inProgressCount;
    reviewCount += dm.reviewCount;
    totalContents += dm.totalContents;
    exercisesDone += dm.exercisesDone;
    exercisesCorrect += dm.exercisesCorrect;
  }

  const totalStudiedMinutes = sessions.reduce(
    (acc, s) => acc + s.studiedMinutes,
    0,
  );
  const activeErrors = errors.filter((e) => !e.deletedAt);
  const openErrorsCount = activeErrors.filter(
    (e) => e.priority !== 'superado',
  ).length;
  const overcomeErrorsCount = activeErrors.filter(
    (e) => e.priority === 'superado',
  ).length;

  return {
    completion:
      countedDisciplines > 0 ? Math.round(completionSum / countedDisciplines) : 0,
    performance:
      exercisesDone > 0 ? Math.round((exercisesCorrect / exercisesDone) * 100) : null,
    mastery:
      countedDisciplines > 0 ? Math.round(masterySum / countedDisciplines) : 0,
    completedCount,
    inProgressCount,
    reviewCount,
    totalContents,
    exercisesDone,
    exercisesCorrect,
    totalStudiedMinutes,
    openErrorsCount,
    overcomeErrorsCount,
  };
}

export interface ReviewSuggestion {
  discipline: Discipline;
  levelTitle: string;
  content: ContentNode;
  reason: string;
  urgency: 'alta' | 'suave';
}

export function getReviewSuggestions(
  disciplines: Discipline[],
  errors: ErrorRecord[] = [],
  nowMs: number = Date.now(),
): ReviewSuggestion[] {
  const suggestions: ReviewSuggestion[] = [];
  for (const d of disciplines) {
    if (d.deletedAt) continue;
    for (const level of d.levels) {
      for (const mod of level.modules) {
        for (const c of mod.contents) {
          if (c.deletedAt) continue;
          const perf =
            c.exercisesDone > 0
              ? Math.round((c.exercisesCorrect / c.exercisesDone) * 100)
              : null;
          const daysSince = c.lastStudiedAt
            ? Math.floor(
                (nowMs - new Date(c.lastStudiedAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;
          const highErrors = errors.filter(
            (e) => !e.deletedAt && e.contentId === c.id && e.priority === 'alta',
          ).length;

          if (c.markedForReview || c.status === 'revisao') {
            suggestions.push({
              discipline: d,
              levelTitle: level.title,
              content: c,
              reason: 'Marcado para revisão ativa',
              urgency: 'alta',
            });
          } else if (highErrors > 0) {
            suggestions.push({
              discipline: d,
              levelTitle: level.title,
              content: c,
              reason: `${highErrors} ${highErrors === 1 ? 'erro crítico aberto' : 'erros críticos abertos'}`,
              urgency: 'alta',
            });
          } else if (
            c.status === 'concluido' &&
            perf !== null &&
            perf < 75
          ) {
            suggestions.push({
              discipline: d,
              levelTitle: level.title,
              content: c,
              reason: `Aproveitamento em ${perf}% — vale reforçar`,
              urgency: 'alta',
            });
          } else if (
            c.status === 'concluido' &&
            daysSince !== null &&
            daysSince >= 7
          ) {
            suggestions.push({
              discipline: d,
              levelTitle: level.title,
              content: c,
              reason: `Estudado há ${daysSince} dias`,
              urgency: 'suave',
            });
          }
        }
      }
    }
  }
  return suggestions.sort((a, b) =>
    a.urgency === b.urgency ? 0 : a.urgency === 'alta' ? -1 : 1,
  );
}

export function findNextDiscovery(
  discipline: Discipline | null,
): ContentNode | null {
  if (!discipline) return null;
  const contents = flattenContents(discipline);
  return (
    contents.find((c) => c.status === 'em_andamento') ??
    contents.find((c) => c.status === 'nao_iniciado') ??
    null
  );
}

