const fs = require('fs');
const path = require('path');

function mapColorToTheme(color, fallbackIndex = 0) {
  const THEMES = ['sky', 'deep', 'lavender', 'sage', 'gold', 'rose'];
  if (!color || typeof color !== 'string') {
    return THEMES[fallbackIndex % THEMES.length];
  }

  const c = color.trim().toLowerCase();
  if (c === '#5c64e8') return 'sky';
  if (c === '#f7a072') return 'gold';
  if (c === '#1e555c') return 'deep';
  if (c === '#529e7e') return 'sage';

  if (c.includes('blue') || c.includes('azul')) return 'sky';
  if (c.includes('orange') || c.includes('laranja') || c.includes('amber')) return 'gold';
  if (c.includes('teal') || c.includes('dark') || c.includes('navy')) return 'deep';
  if (c.includes('green') || c.includes('verde')) return 'sage';
  if (c.includes('purple') || c.includes('violet') || c.includes('roxo')) return 'lavender';
  if (c.includes('rose') || c.includes('pink') || c.includes('rosa') || c.includes('red')) return 'rose';

  return THEMES[fallbackIndex % THEMES.length];
}

const rawText = fs.readFileSync(path.join(__dirname, '..', 'legacy-backup-original.json'), 'utf8');
const raw = JSON.parse(rawText);
const data = raw.data || raw;
const now = new Date().toISOString();
const exportedAt = raw.exportedAt || now;

const subjectMap = new Map();
const activeCourseId = data.activeCourseId || 'default';

if (Array.isArray(data.courses)) {
  for (const course of data.courses) {
    const isCourseActive = course.id === activeCourseId;
    if (Array.isArray(course.subjects)) {
      for (const s of course.subjects) {
        if (s && s.id && !subjectMap.has(s.id)) {
          subjectMap.set(s.id, {
            ...s,
            inCycle: isCourseActive,
          });
        }
      }
    }
  }
}

if (Array.isArray(data.subjects)) {
  for (const s of data.subjects) {
    if (s && s.id) {
      const existing = subjectMap.get(s.id);
      subjectMap.set(s.id, {
        ...(existing || {}),
        ...s,
        inCycle: true,
      });
    }
  }
}

if (Array.isArray(data.history)) {
  for (const h of data.history) {
    if (h && h.subjectId && !subjectMap.has(h.subjectId)) {
      subjectMap.set(h.subjectId, {
        id: h.subjectId,
        name: h.subjectName || 'Disciplina',
        color: h.subjectColor,
        inCycle: false,
      });
    }
  }
}

if (data.cycle?.plan?.allocations && Array.isArray(data.cycle.plan.allocations)) {
  for (const alloc of data.cycle.plan.allocations) {
    if (alloc?.subjectId && subjectMap.has(alloc.subjectId)) {
      subjectMap.get(alloc.subjectId).inCycle = true;
    }
  }
}

const disciplines = [];
let discIndex = 0;

for (const [id, s] of subjectMap.entries()) {
  const theme = mapColorToTheme(s.color, discIndex);
  const weightVal = typeof s.weight === 'number' && s.weight >= 1 && s.weight <= 5 ? Math.round(s.weight) : 3;
  const diffVal = s.difficulty === 'easy' || s.difficulty === 'hard' ? s.difficulty : 'medium';
  const adjVal = typeof s.adjustment === 'number' && s.adjustment >= 0.5 && s.adjustment <= 1.5 ? s.adjustment : 1;
  const createdAt = s.createdAt || now;
  const updatedAt = s.updatedAt || now;

  const levelId = `lvl_${id}`;
  const moduleId = `mod_${id}`;

  disciplines.push({
    id,
    name: s.name ? s.name.trim() : `Disciplina ${discIndex + 1}`,
    description: '',
    theme,
    icon: 'BookOpen',
    sortOrder: discIndex,
    inCycle: s.inCycle ?? true,
    weight: weightVal,
    difficulty: diffVal,
    sessionMinutesOverride: typeof s.sessionMinutes === 'number' ? s.sessionMinutes : null,
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
    createdAt,
    updatedAt,
    deletedAt: null,
    syncStatus: 'pending',
  });
  discIndex++;
}

