import { BACKUP_FORMAT_VERSION, DEFAULT_CYCLE_SETTINGS, DEFAULT_EXAM_ID } from './constants';
import { normalizeText, uid } from './text';
import type {
  BackupPayload,
  ContentNode,
  CycleBlock,
  CyclePlan,
  CycleSettings,
  CycleState,
  Difficulty,
  Discipline,
  DisciplineTheme,
  ErrorOrigin,
  ErrorRecord,
  ErrorReviewEntry,
  OperationLog,
  PriorityLevel,
  SessionRecord,
  SessionStatus,
  SubjectAllocation,
} from './types';

export function disciplineNamesMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  if (
    (na === 'lingua portuguesa' && nb === 'portugues') ||
    (na === 'portugues' && nb === 'lingua portuguesa')
  ) {
    return true;
  }
  return false;
}

export function mapColorToTheme(
  color?: string | null,
  fallbackIndex = 0,
): DisciplineTheme {
  const THEMES: DisciplineTheme[] = [
    'sky',
    'deep',
    'lavender',
    'sage',
    'gold',
    'rose',
  ];
  if (!color || typeof color !== 'string') {
    return THEMES[fallbackIndex % THEMES.length];
  }

  const c = color.trim().toLowerCase();

  // Mapeamentos específicos por cor conhecida
  if (c === '#5c64e8') return 'sky';
  if (c === '#f7a072') return 'gold';
  if (c === '#1e555c') return 'deep';
  if (c === '#529e7e') return 'sage';

  if (c.includes('blue') || c.includes('azul')) return 'sky';
  if (c.includes('orange') || c.includes('laranja') || c.includes('amber')) {
    return 'gold';
  }
  if (c.includes('teal') || c.includes('dark') || c.includes('navy')) {
    return 'deep';
  }
  if (c.includes('green') || c.includes('verde')) return 'sage';
  if (c.includes('purple') || c.includes('violet') || c.includes('roxo')) {
    return 'lavender';
  }
  if (c.includes('rose') || c.includes('pink') || c.includes('rosa') || c.includes('red')) {
    return 'rose';
  }

  // Parse hexadecimal
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (c.length === 7) {
      r = parseInt(c.slice(1, 3), 16) || 0;
      g = parseInt(c.slice(3, 5), 16) || 0;
      b = parseInt(c.slice(5, 7), 16) || 0;
    } else {
      r = parseInt(c[1] + c[1], 16) || 0;
      g = parseInt(c[2] + c[2], 16) || 0;
      b = parseInt(c[3] + c[3], 16) || 0;
    }

    if (g > r + 20 && g > b) return 'sage';
    if (r > 180 && g > 110 && b < 140) return 'gold';
    if (r > g + 40 && r > b + 20) return 'rose';
    if (b > 150 && r > 80 && g < 130) return 'lavender';
    if (b > r && b > g) return 'sky';
    if (r < 70 && g < 110 && b < 130) return 'deep';
  }

  return THEMES[fallbackIndex % THEMES.length];
}

