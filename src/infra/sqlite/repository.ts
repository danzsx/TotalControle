import {
  BACKUP_FORMAT_VERSION,
  DEFAULT_CYCLE_SETTINGS,
  DEFAULT_EXAM_ID,
  ORIGINS,
  PRIORITIES,
  SCHEMA_VERSION,
} from '../../domain/constants';
import {
  disciplineNamesMatch,
  normalizeBackupPayload,
} from '../../domain/backupMigration';
import { computePlan, planSignature } from '../../domain/distribution';
import { formatMinutes } from '../../domain/explain';
import {
  createDefaultExam,
  createStarterDisciplines,
} from '../../domain/prebuiltTrails';
import { normalizeText, uid } from '../../domain/text';
import { restoreSession, type RestoreResult } from '../../domain/timer';
import type {
  ActiveSession,
  AppMeta,
  BackupPayload,
  ContentNode,
  CyclePlan,
  CycleSettings,
  CycleState,
  Discipline,
  ErrorOrigin,
  ErrorRecord,
  ErrorReviewEntry,
  Exam,
  OperationEntityType,
  OperationLog,
  PriorityLevel,
  Result,
  SessionRecord,
  SessionStatus,
  TrailLevel,
  TrailModule,
} from '../../domain/types';
import type { StorageBackend } from '../desktop/bridge';
import type { SyncStatusSummary } from '../sync/syncProvider';
import { SqliteDatabase } from './database';

export interface LoadedState {
  meta: AppMeta;
  exams: Exam[];
  examCycles: Record<string, { cycleSettings: CycleSettings; cycleState: CycleState }>;
  disciplines: Discipline[];
  cycleSettings: CycleSettings;
  cycleState: CycleState;
  activeSession: ActiveSession | null;
  sessionRestore: RestoreResult | null;
  sessions: SessionRecord[];
  errors: ErrorRecord[];
  operationLogs: OperationLog[];
  syncSummary: SyncStatusSummary;
}

export class UnifiedRepository {
  private db: SqliteDatabase;
  private backend: StorageBackend;
  private persistChain: Promise<void> = Promise.resolve();

  private constructor(db: SqliteDatabase, backend: StorageBackend) {
    this.db = db;
    this.backend = backend;
  }

  static async open(backend: StorageBackend): Promise<UnifiedRepository> {
    const existingBytes = await backend.loadBytes();
    let db: SqliteDatabase;
    try {
      db = await SqliteDatabase.open(existingBytes);
    } catch {
      // Se o arquivo estiver corrompido, inicia banco limpo
      db = await SqliteDatabase.open(null);
    }
    const repo = new UnifiedRepository(db, backend);
    repo.ensureInitialized();
    await repo.persist();
    return repo;
  }