const discMap = new Map(disciplines.map((d) => [d.id, d]));

const cycleSettings = {
  cycleMinutes: data.settings?.cycleMinutes ?? 720,
  sessionMinutes: data.settings?.sessionMinutes ?? 50,
  minBlockMinutes: data.settings?.minBlockMinutes ?? 25,
};

let cyclePlan = null;
if (data.cycle?.plan) {
  const rawPlan = data.cycle.plan;
  const blocks = (rawPlan.blocks || []).map((b, idx) => {
    const disc = discMap.get(b.subjectId);
    return {
      index: typeof b.index === 'number' ? b.index : idx,
      disciplineId: b.subjectId,
      disciplineName: disc ? disc.name : (b.subjectName || 'Disciplina'),
      theme: disc ? disc.theme : 'sky',
      plannedMinutes: b.minutes || b.plannedMinutes || 50,
      occurrence: b.part || b.occurrence || 1,
      totalForDiscipline: b.parts || b.totalForDiscipline || 1,
    };
  });

  const allocations = (rawPlan.allocations || []).map((a) => {
    const disc = discMap.get(a.subjectId);
    return {
      disciplineId: a.subjectId,
      disciplineName: disc ? disc.name : (a.subjectName || 'Disciplina'),
      theme: disc ? disc.theme : 'sky',
      weight: a.weight >= 1 && a.weight <= 5 ? Math.round(a.weight) : 3,
      difficulty: a.difficulty === 'easy' || a.difficulty === 'hard' ? a.difficulty : 'medium',
      score: a.score || 3,
      rawShare: a.rawShare || 0,
      finalShare: a.share || a.finalShare || 0,
      minutes: a.minutes || 0,
      blocks: a.blocks || 0,
      clamped: a.clamp || a.clamped || null,
    };
  });

  cyclePlan = {
    signature: rawPlan.signature || '66b7ys',
    generatedAt: rawPlan.generatedAt || data.meta?.updatedAt || now,
    totalMinutes: rawPlan.totalMinutes || cycleSettings.cycleMinutes,
    allocations,
    blocks,
    warnings: rawPlan.warnings || [],
  };
}

const cycleState = {
  plan: cyclePlan,
  position: data.cycle?.position ?? 0,
  cycleNumber: data.cycle?.cycleNumber ?? 1,
  completedCycles: data.cycle?.completedCycles ?? 0,
};

const sessions = [];
if (Array.isArray(data.history)) {
  for (const h of data.history) {
    if (!h || !h.id) continue;
    const disc = discMap.get(h.subjectId);
    const status = h.status === 'partial' ? 'partial' : h.status === 'skipped' ? 'skipped' : 'completed';

    sessions.push({
      id: h.id,
      origin: 'ciclo',
      disciplineId: h.subjectId,
      disciplineName: h.subjectName || (disc ? disc.name : 'Disciplina'),
      disciplineTheme: disc ? disc.theme : 'sky',
      contentId: null,
      contentTitle: null,
      cycleNumber: h.cycleNumber ?? 1,
      blockIndex: h.blockIndex ?? 0,
      startedAt: h.startedAt || now,
      endedAt: h.endedAt || now,
      plannedMinutes: h.plannedMinutes || 50,
      studiedMinutes: typeof h.studiedMinutes === 'number' ? h.studiedMinutes : 0,
      status,
      notes: h.notes || '',
      createdAt: h.startedAt || now,
      updatedAt: h.endedAt || now,
      syncStatus: 'pending',
    });
  }
}

const errataText = fs.readFileSync(path.join(__dirname, '..', 'legacy-errata-original.json'), 'utf8');
const errataRaw = JSON.parse(errataText);
const errataData = errataRaw.data || errataRaw;