function convertErrataBackup(raw: any): BackupPayload {
  const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
  const now = new Date().toISOString();
  const exportedAt = raw.exportedAt || now;

  const rawSubjects = Array.isArray(data.subjects) ? data.subjects : [];
  const rawTopics = Array.isArray(data.topics) ? data.topics : [];
  const rawErrors = Array.isArray(data.errors) ? data.errors : [];

  const THEME_ORDER: DisciplineTheme[] = [
    'gold',
    'sage',
    'sky',
    'deep',
    'lavender',
    'rose',
  ];

  const topicsBySubject = new Map<string, any[]>();
  for (const t of rawTopics) {
    if (!t || !t.id || !t.subjectId) continue;
    const list = topicsBySubject.get(t.subjectId) ?? [];
    list.push(t);
    topicsBySubject.set(t.subjectId, list);
  }

  const disciplines: Discipline[] = [];
  rawSubjects.forEach((s: any, idx: number) => {
    if (!s || !s.id) return;
    const levelId = `lvl_${s.id}`;
    const moduleId = `mod_${s.id}`;
    const subTopics = topicsBySubject.get(s.id) ?? [];

    const contents: ContentNode[] = subTopics.map((t: any, tIdx: number) => ({
      id: t.id,
      disciplineId: s.id,
      levelId,
      moduleId,
      title: t.name || `Tópico ${tIdx + 1}`,
      description: 'Tópico importado do Caderno de Erros (ERRATA).',
      sortOrder: tIdx,
      status: 'em_andamento',
      checklist: [],
      completedAt: null,
      exercisesDone: 0,
      exercisesCorrect: 0,
      difficulty: 2,
      markedForReview: false,
      reviewCount: 0,
      lastStudiedAt: null,
      notes: '',
      difficulties: '',
      history: [],
      createdAt: t.createdAt || s.createdAt || now,
      updatedAt: t.createdAt || s.createdAt || now,
      deletedAt: null,
      syncStatus: 'pending',
    }));

    disciplines.push({
      id: s.id,
      examId: DEFAULT_EXAM_ID,
      name: s.name?.trim() || `Disciplina ${idx + 1}`,
      description: '',
      theme: THEME_ORDER[idx % THEME_ORDER.length],
      icon: 'BookOpen',
      sortOrder: idx,
      inCycle: false,
      weight: 3,
      difficulty: 'medium',
      sessionMinutesOverride: null,
      adjustment: 1,
      levels: [
        {
          id: levelId,
          disciplineId: s.id,
          title: 'Nível 1 — Fundamentos',
          subtitle: 'Conteúdos do Caderno de Erros',
          landscapeName: 'Ponto de Partida',
          sortOrder: 0,
          modules: [
            {
              id: moduleId,
              levelId,
              disciplineId: s.id,
              title: 'Módulo Geral',
              sortOrder: 0,
              contents,
            },
          ],
        },
      ],
      createdAt: s.createdAt || now,
      updatedAt: s.createdAt || now,
      deletedAt: null,
      syncStatus: 'pending',
    });
  });

  const errors: ErrorRecord[] = rawErrors
    .filter((e: any) => e && e.id && e.subjectId && e.topicId)
    .map((e: any) => {
      const priority: PriorityLevel =
        e.priority === 'alta' || e.priority === 'superado'
          ? e.priority
          : 'media';
      const validOrigins: ErrorOrigin[] = [
        'desconhecimento',
        'confusao',
        'esquecimento',
        'interpretacao',
        'nao_classificado',
      ];
      const origin: ErrorOrigin = validOrigins.includes(e.origin)
        ? e.origin
        : 'nao_classificado';

      const reviewHistory: ErrorReviewEntry[] = Array.isArray(e.reviewHistory)
        ? e.reviewHistory.map((r: any) => ({
            id: r.id || uid('rev'),
            errorId: e.id,
            timestamp: r.timestamp || now,
            previousPriority:
              r.previousPriority === 'alta' || r.previousPriority === 'superado'
                ? r.previousPriority
                : 'media',
            newPriority:
              r.newPriority === 'alta' || r.newPriority === 'superado'
                ? r.newPriority
                : 'media',
            action:
              typeof r.action === 'string' && r.action.toLowerCase().includes('reabertura')
                ? 'reabertura'
                : 'revisao_2_ciclo',
            notes: typeof r.action === 'string' ? r.action : r.notes,
          }))
        : [];

      return {
        id: e.id,
        disciplineId: e.subjectId,
        contentId: e.topicId,
        description: e.description || '',
        correction: e.correction || '',
        prevention: e.prevention || '',
        priority,
        origin,
        referenceQuestion: e.referenceQuestion
          ? {
              questionNumber: e.referenceQuestion.questionNumber,
              examBoard: e.referenceQuestion.examBoard,
              link: e.referenceQuestion.link,
            }
          : undefined,
        registrationDate: e.registrationDate || '',
        overcomeAt: e.overcomeAt ?? null,
        reviewHistory,
        createdAt: e.createdAt || now,
        updatedAt: e.updatedAt || now,
        deletedAt: null,
        syncStatus: 'pending',
      };
    });

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appName: 'TotalControle',
    exportedAt,
    userName: 'Estudante',
    disciplines,
    cycleSettings: { ...DEFAULT_CYCLE_SETTINGS },
    cycleState: {
      plan: null,
      position: 0,
      cycleNumber: 1,
      completedCycles: 0,
    },
    sessions: [],
    errors,
    operationLogs: [
      {
        id: uid('log'),
        entityType: 'backup',
        entityId: 'migracao_errata',
        disciplineId: null,
        contentId: null,
        action: 'migracao_errata',
        summary: `Migração do Caderno de Erros (ERRATA): ${disciplines.length} disciplinas, ${rawTopics.length} tópicos e ${errors.length} erros importados.`,
        metadataJson: JSON.stringify({
          sourceApp: raw.appName || 'ERRATA',
          errorsCount: errors.length,
          topicsCount: rawTopics.length,
        }),
        timestamp: now,
        syncStatus: 'pending',
      },
    ],
  };
}