  private ensureInitialized(): void {
    const cols = this.db.all<{ name: string }>(
      'PRAGMA table_info(study_sessions)',
    );
    if (cols.length > 0 && !cols.some((c) => c.name === 'origin')) {
      this.db.run(
        "ALTER TABLE study_sessions ADD COLUMN origin TEXT NOT NULL DEFAULT 'ciclo'",
      );
    }

    const discCols = this.db.all<{ name: string }>(
      'PRAGMA table_info(disciplines)',
    );
    if (discCols.length > 0 && !discCols.some((c) => c.name === 'exam_id')) {
      this.db.run(
        `ALTER TABLE disciplines ADD COLUMN exam_id TEXT NOT NULL DEFAULT '${DEFAULT_EXAM_ID}'`,
      );
    }

    const versionRow = this.db.get<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      ['schema_version'],
    );
    if (!versionRow) {
      const now = new Date().toISOString();
      const defaultExam = createDefaultExam(DEFAULT_EXAM_ID, 'Concurso Principal');
      const starters = createStarterDisciplines(defaultExam.id);
      const plan = computePlan(starters, DEFAULT_CYCLE_SETTINGS, now);

      this.db.transaction(() => {
        this.setMeta('schema_version', String(SCHEMA_VERSION));
        this.setMeta('device_id', uid('dev'));
        this.setMeta('user_name', 'Estudante');
        this.setMeta('active_exam_id', defaultExam.id);
        this.setMeta('active_discipline_id', starters[0]?.id ?? '');
        this.setMeta('last_sync_at', '');

        this.upsertExamRow(defaultExam);

        this.db.run(
          'INSERT OR REPLACE INTO cycle_settings (id, cycle_minutes, session_minutes, min_block_minutes) VALUES (1, ?, ?, ?)',
          [
            DEFAULT_CYCLE_SETTINGS.cycleMinutes,
            DEFAULT_CYCLE_SETTINGS.sessionMinutes,
            DEFAULT_CYCLE_SETTINGS.minBlockMinutes,
          ],
        );

        this.db.run(
          'INSERT OR REPLACE INTO cycle_state (id, plan_json, position, cycle_number, completed_cycles) VALUES (1, ?, 0, 1, 0)',
          [JSON.stringify(plan)],
        );

        this.db.run(
          'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
          [
            defaultExam.id,
            DEFAULT_CYCLE_SETTINGS.cycleMinutes,
            DEFAULT_CYCLE_SETTINGS.sessionMinutes,
            DEFAULT_CYCLE_SETTINGS.minBlockMinutes,
          ],
        );

        this.db.run(
          'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, 0, 1, 0)',
          [defaultExam.id, JSON.stringify(plan)],
        );

        this.db.run(
          'INSERT OR REPLACE INTO active_session (id, session_json) VALUES (1, NULL)',
        );

        for (const d of starters) {
          this.insertDisciplineTree(d);
        }

        this.appendOperationLog({
          entityType: 'discipline',
          entityId: 'starter',
          disciplineId: starters[0]?.id ?? null,
          contentId: null,
          action: 'inicializacao',
          summary: 'Espaço de aprendizagem inicializado com trilhas base.',
          timestamp: now,
        });
      });
    } else if (Number(versionRow.value) < 2) {
      this.db.transaction(() => {
        const existingExams = this.db.all<{ id: string }>(
          'SELECT id FROM exams WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
        );
        let primaryExamId = existingExams[0]?.id;
        if (!primaryExamId) {
          const defaultExam = createDefaultExam(DEFAULT_EXAM_ID, 'Concurso Principal');
          this.upsertExamRow(defaultExam);
          primaryExamId = defaultExam.id;
        }

        this.db.run(
          "UPDATE disciplines SET exam_id = ? WHERE exam_id IS NULL OR exam_id = ''",
          [primaryExamId],
        );

        if (!this.getMeta('active_exam_id')) {
          this.setMeta('active_exam_id', primaryExamId);
        }

        const existingExamCs = this.db.get<{ exam_id: string }>(
          'SELECT exam_id FROM exam_cycle_settings WHERE exam_id = ?',
          [primaryExamId],
        );
        if (!existingExamCs) {
          const csRow = this.db.get<Record<string, unknown>>(
            'SELECT * FROM cycle_settings WHERE id = 1',
          );
          this.db.run(
            'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
            [
              primaryExamId,
              csRow ? Number(csRow.cycle_minutes) : DEFAULT_CYCLE_SETTINGS.cycleMinutes,
              csRow ? Number(csRow.session_minutes) : DEFAULT_CYCLE_SETTINGS.sessionMinutes,
              csRow ? Number(csRow.min_block_minutes) : DEFAULT_CYCLE_SETTINGS.minBlockMinutes,
            ],
          );
        }

        const existingExamSt = this.db.get<{ exam_id: string }>(
          'SELECT exam_id FROM exam_cycle_state WHERE exam_id = ?',
          [primaryExamId],
        );
        if (!existingExamSt) {
          const stRow = this.db.get<Record<string, unknown>>(
            'SELECT * FROM cycle_state WHERE id = 1',
          );
          this.db.run(
            'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
            [
              primaryExamId,
              stRow?.plan_json ? String(stRow.plan_json) : null,
              stRow ? Number(stRow.position) : 0,
              stRow ? Number(stRow.cycle_number) : 1,
              stRow ? Number(stRow.completed_cycles) : 0,
            ],
          );
        }

        this.setMeta('schema_version', String(SCHEMA_VERSION));
      });
    }
  }

  private setMeta(key: string, value: string): void {
    this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
      key,
      value,
    ]);
  }

  private getMeta(key: string, fallback = ''): string {
    const row = this.db.get<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      [key],
    );
    return row ? row.value : fallback;
  }

  getUnlockedCardsMap(): Record<string, string> {
    const raw = this.getMeta('unlocked_cards_json', '{}');
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  async saveUnlockedCardsMap(map: Record<string, string>): Promise<void> {
    this.setMeta('unlocked_cards_json', JSON.stringify(map));
    await this.persist();
  }

  private queueOutbox(
    tableName: string,
    recordId: string,
    operation: 'upsert' | 'delete',
    payload: unknown,
  ): void {
    this.db.run(
      'INSERT INTO sync_outbox (id, table_name, record_id, operation, payload_json, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      [
        uid('out'),
        tableName,
        recordId,
        operation,
        JSON.stringify(payload),
        new Date().toISOString(),
      ],
    );
  }

  private appendOperationLog(input: {
    entityType: OperationEntityType;
    entityId: string;
    disciplineId: string | null;
    contentId: string | null;
    action: string;
    summary: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }): void {
    this.db.run(
      `INSERT INTO operation_logs
        (id, entity_type, entity_id, discipline_id, content_id, action, summary, metadata_json, timestamp, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        uid('log'),
        input.entityType,
        input.entityId,
        input.disciplineId,
        input.contentId,
        input.action,
        input.summary,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.timestamp ?? new Date().toISOString(),
      ],
    );
  }

  private upsertExamRow(exam: Exam): void {
    this.db.run(
      `INSERT INTO exams
        (id, name, description, theme, target_date, sort_order, created_at, updated_at, deleted_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        theme = excluded.theme,
        target_date = excluded.target_date,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status`,
      [
        exam.id,
        exam.name,
        exam.description,
        exam.theme,
        exam.targetDate,
        exam.sortOrder,
        exam.createdAt,
        exam.updatedAt,
        exam.deletedAt,
        exam.syncStatus,
      ],
    );
  }

  private insertDisciplineTree(d: Discipline): void {
    this.db.run(
      `INSERT INTO disciplines
        (id, exam_id, name, description, theme, icon, template_id, sort_order, in_cycle, weight, difficulty, session_minutes_override, adjustment, created_at, updated_at, deleted_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        exam_id = excluded.exam_id,
        name = excluded.name,
        description = excluded.description,
        theme = excluded.theme,
        icon = excluded.icon,
        template_id = excluded.template_id,
        sort_order = excluded.sort_order,
        in_cycle = excluded.in_cycle,
        weight = excluded.weight,
        difficulty = excluded.difficulty,
        session_minutes_override = excluded.session_minutes_override,
        adjustment = excluded.adjustment,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status`,
      [
        d.id,
        d.examId || DEFAULT_EXAM_ID,
        d.name,
        d.description,
        d.theme,
        d.icon,
        d.templateId ?? null,
        d.sortOrder,
        d.inCycle ? 1 : 0,
        d.weight,
        d.difficulty,
        d.sessionMinutesOverride,
        d.adjustment,
        d.createdAt,
        d.updatedAt,
        d.deletedAt,
        d.syncStatus,
      ],
    );

    for (const lvl of d.levels) {
      this.db.run(
        `INSERT INTO trail_levels
          (id, discipline_id, title, subtitle, landscape_name, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          discipline_id = excluded.discipline_id,
          title = excluded.title,
          subtitle = excluded.subtitle,
          landscape_name = excluded.landscape_name,
          sort_order = excluded.sort_order`,
        [lvl.id, d.id, lvl.title, lvl.subtitle, lvl.landscapeName, lvl.sortOrder],
      );
      for (const mod of lvl.modules) {
        this.db.run(
          `INSERT INTO trail_modules
            (id, level_id, discipline_id, title, subtitle, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
            level_id = excluded.level_id,
            discipline_id = excluded.discipline_id,
            title = excluded.title,
            subtitle = excluded.subtitle,
            sort_order = excluded.sort_order`,
          [mod.id, lvl.id, d.id, mod.title, mod.subtitle ?? null, mod.sortOrder],
        );
        for (const cnt of mod.contents) {
          this.upsertContentRow(cnt);
        }
      }
    }
  }

  private upsertContentRow(c: ContentNode): void {
    this.db.run(
      `INSERT INTO contents
        (id, discipline_id, level_id, module_id, title, description, edital_ref, sort_order, status, checklist_json, completed_at, exercises_done, exercises_correct, difficulty, marked_for_review, review_count, last_studied_at, notes, difficulties, history_json, created_at, updated_at, deleted_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        discipline_id = excluded.discipline_id,
        level_id = excluded.level_id,
        module_id = excluded.module_id,
        title = excluded.title,
        description = excluded.description,
        edital_ref = excluded.edital_ref,
        sort_order = excluded.sort_order,
        status = excluded.status,
        checklist_json = excluded.checklist_json,
        completed_at = excluded.completed_at,
        exercises_done = excluded.exercises_done,
        exercises_correct = excluded.exercises_correct,
        difficulty = excluded.difficulty,
        marked_for_review = excluded.marked_for_review,
        review_count = excluded.review_count,
        last_studied_at = excluded.last_studied_at,
        notes = excluded.notes,
        difficulties = excluded.difficulties,
        history_json = excluded.history_json,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status`,
      [
        c.id,
        c.disciplineId,
        c.levelId,
        c.moduleId,
        c.title,
        c.description,
        c.editalRef ?? null,
        c.sortOrder,
        c.status,
        JSON.stringify(c.checklist),
        c.completedAt,
        c.exercisesDone,
        c.exercisesCorrect,
        c.difficulty,
        c.markedForReview ? 1 : 0,
        c.reviewCount,
        c.lastStudiedAt,
        c.notes,
        c.difficulties,
        JSON.stringify(c.history),
        c.createdAt,
        c.updatedAt,
        c.deletedAt,
        c.syncStatus,
      ],
    );
  }

  async persist(): Promise<void> {
    const bytes = this.db.exportBytes();
    this.persistChain = this.persistChain.then(() =>
      this.backend.saveBytes(bytes),
    );
    await this.persistChain;
  }

  loadAll(nowMs: number = Date.now()): LoadedState {
    const meta: AppMeta = {
      schemaVersion: Number(this.getMeta('schema_version', String(SCHEMA_VERSION))),
      deviceId: this.getMeta('device_id', ''),
      userName: this.getMeta('user_name', 'Estudante'),
      activeExamId: this.getMeta('active_exam_id', '') || null,
      activeDisciplineId: this.getMeta('active_discipline_id', '') || null,
      lastSyncAt: this.getMeta('last_sync_at', '') || null,
    };

    const examRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM exams WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
    );
    const exams: Exam[] = examRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description ?? ''),
      theme: (r.theme as Exam['theme']) || 'sky',
      targetDate: r.target_date ? String(r.target_date) : null,
      sortOrder: Number(r.sort_order ?? 0),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      deletedAt: null,
      syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
    }));

    if (
      !meta.activeExamId ||
      !exams.some((e) => e.id === meta.activeExamId)
    ) {
      meta.activeExamId = exams[0]?.id ?? null;
    }

    const discRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM disciplines WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
    );
    const levelRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM trail_levels ORDER BY sort_order ASC',
    );
    const modRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM trail_modules ORDER BY sort_order ASC',
    );
    const cntRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM contents WHERE deleted_at IS NULL ORDER BY sort_order ASC',
    );

    const contentsByModule = new Map<string, ContentNode[]>();
    for (const r of cntRows) {
      const modId = String(r.module_id);
      const arr = contentsByModule.get(modId) ?? [];
      arr.push({
        id: String(r.id),
        disciplineId: String(r.discipline_id),
        levelId: String(r.level_id),
        moduleId: modId,
        title: String(r.title),
        description: String(r.description ?? ''),
        editalRef: r.edital_ref ? String(r.edital_ref) : undefined,
        sortOrder: Number(r.sort_order),
        status: r.status as ContentNode['status'],
        checklist: JSON.parse(String(r.checklist_json || '[]')),
        completedAt: r.completed_at ? String(r.completed_at) : null,
        exercisesDone: Number(r.exercises_done),
        exercisesCorrect: Number(r.exercises_correct),
        difficulty: Number(r.difficulty) as 1 | 2 | 3 | 4,
        markedForReview: Boolean(r.marked_for_review),
        reviewCount: Number(r.review_count),
        lastStudiedAt: r.last_studied_at ? String(r.last_studied_at) : null,
        notes: String(r.notes ?? ''),
        difficulties: String(r.difficulties ?? ''),
        history: JSON.parse(String(r.history_json || '[]')),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        deletedAt: null,
        syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
      });
      contentsByModule.set(modId, arr);
    }

    const modulesByLevel = new Map<string, TrailModule[]>();
    for (const r of modRows) {
      const levelId = String(r.level_id);
      const id = String(r.id);
      const arr = modulesByLevel.get(levelId) ?? [];
      arr.push({
        id,
        levelId,
        disciplineId: String(r.discipline_id),
        title: String(r.title),
        subtitle: r.subtitle ? String(r.subtitle) : undefined,
        sortOrder: Number(r.sort_order),
        contents: contentsByModule.get(id) ?? [],
      });
      modulesByLevel.set(levelId, arr);
    }

    const levelsByDisc = new Map<string, TrailLevel[]>();
    for (const r of levelRows) {
      const discId = String(r.discipline_id);
      const id = String(r.id);
      const arr = levelsByDisc.get(discId) ?? [];
      arr.push({
        id,
        disciplineId: discId,
        title: String(r.title),
        subtitle: String(r.subtitle ?? ''),
        landscapeName: String(r.landscape_name ?? ''),
        sortOrder: Number(r.sort_order),
        modules: modulesByLevel.get(id) ?? [],
      });
      levelsByDisc.set(discId, arr);
    }

    const disciplines: Discipline[] = discRows.map((r) => {
      const id = String(r.id);
      return {
        id,
        examId: String(r.exam_id || DEFAULT_EXAM_ID),
        name: String(r.name),
        description: String(r.description ?? ''),
        theme: r.theme as Discipline['theme'],
        icon: String(r.icon ?? 'Compass'),
        templateId: r.template_id ? String(r.template_id) : undefined,
        sortOrder: Number(r.sort_order),
        inCycle: Boolean(r.in_cycle),
        weight: Number(r.weight) as 1 | 2 | 3 | 4 | 5,
        difficulty: r.difficulty as Discipline['difficulty'],
        sessionMinutesOverride:
          r.session_minutes_override !== null &&
          r.session_minutes_override !== undefined
            ? Number(r.session_minutes_override)
            : null,
        adjustment: Number(r.adjustment ?? 1),
        levels: levelsByDisc.get(id) ?? [],
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        deletedAt: null,
        syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
      };
    });

    const activeExamDisciplines = meta.activeExamId
      ? disciplines.filter((d) => d.examId === meta.activeExamId)
      : disciplines;

    if (
      meta.activeDisciplineId &&
      !activeExamDisciplines.some((d) => d.id === meta.activeDisciplineId)
    ) {
      meta.activeDisciplineId = activeExamDisciplines[0]?.id ?? null;
    } else if (!meta.activeDisciplineId && activeExamDisciplines.length > 0) {
      meta.activeDisciplineId = activeExamDisciplines[0].id;
    }

    const examCsRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM exam_cycle_settings',
    );
    const examCsMap = new Map<string, CycleSettings>();
    for (const r of examCsRows) {
      examCsMap.set(String(r.exam_id), {
        cycleMinutes: Number(r.cycle_minutes),
        sessionMinutes: Number(r.session_minutes),
        minBlockMinutes: Number(r.min_block_minutes),
      });
    }

    const examStRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM exam_cycle_state',
    );
    const examStMap = new Map<
      string,
      { plan: CyclePlan | null; position: number; cycleNumber: number; completedCycles: number }
    >();
    for (const r of examStRows) {
      examStMap.set(String(r.exam_id), {
        plan: r.plan_json ? JSON.parse(String(r.plan_json)) : null,
        position: Number(r.position ?? 0),
        cycleNumber: Number(r.cycle_number ?? 1),
        completedCycles: Number(r.completed_cycles ?? 0),
      });
    }

    const examCycles: Record<
      string,
      { cycleSettings: CycleSettings; cycleState: CycleState }
    > = {};

    for (const exam of exams) {
      const examDiscs = disciplines.filter((d) => d.examId === exam.id);
      const settings = examCsMap.get(exam.id) ?? { ...DEFAULT_CYCLE_SETTINGS };
      const st = examStMap.get(exam.id);
      let plan: CyclePlan | null = st?.plan ?? null;
      let position = st?.position ?? 0;
      const cycleNumber = st?.cycleNumber ?? 1;
      const completedCycles = st?.completedCycles ?? 0;

      const expectedSig = planSignature(examDiscs, settings);
      if (!plan || plan.signature !== expectedSig) {
        plan = computePlan(examDiscs, settings);
        const maxPos = Math.max(0, plan.blocks.length - 1);
        position = plan.blocks.length === 0 ? 0 : Math.min(position, maxPos);
        this.db.run(
          `INSERT INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(exam_id) DO UPDATE SET plan_json = excluded.plan_json, position = excluded.position`,
          [exam.id, JSON.stringify(plan), position, cycleNumber, completedCycles],
        );
      }

      examCycles[exam.id] = {
        cycleSettings: settings,
        cycleState: {
          plan,
          position,
          cycleNumber,
          completedCycles,
        },
      };
    }

    const activeCycle = meta.activeExamId ? examCycles[meta.activeExamId] : undefined;
    const cycleSettings: CycleSettings = activeCycle?.cycleSettings ?? {
      ...DEFAULT_CYCLE_SETTINGS,
    };
    const cycleState: CycleState = activeCycle?.cycleState ?? {
      plan: computePlan(activeExamDisciplines, cycleSettings),
      position: 0,
      cycleNumber: 1,
      completedCycles: 0,
    };

    const actRow = this.db.get<{ session_json: string | null }>(
      'SELECT session_json FROM active_session WHERE id = 1',
    );
    let activeSession: ActiveSession | null = actRow?.session_json
      ? JSON.parse(actRow.session_json)
      : null;
    let sessionRestore: RestoreResult | null = null;
    if (activeSession) {
      sessionRestore = restoreSession(activeSession, nowMs);
      if (sessionRestore.recovered) {
        activeSession = sessionRestore.session;
        this.db.run(
          'UPDATE active_session SET session_json = ? WHERE id = 1',
          [JSON.stringify(activeSession)],
        );
      }
    }

    const sessRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM study_sessions ORDER BY ended_at DESC',
    );
    const sessions: SessionRecord[] = sessRows.map((r) => ({
      id: String(r.id),
      origin: r.origin === 'trilha' ? 'trilha' : 'ciclo',
      disciplineId: String(r.discipline_id),
      disciplineName: String(r.discipline_name),
      disciplineTheme: r.discipline_theme as SessionRecord['disciplineTheme'],
      contentId: r.content_id ? String(r.content_id) : null,
      contentTitle: r.content_title ? String(r.content_title) : null,
      cycleNumber: Number(r.cycle_number),
      blockIndex: Number(r.block_index),
      startedAt: String(r.started_at),
      endedAt: String(r.ended_at),
      plannedMinutes: Number(r.planned_minutes),
      studiedMinutes: Number(r.studied_minutes),
      status: r.status as SessionStatus,
      notes: String(r.notes ?? ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
    }));

    const revRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM error_reviews ORDER BY timestamp DESC',
    );
    const reviewsByError = new Map<string, ErrorReviewEntry[]>();
    for (const r of revRows) {
      const errorId = String(r.error_id);
      const arr = reviewsByError.get(errorId) ?? [];
      arr.push({
        id: String(r.id),
        errorId,
        timestamp: String(r.timestamp),
        previousPriority: r.previous_priority as PriorityLevel,
        newPriority: r.new_priority as PriorityLevel,
        action: r.action as ErrorReviewEntry['action'],
        notes: r.notes ? String(r.notes) : undefined,
      });
      reviewsByError.set(errorId, arr);
    }

    const errRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM error_records WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    const errors: ErrorRecord[] = errRows.map((r) => {
      const id = String(r.id);
      return {
        id,
        disciplineId: String(r.discipline_id),
        contentId: String(r.content_id),
        description: String(r.description),
        correction: String(r.correction),
        prevention: String(r.prevention ?? ''),
        priority: r.priority as PriorityLevel,
        origin: r.origin as ErrorOrigin,
        referenceQuestion: r.reference_question_json
          ? JSON.parse(String(r.reference_question_json))
          : undefined,
        registrationDate: String(r.registration_date),
        overcomeAt: r.overcome_at ? String(r.overcome_at) : null,
        reviewHistory: reviewsByError.get(id) ?? [],
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        deletedAt: null,
        syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
      };
    });

    const logRows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM operation_logs ORDER BY timestamp DESC LIMIT 400',
    );
    const operationLogs: OperationLog[] = logRows.map((r) => ({
      id: String(r.id),
      entityType: r.entity_type as OperationEntityType,
      entityId: String(r.entity_id),
      disciplineId: r.discipline_id ? String(r.discipline_id) : null,
      contentId: r.content_id ? String(r.content_id) : null,
      action: String(r.action),
      summary: String(r.summary),
      metadataJson: r.metadata_json ? String(r.metadata_json) : null,
      timestamp: String(r.timestamp),
      syncStatus: (r.sync_status as 'pending' | 'synced') || 'pending',
    }));

    const outboxRow = this.db.get<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM sync_outbox WHERE synced_at IS NULL',
    );

    const syncSummary: SyncStatusSummary = {
      mode: 'offline',
      pendingChanges: Number(outboxRow?.cnt ?? 0),
      lastSyncAt: meta.lastSyncAt,
    };

    return {
      meta,
      exams,
      examCycles,
      disciplines,
      cycleSettings,
      cycleState,
      activeSession,
      sessionRestore,
      sessions,
      errors,
      operationLogs,
      syncSummary,
    };
  }

  // ============================================================================
  // Concursos (Exams)
  // ============================================================================

  async saveExam(
    exam: Exam,
    actionSummary = `Concurso "${exam.name}" atualizado.`,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updated: Exam = {
      ...exam,
      updatedAt: now,
      syncStatus: 'pending',
    };
    this.db.transaction(() => {
      this.upsertExamRow(updated);
      this.db.run(
        `INSERT OR IGNORE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes)
         VALUES (?, ?, ?, ?)`,
        [
          updated.id,
          DEFAULT_CYCLE_SETTINGS.cycleMinutes,
          DEFAULT_CYCLE_SETTINGS.sessionMinutes,
          DEFAULT_CYCLE_SETTINGS.minBlockMinutes,
        ],
      );
      this.db.run(
        `INSERT OR IGNORE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles)
         VALUES (?, NULL, 0, 1, 0)`,
        [updated.id],
      );
      this.queueOutbox('exams', updated.id, 'upsert', updated);
      this.appendOperationLog({
        entityType: 'exam',
        entityId: updated.id,
        disciplineId: null,
        contentId: null,
        action: 'salvar_concurso',
        summary: actionSummary,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async deleteExam(examId: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE exams SET deleted_at = ?, updated_at = ?, sync_status = ? WHERE id = ?',
        [now, now, 'pending', examId],
      );
      this.db.run(
        'UPDATE disciplines SET deleted_at = ?, updated_at = ?, sync_status = ? WHERE exam_id = ? AND deleted_at IS NULL',
        [now, now, 'pending', examId],
      );
      this.queueOutbox('exams', examId, 'delete', { id: examId, deletedAt: now });
      this.appendOperationLog({
        entityType: 'exam',
        entityId: examId,
        disciplineId: null,
        contentId: null,
        action: 'excluir_concurso',
        summary: `Concurso "${name}" removido.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async setActiveExamId(id: string | null): Promise<void> {
    this.setMeta('active_exam_id', id ?? '');
    if (id) {
      const firstDisc = this.db.get<{ id: string }>(
        'SELECT id FROM disciplines WHERE exam_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC LIMIT 1',
        [id],
      );
      const currentDiscId = this.getMeta('active_discipline_id', '');
      const currentBelongs = currentDiscId
        ? this.db.get<{ id: string }>(
            'SELECT id FROM disciplines WHERE id = ? AND exam_id = ? AND deleted_at IS NULL',
            [currentDiscId, id],
          )
        : null;
      if (!currentBelongs) {
        this.setMeta('active_discipline_id', firstDisc?.id ?? '');
      }
    }
    await this.persist();
  }

  // ============================================================================
  // Disciplinas e Trilhas
  // ============================================================================

  async saveDiscipline(
    discipline: Discipline,
    actionSummary = `Disciplina "${discipline.name}" atualizada.`,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updated: Discipline = {
      ...discipline,
      updatedAt: now,
      syncStatus: 'pending',
    };
    this.db.transaction(() => {
      this.insertDisciplineTree(updated);
      this.queueOutbox('disciplines', updated.id, 'upsert', updated);
      this.appendOperationLog({
        entityType: 'discipline',
        entityId: updated.id,
        disciplineId: updated.id,
        contentId: null,
        action: 'salvar_disciplina',
        summary: actionSummary,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async deleteDiscipline(disciplineId: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE disciplines SET deleted_at = ?, updated_at = ?, sync_status = ? WHERE id = ?',
        [now, now, 'pending', disciplineId],
      );
      this.queueOutbox('disciplines', disciplineId, 'delete', { id: disciplineId, deletedAt: now });
      this.appendOperationLog({
        entityType: 'discipline',
        entityId: disciplineId,
        disciplineId,
        contentId: null,
        action: 'excluir_disciplina',
        summary: `Disciplina "${name}" removida.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async saveContentNode(
    content: ContentNode,
    logSummary?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updated: ContentNode = {
      ...content,
      updatedAt: now,
      syncStatus: 'pending',
    };
    this.db.transaction(() => {
      this.upsertContentRow(updated);
      this.queueOutbox('contents', updated.id, 'upsert', updated);
      if (logSummary) {
        this.appendOperationLog({
          entityType: 'content',
          entityId: updated.id,
          disciplineId: updated.disciplineId,
          contentId: updated.id,
          action: 'atualizar_conteudo',
          summary: logSummary,
          timestamp: now,
        });
      }
    });
    await this.persist();
  }

  async deleteContentNode(content: ContentNode): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE contents SET deleted_at = ?, updated_at = ?, sync_status = ? WHERE id = ?',
        [now, now, 'pending', content.id],
      );
      this.queueOutbox('contents', content.id, 'delete', { id: content.id, deletedAt: now });
      this.appendOperationLog({
        entityType: 'content',
        entityId: content.id,
        disciplineId: content.disciplineId,
        contentId: content.id,
        action: 'excluir_conteudo',
        summary: `Conteúdo "${content.title}" removido da trilha.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  // ============================================================================
  // Ciclo de Estudos e Sessões
  // ============================================================================

  async updateCycleSettings(
    settings: CycleSettings,
    examId?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const targetExamId = examId || this.getMeta('active_exam_id', DEFAULT_EXAM_ID);
    this.db.transaction(() => {
      this.db.run(
        'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
        [
          targetExamId,
          settings.cycleMinutes,
          settings.sessionMinutes,
          settings.minBlockMinutes,
        ],
      );
      this.appendOperationLog({
        entityType: 'cycle',
        entityId: 'settings',
        disciplineId: null,
        contentId: null,
        action: 'configurar_ciclo',
        summary: `Ciclo ajustado para ${formatMinutes(settings.cycleMinutes)} (sessão de ${settings.sessionMinutes} min).`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async saveCycleState(
    state: CycleState,
    logSummary?: string,
    examId?: string,
  ): Promise<void> {
    const targetExamId = examId || this.getMeta('active_exam_id', DEFAULT_EXAM_ID);
    this.db.transaction(() => {
      this.db.run(
        'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
        [
          targetExamId,
          state.plan ? JSON.stringify(state.plan) : null,
          state.position,
          state.cycleNumber,
          state.completedCycles,
        ],
      );
      if (logSummary) {
        this.appendOperationLog({
          entityType: 'cycle',
          entityId: `cycle_${state.cycleNumber}`,
          disciplineId: null,
          contentId: null,
          action: 'navegar_ciclo',
          summary: logSummary,
        });
      }
    });
    await this.persist();
  }

  async saveActiveSession(session: ActiveSession | null): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO active_session (id, session_json) VALUES (1, ?)',
      [session ? JSON.stringify(session) : null],
    );
    await this.persist();
  }

  async finishStudySession(input: {
    record: SessionRecord;
    nextCycleState?: CycleState | null;
    linkedContent?: ContentNode | null;
    examId?: string;
  }): Promise<void> {
    const { record, nextCycleState, linkedContent, examId } = input;
    const origin = record.origin === 'trilha' ? 'trilha' : 'ciclo';
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO study_sessions
          (id, origin, discipline_id, discipline_name, discipline_theme, content_id, content_title, cycle_number, block_index, started_at, ended_at, planned_minutes, studied_minutes, status, notes, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          record.id,
          origin,
          record.disciplineId,
          record.disciplineName,
          record.disciplineTheme,
          record.contentId,
          record.contentTitle,
          record.cycleNumber,
          record.blockIndex,
          record.startedAt,
          record.endedAt,
          record.plannedMinutes,
          record.studiedMinutes,
          record.status,
          record.notes,
          record.createdAt,
          record.updatedAt,
        ],
      );

      this.db.run(
        'INSERT OR REPLACE INTO active_session (id, session_json) VALUES (1, NULL)',
      );

      if (nextCycleState) {
        const discRow = this.db.get<{ exam_id: string }>(
          'SELECT exam_id FROM disciplines WHERE id = ?',
          [record.disciplineId],
        );
        const targetExamId =
          examId ||
          discRow?.exam_id ||
          this.getMeta('active_exam_id', DEFAULT_EXAM_ID);
        this.db.run(
          'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
          [
            targetExamId,
            nextCycleState.plan ? JSON.stringify(nextCycleState.plan) : null,
            nextCycleState.position,
            nextCycleState.cycleNumber,
            nextCycleState.completedCycles,
          ],
        );
      }

      if (linkedContent) {
        const originLabel = origin === 'trilha' ? 'via Trilha' : 'via Ciclo';
        const updatedContent: ContentNode = {
          ...linkedContent,
          status:
            linkedContent.status === 'nao_iniciado'
              ? 'em_andamento'
              : linkedContent.status,
          lastStudiedAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          history: [
            {
              id: uid('hist'),
              date: now,
              action: `Sessão de estudo ${originLabel} (${formatMinutes(record.studiedMinutes)})`,
              detail: record.notes || undefined,
            },
            ...linkedContent.history,
          ],
        };
        this.upsertContentRow(updatedContent);
        this.queueOutbox('contents', updatedContent.id, 'upsert', updatedContent);
      }

      this.queueOutbox('study_sessions', record.id, 'upsert', {
        ...record,
        origin,
      });
      this.appendOperationLog({
        entityType: 'session',
        entityId: record.id,
        disciplineId: record.disciplineId,
        contentId: record.contentId,
        action: record.status === 'skipped' ? 'pular_bloco' : 'concluir_sessao',
        summary:
          record.status === 'skipped'
            ? `Bloco de ${record.disciplineName} pulado (Ciclo #${record.cycleNumber}).`
            : `Estudou ${formatMinutes(record.studiedMinutes)} de ${record.disciplineName}${record.contentTitle ? ` — ${record.contentTitle}` : ''} (${origin === 'trilha' ? 'Trilha' : 'Ciclo'}).`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  // ============================================================================
  // Caderno de Erros e Revisão Ativa
  // ============================================================================

  async addErrorRecord(input: {
    disciplineId: string;
    contentId: string;
    description: string;
    correction: string;
    prevention: string;
    priority: PriorityLevel;
    origin: ErrorOrigin;
    registrationDate: string;
    referenceQuestion?: ErrorRecord['referenceQuestion'];
  }): Promise<Result<ErrorRecord>> {
    const existing = this.db.all<{
      description: string;
      correction: string;
    }>(
      'SELECT description, correction FROM error_records WHERE discipline_id = ? AND content_id = ? AND deleted_at IS NULL',
      [input.disciplineId, input.contentId],
    );
    const normDesc = normalizeText(input.description);
    const normCorr = normalizeText(input.correction);
    if (
      existing.some(
        (e) =>
          normalizeText(e.description) === normDesc &&
          normalizeText(e.correction) === normCorr,
      )
    ) {
      return {
        ok: false,
        error: 'Já existe um erro idêntico registrado para este conteúdo.',
      };
    }

    const now = new Date().toISOString();
    const record: ErrorRecord = {
      id: uid('err'),
      disciplineId: input.disciplineId,
      contentId: input.contentId,
      description: input.description.trim(),
      correction: input.correction.trim(),
      prevention: input.prevention.trim(),
      priority: input.priority,
      origin: input.origin,
      referenceQuestion: input.referenceQuestion,
      registrationDate: input.registrationDate,
      overcomeAt: input.priority === 'superado' ? now : null,
      reviewHistory: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO error_records
          (id, discipline_id, content_id, description, correction, prevention, priority, origin, reference_question_json, registration_date, overcome_at, created_at, updated_at, deleted_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
        [
          record.id,
          record.disciplineId,
          record.contentId,
          record.description,
          record.correction,
          record.prevention,
          record.priority,
          record.origin,
          record.referenceQuestion ? JSON.stringify(record.referenceQuestion) : null,
          record.registrationDate,
          record.overcomeAt,
          record.createdAt,
          record.updatedAt,
        ],
      );
      this.queueOutbox('error_records', record.id, 'upsert', record);
      this.appendOperationLog({
        entityType: 'error',
        entityId: record.id,
        disciplineId: record.disciplineId,
        contentId: record.contentId,
        action: 'registrar_erro',
        summary: `Erro registrado (${ORIGINS[record.origin].label}, ${PRIORITIES[record.priority].label}).`,
        timestamp: now,
      });
    });

    await this.persist();
    return { ok: true, value: record };
  }

  async updateErrorRecord(record: ErrorRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: ErrorRecord = {
      ...record,
      updatedAt: now,
      overcomeAt:
        record.priority === 'superado' ? (record.overcomeAt ?? now) : null,
      syncStatus: 'pending',
    };
    this.db.transaction(() => {
      this.db.run(
        `UPDATE error_records
         SET discipline_id = ?, content_id = ?, description = ?, correction = ?, prevention = ?, priority = ?, origin = ?, reference_question_json = ?, registration_date = ?, overcome_at = ?, updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        [
          updated.disciplineId,
          updated.contentId,
          updated.description,
          updated.correction,
          updated.prevention,
          updated.priority,
          updated.origin,
          updated.referenceQuestion ? JSON.stringify(updated.referenceQuestion) : null,
          updated.registrationDate,
          updated.overcomeAt,
          updated.updatedAt,
          updated.id,
        ],
      );
      this.queueOutbox('error_records', updated.id, 'upsert', updated);
      this.appendOperationLog({
        entityType: 'error',
        entityId: updated.id,
        disciplineId: updated.disciplineId,
        contentId: updated.contentId,
        action: 'editar_erro',
        summary: `Registro de erro atualizado.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async submitErrorReview(input: {
    error: ErrorRecord;
    newPriority: PriorityLevel;
    action: ErrorReviewEntry['action'];
    notes?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const review: ErrorReviewEntry = {
      id: uid('rev'),
      errorId: input.error.id,
      timestamp: now,
      previousPriority: input.error.priority,
      newPriority: input.newPriority,
      action: input.action,
      notes: input.notes,
    };
    const overcomeAt =
      input.newPriority === 'superado'
        ? (input.error.overcomeAt ?? now)
        : null;

    this.db.transaction(() => {
      this.db.run(
        'UPDATE error_records SET priority = ?, overcome_at = ?, updated_at = ?, sync_status = ? WHERE id = ?',
        [input.newPriority, overcomeAt, now, 'pending', input.error.id],
      );
      this.db.run(
        `INSERT INTO error_reviews
          (id, error_id, timestamp, previous_priority, new_priority, action, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          review.id,
          review.errorId,
          review.timestamp,
          review.previousPriority,
          review.newPriority,
          review.action,
          review.notes ?? null,
        ],
      );
      this.queueOutbox('error_records', input.error.id, 'upsert', {
        id: input.error.id,
        priority: input.newPriority,
        overcomeAt,
        updatedAt: now,
      });
      this.appendOperationLog({
        entityType: 'error',
        entityId: input.error.id,
        disciplineId: input.error.disciplineId,
        contentId: input.error.contentId,
        action: input.action,
        summary: `Revisão ativa de erro: ${PRIORITIES[input.error.priority].label} → ${PRIORITIES[input.newPriority].label}.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  async deleteErrorRecord(error: ErrorRecord): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE error_records SET deleted_at = ?, updated_at = ?, sync_status = ? WHERE id = ?',
        [now, now, 'pending', error.id],
      );
      this.queueOutbox('error_records', error.id, 'delete', {
        id: error.id,
        deletedAt: now,
      });
      this.appendOperationLog({
        entityType: 'error',
        entityId: error.id,
        disciplineId: error.disciplineId,
        contentId: error.contentId,
        action: 'excluir_erro',
        summary: `Registro de erro removido.`,
        timestamp: now,
      });
    });
    await this.persist();
  }

  // ============================================================================
  // Meta, Backup & Restauração
  // ============================================================================

  async updateUserName(userName: string): Promise<void> {
    this.setMeta('user_name', userName.trim() || 'Estudante');
    await this.persist();
  }

  async setActiveDisciplineId(id: string | null): Promise<void> {
    this.setMeta('active_discipline_id', id ?? '');
    await this.persist();
  }

  createBackupPayload(): BackupPayload {
    const state = this.loadAll();
    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      appName: 'TotalControle',
      exportedAt: new Date().toISOString(),
      userName: state.meta.userName,
      exams: state.exams,
      activeExamId: state.meta.activeExamId,
      examCycles: state.examCycles,
      disciplines: state.disciplines,
      cycleSettings: state.cycleSettings,
      cycleState: state.cycleState,
      sessions: state.sessions,
      errors: state.errors,
      operationLogs: state.operationLogs,
    };
  }

  async restoreFromBackup(
    rawJson: string,
    mode: 'replace' | 'merge',
  ): Promise<Result<{ importedDisciplines: number; importedErrors: number; importedSessions: number }>> {
    const parsed = normalizeBackupPayload(rawJson);
    if (!parsed || !Array.isArray(parsed.disciplines)) {
      return {
        ok: false,
        error: 'Este arquivo não é um backup válido do TotalControle ou do Ciclo de Estudos.',
      };
    }

    const now = new Date().toISOString();
    let importedDisciplines = 0;
    let importedErrors = 0;
    let importedSessions = 0;

    this.db.transaction(() => {
      const examIdRemap = new Map<string, string>();

      if (mode === 'replace') {
        this.db.run('DELETE FROM error_reviews');
        this.db.run('DELETE FROM error_records');
        this.db.run('DELETE FROM study_sessions');
        this.db.run('DELETE FROM contents');
        this.db.run('DELETE FROM trail_modules');
        this.db.run('DELETE FROM trail_levels');
        this.db.run('DELETE FROM disciplines');
        this.db.run('DELETE FROM exam_cycle_state');
        this.db.run('DELETE FROM exam_cycle_settings');
        this.db.run('DELETE FROM exams');
        this.db.run('DELETE FROM operation_logs');
        this.db.run(
          'INSERT OR REPLACE INTO active_session (id, session_json) VALUES (1, NULL)',
        );
        this.setMeta('user_name', parsed.userName || 'Estudante');

        const importedExams =
          Array.isArray(parsed.exams) && parsed.exams.length > 0
            ? parsed.exams
            : [createDefaultExam(DEFAULT_EXAM_ID, 'Concurso Principal')];

        for (const ex of importedExams) {
          this.upsertExamRow(ex);
          const cycle = parsed.examCycles?.[ex.id];
          const cs = cycle?.cycleSettings ?? parsed.cycleSettings ?? DEFAULT_CYCLE_SETTINGS;
          const st = cycle?.cycleState ?? parsed.cycleState;
          this.db.run(
            'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
            [ex.id, cs.cycleMinutes, cs.sessionMinutes, cs.minBlockMinutes],
          );
          this.db.run(
            'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
            [
              ex.id,
              st?.plan ? JSON.stringify(st.plan) : null,
              st?.position ?? 0,
              st?.cycleNumber ?? 1,
              st?.completedCycles ?? 0,
            ],
          );
        }

        const targetActiveExam =
          parsed.activeExamId &&
          importedExams.some((e) => e.id === parsed.activeExamId)
            ? parsed.activeExamId
            : importedExams[0].id;
        this.setMeta('active_exam_id', targetActiveExam);
      } else {
        const existingExams = this.db.all<{ id: string; name: string }>(
          'SELECT id, name FROM exams WHERE deleted_at IS NULL',
        );
        const currentActiveExamId =
          this.getMeta('active_exam_id') || existingExams[0]?.id || DEFAULT_EXAM_ID;

        if (Array.isArray(parsed.exams) && parsed.exams.length > 0) {
          for (const ex of parsed.exams) {
            const matched = existingExams.find(
              (ee) => ee.id === ex.id || normalizeText(ee.name) === normalizeText(ex.name),
            );
            if (matched) {
              examIdRemap.set(ex.id, matched.id);
            } else {
              this.upsertExamRow(ex);
              const cycle = parsed.examCycles?.[ex.id];
              const cs = cycle?.cycleSettings ?? DEFAULT_CYCLE_SETTINGS;
              const st = cycle?.cycleState;
              this.db.run(
                'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
                [ex.id, cs.cycleMinutes, cs.sessionMinutes, cs.minBlockMinutes],
              );
              this.db.run(
                'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
                [
                  ex.id,
                  st?.plan ? JSON.stringify(st.plan) : null,
                  st?.position ?? 0,
                  st?.cycleNumber ?? 1,
                  st?.completedCycles ?? 0,
                ],
              );
              existingExams.push({ id: ex.id, name: ex.name });
            }
          }
        } else {
          examIdRemap.set(DEFAULT_EXAM_ID, currentActiveExamId);
        }

        const currentSessionCount =
          this.db.get<{ count: number }>('SELECT count(*) as count FROM study_sessions')?.count ?? 0;
        if (currentSessionCount === 0 && parsed.cycleState?.plan && !parsed.exams?.length) {
          if (parsed.cycleSettings) {
            this.db.run(
              'INSERT OR REPLACE INTO exam_cycle_settings (exam_id, cycle_minutes, session_minutes, min_block_minutes) VALUES (?, ?, ?, ?)',
              [
                currentActiveExamId,
                parsed.cycleSettings.cycleMinutes,
                parsed.cycleSettings.sessionMinutes,
                parsed.cycleSettings.minBlockMinutes,
              ],
            );
          }
          this.db.run(
            'INSERT OR REPLACE INTO exam_cycle_state (exam_id, plan_json, position, cycle_number, completed_cycles) VALUES (?, ?, ?, ?, ?)',
            [
              currentActiveExamId,
              JSON.stringify(parsed.cycleState.plan),
              parsed.cycleState.position ?? 0,
              parsed.cycleState.cycleNumber ?? 1,
              parsed.cycleState.completedCycles ?? 0,
            ],
          );
        }
      }

      const fallbackExamId =
        this.getMeta('active_exam_id') ||
        this.db.get<{ id: string }>('SELECT id FROM exams WHERE deleted_at IS NULL LIMIT 1')?.id ||
        DEFAULT_EXAM_ID;

      const existingDiscs = this.db.all<{ id: string; exam_id: string; name: string }>(
        'SELECT id, exam_id, name FROM disciplines WHERE deleted_at IS NULL',
      );
      const discIdRemap = new Map<string, string>();
      const contentIdRemap = new Map<string, string>();

      for (const rawDisc of parsed.disciplines) {
        const mappedExamId =
          examIdRemap.get(rawDisc.examId || DEFAULT_EXAM_ID) ??
          (rawDisc.examId || fallbackExamId);
        const d: Discipline = { ...rawDisc, examId: mappedExamId };
        if (mode === 'merge') {
          const matched = existingDiscs.find(
            (ed) =>
              ed.id === d.id ||
              (ed.exam_id === d.examId && disciplineNamesMatch(ed.name, d.name)),
          );
          if (matched) {
            discIdRemap.set(d.id, matched.id);
            // Mescla conteúdos/tópicos da disciplina importada na disciplina existente
            const existingContents = this.db.all<{ id: string; title: string }>(
              'SELECT id, title FROM contents WHERE discipline_id = ? AND deleted_at IS NULL',
              [matched.id],
            );
            let targetLevel = this.db.get<{ id: string }>(
              'SELECT id FROM trail_levels WHERE discipline_id = ? ORDER BY sort_order ASC LIMIT 1',
              [matched.id],
            );
            if (!targetLevel) {
              const lvlId = uid('lvl');
              this.db.run(
                'INSERT INTO trail_levels (id, discipline_id, title, subtitle, landscape_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                [lvlId, matched.id, 'Nível 1 — Fundamentos', 'Conteúdos da disciplina', 'Ponto de Partida', 0],
              );
              targetLevel = { id: lvlId };
            }
            let targetModule = this.db.get<{ id: string }>(
              'SELECT id FROM trail_modules WHERE discipline_id = ? ORDER BY sort_order ASC LIMIT 1',
              [matched.id],
            );
            if (!targetModule) {
              const modId = uid('mod');
              this.db.run(
                'INSERT INTO trail_modules (id, level_id, discipline_id, title, subtitle, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                [modId, targetLevel.id, matched.id, 'Módulo Geral', null, 0],
              );
              targetModule = { id: modId };
            }

            let nextSort = existingContents.length;
            for (const lvl of d.levels ?? []) {
              for (const mod of lvl.modules ?? []) {
                for (const cnt of mod.contents ?? []) {
                  const matchedContent = existingContents.find(
                    (ec) =>
                      ec.id === cnt.id ||
                      normalizeText(ec.title) === normalizeText(cnt.title),
                  );
                  if (matchedContent) {
                    contentIdRemap.set(cnt.id, matchedContent.id);
                  } else {
                    this.upsertContentRow({
                      ...cnt,
                      disciplineId: matched.id,
                      levelId: targetLevel.id,
                      moduleId: targetModule.id,
                      sortOrder: nextSort++,
                    });
                    existingContents.push({ id: cnt.id, title: cnt.title });
                  }
                }
              }
            }
            continue;
          }
        }
        this.insertDisciplineTree(d);
        importedDisciplines++;
      }

      const existingSessIds = new Set(
        this.db
          .all<{ id: string }>('SELECT id FROM study_sessions')
          .map((r) => r.id),
      );
      for (const s of parsed.sessions ?? []) {
        if (mode === 'merge' && existingSessIds.has(s.id)) continue;
        const mappedDiscId = discIdRemap.get(s.disciplineId) ?? s.disciplineId;
        const mappedContentId = s.contentId
          ? (contentIdRemap.get(s.contentId) ?? s.contentId)
          : null;
        this.db.run(
          `INSERT OR IGNORE INTO study_sessions
            (id, origin, discipline_id, discipline_name, discipline_theme, content_id, content_title, cycle_number, block_index, started_at, ended_at, planned_minutes, studied_minutes, status, notes, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            s.id,
            s.origin === 'trilha' ? 'trilha' : 'ciclo',
            mappedDiscId,
            s.disciplineName,
            s.disciplineTheme,
            mappedContentId,
            s.contentTitle,
            s.cycleNumber,
            s.blockIndex,
            s.startedAt,
            s.endedAt,
            s.plannedMinutes,
            s.studiedMinutes,
            s.status,
            s.notes,
            s.createdAt,
            s.updatedAt,
          ],
        );
        importedSessions++;
      }

      const existingErrIds = new Set(
        this.db
          .all<{ id: string }>('SELECT id FROM error_records')
          .map((r) => r.id),
      );
      for (const e of parsed.errors ?? []) {
        if (mode === 'merge' && existingErrIds.has(e.id)) continue;
        const mappedDiscId = discIdRemap.get(e.disciplineId) ?? e.disciplineId;
        const mappedContentId = contentIdRemap.get(e.contentId) ?? e.contentId;
        this.db.run(
          `INSERT OR IGNORE INTO error_records
            (id, discipline_id, content_id, description, correction, prevention, priority, origin, reference_question_json, registration_date, overcome_at, created_at, updated_at, deleted_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
          [
            e.id,
            mappedDiscId,
            mappedContentId,
            e.description,
            e.correction,
            e.prevention,
            e.priority,
            e.origin,
            e.referenceQuestion ? JSON.stringify(e.referenceQuestion) : null,
            e.registrationDate,
            e.overcomeAt,
            e.createdAt,
            e.updatedAt,
          ],
        );
        for (const rev of e.reviewHistory ?? []) {
          this.db.run(
            `INSERT OR IGNORE INTO error_reviews
              (id, error_id, timestamp, previous_priority, new_priority, action, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              rev.id,
              e.id,
              rev.timestamp,
              rev.previousPriority,
              rev.newPriority,
              rev.action,
              rev.notes ?? null,
            ],
          );
        }
        importedErrors++;
      }

      if (parsed.disciplines.length > 0) {
        const currentActive = this.getMeta('active_discipline_id');
        const activeExists = this.db.get<{ id: string }>(
          'SELECT id FROM disciplines WHERE id = ? AND deleted_at IS NULL',
          [currentActive],
        );
        if (!activeExists || mode === 'replace') {
          this.setMeta('active_discipline_id', parsed.disciplines[0].id);
        }
      }

      this.appendOperationLog({
        entityType: 'backup',
        entityId: uid('bkp'),
        disciplineId: null,
        contentId: null,
        action: mode === 'replace' ? 'restaurar_backup' : 'mesclar_backup',
        summary: `Backup ${mode === 'replace' ? 'restaurado' : 'mesclado'}: ${importedDisciplines} disciplinas, ${importedSessions} sessões, ${importedErrors} erros.`,
        timestamp: now,
      });
    });

    await this.persist();
    return {
      ok: true,
      value: { importedDisciplines, importedErrors, importedSessions },
    };
  }

  exportSqliteBytes(): Uint8Array {
    return this.db.exportBytes();
  }

  async resetAll(): Promise<void> {
    this.db.transaction(() => {
      this.db.run('DELETE FROM sync_outbox');
      this.db.run('DELETE FROM operation_logs');
      this.db.run('DELETE FROM error_reviews');
      this.db.run('DELETE FROM error_records');
      this.db.run('DELETE FROM study_sessions');
      this.db.run('DELETE FROM contents');
      this.db.run('DELETE FROM trail_modules');
      this.db.run('DELETE FROM trail_levels');
      this.db.run('DELETE FROM disciplines');
      this.db.run('DELETE FROM exam_cycle_state');
      this.db.run('DELETE FROM exam_cycle_settings');
      this.db.run('DELETE FROM exams');
      this.db.run('DELETE FROM meta');
    });
    this.ensureInitialized();
    await this.persist();
  }
}