function normalizeName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if ((na === 'lingua portuguesa' && nb === 'portugues') || (na === 'portugues' && nb === 'lingua portuguesa')) {
    return true;
  }
  return false;
}

const errataSubToDisc = new Map();
for (const sub of errataData.subjects || []) {
  const found = disciplines.find((d) => namesMatch(d.name, sub.name));
  if (found) {
    errataSubToDisc.set(sub.id, found);
  }
}

for (const top of errataData.topics || []) {
  const disc = errataSubToDisc.get(top.subjectId);
  if (!disc) continue;
  const lvl = disc.levels[0];
  const mod = lvl.modules[0];
  mod.contents.push({
    id: top.id,
    disciplineId: disc.id,
    levelId: lvl.id,
    moduleId: mod.id,
    title: top.name,
    description: 'Tópico importado do Caderno de Erros (ERRATA).',
    sortOrder: mod.contents.length,
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
    createdAt: top.createdAt || now,
    updatedAt: top.createdAt || now,
    deletedAt: null,
    syncStatus: 'pending',
  });
}

const errors = (errataData.errors || []).map((e) => {
  const disc = errataSubToDisc.get(e.subjectId);
  return {
    id: e.id,
    disciplineId: disc ? disc.id : e.subjectId,
    contentId: e.topicId,
    description: e.description || '',
    correction: e.correction || '',
    prevention: e.prevention || '',
    priority: e.priority || 'media',
    origin: e.origin || 'nao_classificado',
    referenceQuestion: e.referenceQuestion || undefined,
    registrationDate: e.registrationDate || '',
    overcomeAt: e.overcomeAt ?? null,
    reviewHistory: (e.reviewHistory || []).map((r) => ({
      id: r.id,
      errorId: e.id,
      timestamp: r.timestamp,
      previousPriority: r.previousPriority,
      newPriority: r.newPriority,
      action: typeof r.action === 'string' && r.action.toLowerCase().includes('reabertura') ? 'reabertura' : 'revisao_2_ciclo',
      notes: typeof r.action === 'string' ? r.action : r.notes,
    })),
    createdAt: e.createdAt || now,
    updatedAt: e.updatedAt || now,
    deletedAt: null,
    syncStatus: 'pending',
  };
});

const operationLogs = [
  {
    id: `log_migracao_${Date.now()}`,
    entityType: 'backup',
    entityId: 'migracao_legado',
    disciplineId: null,
    contentId: null,
    action: 'migracao_backup_legado',
    summary: `Migração unificada: ${disciplines.length} matérias, ${sessions.length} sessões e ${errors.length} erros importados.`,
    metadataJson: JSON.stringify({
      sourceApps: ['ciclo', 'ERRATA'],
      sessionsCount: sessions.length,
      disciplinesCount: disciplines.length,
      errorsCount: errors.length,
      importedAt: now,
    }),
    timestamp: now,
    syncStatus: 'pending',
  },
];

const totalControleBackup = {
  formatVersion: '1.0.0',
  appName: 'TotalControle',
  exportedAt,
  userName: 'Estudante',
  disciplines,
  cycleSettings,
  cycleState,
  sessions,
  errors,
  operationLogs,
};

const outputPath = path.join(__dirname, '..', 'totalcontrole-backup-migrado.json');
fs.writeFileSync(outputPath, JSON.stringify(totalControleBackup, null, 2), 'utf8');

console.log('Migração unificada gerada com sucesso:');
console.log('- Disciplinas:', disciplines.length);
console.log('- Sessões:', sessions.length);
console.log('- Erros (ERRATA):', errors.length);
const totalMinutes = sessions.reduce((acc, s) => acc + s.studiedMinutes, 0);
console.log('- Total minutos:', totalMinutes, `(${Math.floor(totalMinutes / 60)}h${totalMinutes % 60}m)`);
console.log('- Ciclo:', `Ciclo #${cycleState.cycleNumber}, Posição ${cycleState.position} de ${cyclePlan.blocks.length} blocos`);
console.log('- Arquivo salvo em:', outputPath);