/**
 * Normaliza qualquer backup (formato nativo TotalControle, legado 'ciclo' ou 'ERRATA')
 * para a estrutura oficial BackupPayload consumível pelo SQLite do TotalControle.
 */
export function normalizeBackupPayload(rawJsonOrObj: string | unknown): BackupPayload | null {
  let raw: any;
  if (typeof rawJsonOrObj === 'string') {
    try {
      raw = JSON.parse(rawJsonOrObj);
    } catch {
      return null;
    }
  } else {
    raw = rawJsonOrObj;
  }

  if (!raw || typeof raw !== 'object') return null;

  // 1. Já está no formato nativo do TotalControle
  if (raw.appName === 'TotalControle' && Array.isArray(raw.disciplines)) {
    const payload = raw as BackupPayload;
    return {
      ...payload,
      disciplines: payload.disciplines.map((d) => ({
        ...d,
        examId: d.examId || DEFAULT_EXAM_ID,
      })),
    };
  }

  const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;

  // 2. Backup legado do ERRATA (Caderno de Erros)
  const isErrata =
    (typeof raw.appName === 'string' &&
      raw.appName.toUpperCase().includes('ERRATA')) ||
    (Array.isArray(data.errors) && Array.isArray(data.topics));

  if (isErrata) {
    return convertErrataBackup(raw);
  }

  // 3. Extrai dados do formato legado (ciclo / backup v1, v2, v3)
  const isLegacy =
    raw.app === 'ciclo' ||
    raw.kind === 'backup' ||
    Array.isArray(data.subjects) ||
    Array.isArray(data.courses) ||
    Array.isArray(data.history);

  if (!isLegacy) {
    return null;
  }

  const now = new Date().toISOString();
  const exportedAt = raw.exportedAt || data.meta?.updatedAt || now;

  // Coleta todas as matérias únicas de cursos, subjects e histórico
  const subjectMap = new Map<
    string,
    {
      id: string;
      name: string;
      color?: string;
      weight?: number;
      difficulty?: Difficulty;
      sessionMinutes?: number | null;
      adjustment?: number;
      createdAt?: string;
      updatedAt?: string;
      inCycle?: boolean;
    }
  >();

  const activeCourseId = data.activeCourseId || 'default';

  // Das disciplinas de cursos
  if (Array.isArray(data.courses)) {
    for (const course of data.courses) {
      const isCourseActive =
        course.id === activeCourseId || (!data.activeCourseId && course.id === 'default');
      if (Array.isArray(course.subjects)) {
        for (const s of course.subjects) {
          if (s?.id && !subjectMap.has(s.id)) {
            subjectMap.set(s.id, {
              ...s,
              inCycle: isCourseActive,
            });
          }
        }
      }
    }
  }

  // Do array direto data.subjects
  if (Array.isArray(data.subjects)) {
    for (const s of data.subjects) {
      if (s?.id) {
        const existing = subjectMap.get(s.id);
        subjectMap.set(s.id, {
          ...(existing ?? {}),
          ...s,
          inCycle: true,
        });
      }
    }
  }

  // Do histórico (caso alguma matéria antiga só exista nas sessões)
  if (Array.isArray(data.history)) {
    for (const h of data.history) {
      if (h?.subjectId && !subjectMap.has(h.subjectId)) {
        subjectMap.set(h.subjectId, {
          id: h.subjectId,
          name: h.subjectName || 'Disciplina',
          color: h.subjectColor,
          inCycle: false,
        });
      }
    }
  }

  // Se o ciclo possuir allocations, garante que as disciplinas do ciclo fiquem ativas (inCycle: true)
  if (data.cycle?.plan?.allocations && Array.isArray(data.cycle.plan.allocations)) {
    for (const alloc of data.cycle.plan.allocations) {
      if (alloc?.subjectId && subjectMap.has(alloc.subjectId)) {
        const entry = subjectMap.get(alloc.subjectId)!;
        entry.inCycle = true;
      }
    }
  }

  // Transforma as matérias em Disciplines do TotalControle
  const disciplines: Discipline[] = [];
  let discIndex = 0;

  for (const [id, s] of subjectMap.entries()) {
    const theme = mapColorToTheme(s.color, discIndex);
    const weightVal = (
      typeof s.weight === 'number' && s.weight >= 1 && s.weight <= 5
        ? Math.round(s.weight)
        : 3
    ) as 1 | 2 | 3 | 4 | 5;
    const diffVal: Difficulty =
      s.difficulty === 'easy' || s.difficulty === 'hard'
        ? s.difficulty
        : 'medium';
    const adjVal =
      typeof s.adjustment === 'number' && s.adjustment >= 0.5 && s.adjustment <= 1.5
        ? s.adjustment
        : 1;

    const levelId = `lvl_${id}`;
    const moduleId = `mod_${id}`;

    disciplines.push({
      id,
      examId: DEFAULT_EXAM_ID,
      name: s.name?.trim() || `Disciplina ${discIndex + 1}`,
      description: '',
      theme,
      icon: 'BookOpen',
      sortOrder: discIndex,
      inCycle: s.inCycle ?? true,
      weight: weightVal,
      difficulty: diffVal,
      sessionMinutesOverride:
        typeof s.sessionMinutes === 'number' ? s.sessionMinutes : null,
      adjustment: adjVal,
      levels: [
        {
          id: levelId,
          disciplineId: id,
          title: 'Nível 1 — Fundamentos',
          subtitle: 'Conteúdos da disciplina',
          landscapeName: 'Ponto de Partida',
          sortOrder: 0,
          modules: [
            {
              id: moduleId,
              levelId,
              disciplineId: id,
              title: 'Módulo Geral',
              sortOrder: 0,
              contents: [],
            },
          ],
        },
      ],
      createdAt: s.createdAt || now,
      updatedAt: s.updatedAt || now,
      deletedAt: null,
      syncStatus: 'pending',
    });
    discIndex++;
  }

  const discMap = new Map(disciplines.map((d) => [d.id, d]));

  // Configurações do ciclo
  const cycleSettings: CycleSettings = {
    cycleMinutes: data.settings?.cycleMinutes ?? 720,
    sessionMinutes: data.settings?.sessionMinutes ?? 50,
    minBlockMinutes: data.settings?.minBlockMinutes ?? 25,
  };

  // Estado e Plano do Ciclo
  let cyclePlan: CyclePlan | null = null;
  if (data.cycle?.plan) {
    const rawPlan = data.cycle.plan;
    const blocks: CycleBlock[] = (rawPlan.blocks ?? []).map(
      (b: any, idx: number) => {
        const disc = discMap.get(b.subjectId);
        return {
          index: typeof b.index === 'number' ? b.index : idx,
          disciplineId: b.subjectId,
          disciplineName: disc?.name ?? b.subjectName ?? 'Disciplina',
          theme: disc?.theme ?? 'sky',
          plannedMinutes: b.minutes ?? b.plannedMinutes ?? 50,
          occurrence: b.part ?? b.occurrence ?? 1,
          totalForDiscipline: b.parts ?? b.totalForDiscipline ?? 1,
        };
      },
    );

    const allocations: SubjectAllocation[] = (rawPlan.allocations ?? []).map(
      (a: any) => {
        const disc = discMap.get(a.subjectId);
        return {
          disciplineId: a.subjectId,
          disciplineName: disc?.name ?? a.subjectName ?? 'Disciplina',
          theme: disc?.theme ?? 'sky',
          weight: (
            a.weight >= 1 && a.weight <= 5 ? Math.round(a.weight) : 3
          ) as 1 | 2 | 3 | 4 | 5,
          difficulty:
            a.difficulty === 'easy' || a.difficulty === 'hard'
              ? a.difficulty
              : 'medium',
          score: a.score ?? 3,
          rawShare: a.rawShare ?? 0,
          finalShare: a.share ?? a.finalShare ?? 0,
          minutes: a.minutes ?? 0,
          blocks: a.blocks ?? 0,
          clamped: a.clamp ?? a.clamped ?? null,
        };
      },
    );

    cyclePlan = {
      signature: rawPlan.signature ?? 'migrated_plan',
      generatedAt: rawPlan.generatedAt ?? data.meta?.updatedAt ?? now,
      totalMinutes: rawPlan.totalMinutes ?? cycleSettings.cycleMinutes,
      allocations,
      blocks,
      warnings: rawPlan.warnings ?? [],
    };
  }

  const cycleState: CycleState = {
    plan: cyclePlan,
    position: data.cycle?.position ?? 0,
    cycleNumber: data.cycle?.cycleNumber ?? 1,
    completedCycles: data.cycle?.completedCycles ?? 0,
  };

  // Sessões de Estudo do histórico
  const sessions: SessionRecord[] = [];
  if (Array.isArray(data.history)) {
    for (const h of data.history) {
      if (!h || !h.id) continue;
      const disc = discMap.get(h.subjectId);
      const status: SessionStatus =
        h.status === 'partial'
          ? 'partial'
          : h.status === 'skipped'
            ? 'skipped'
            : 'completed';

      sessions.push({
        id: h.id,
        origin: 'ciclo',
        disciplineId: h.subjectId,
        disciplineName: h.subjectName || disc?.name || 'Disciplina',
        disciplineTheme: disc?.theme || 'sky',
        contentId: null,
        contentTitle: null,
        cycleNumber: h.cycleNumber ?? 1,
        blockIndex: h.blockIndex ?? 0,
        startedAt: h.startedAt || now,
        endedAt: h.endedAt || now,
        plannedMinutes: h.plannedMinutes ?? 50,
        studiedMinutes:
          typeof h.studiedMinutes === 'number' ? h.studiedMinutes : 0,
        status,
        notes: h.notes || '',
        createdAt: h.startedAt || now,
        updatedAt: h.endedAt || now,
        syncStatus: 'pending',
      });
    }
  }

  const operationLogs: OperationLog[] = [
    {
      id: uid('log'),
      entityType: 'backup',
      entityId: 'migracao_legado',
      disciplineId: null,
      contentId: null,
      action: 'migracao_backup_legado',
      summary: `Migração automática de backup do antigo programa: ${disciplines.length} matérias e ${sessions.length} sessões importadas.`,
      metadataJson: JSON.stringify({
        sourceApp: raw.app || 'ciclo',
        sessionsCount: sessions.length,
        disciplinesCount: disciplines.length,
        importedAt: now,
      }),
      timestamp: now,
      syncStatus: 'pending',
    },
  ];

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appName: 'TotalControle',
    exportedAt,
    userName: data.preferences?.userName || 'Estudante',
    disciplines,
    cycleSettings,
    cycleState,
    sessions,
    errors: [],
    operationLogs,
  };
}

