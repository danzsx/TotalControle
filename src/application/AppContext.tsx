import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_EXAM_ID, SCHEMA_VERSION } from '../domain/constants';
import { evaluateAllCards } from '../domain/cards/registry';
import type { EvaluatedCard } from '../domain/cards/types';
import { computePlan } from '../domain/distribution';
import {
  createCustomDiscipline,
  defaultChecklist,
  instantiateTrailTemplate,
} from '../domain/prebuiltTrails';
import { uid } from '../domain/text';
import {
  HEARTBEAT_INTERVAL_MS,
  elapsedMs,
  heartbeat,
  pauseTimer,
  resumeTimer,
} from '../domain/timer';
import type {
  ActiveSession,
  AppMeta,
  ContentNode,
  CycleBlock,
  CycleSettings,
  CycleState,
  Discipline,
  DisciplineTheme,
  Difficulty,
  ErrorOrigin,
  ErrorRecord,
  ErrorReviewEntry,
  Exam,
  NavTab,
  OperationLog,
  PriorityLevel,
  Result,
  SessionRecord,
  SessionStatus,
  TrailTemplate,
} from '../domain/types';
import {
  validateCycleSettings,
  validateDisciplineInput,
  validateErrorInput,
  validateExamInput,
} from '../domain/validation';
import { createStorageBackend, type StorageBackend } from '../infra/desktop/bridge';
import { UnifiedRepository } from '../infra/sqlite/repository';
import type { SyncStatusSummary } from '../infra/sync/syncProvider';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface AppContextValue {
  ready: boolean;
  loadError: string | null;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  meta: AppMeta;
  exams: Exam[];
  activeExam: Exam | null;
  allDisciplines: Discipline[];
  disciplines: Discipline[];
  activeDiscipline: Discipline | null;
  cycleSettings: CycleSettings;
  cycleState: CycleState;
  activeSession: ActiveSession | null;
  elapsedSessionMs: number;
  allSessions: SessionRecord[];
  sessions: SessionRecord[];
  allErrors: ErrorRecord[];
  errors: ErrorRecord[];
  operationLogs: OperationLog[];
  syncSummary: SyncStatusSummary;
  dbLocationLabel: string;
  isDesktop: boolean;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  notify: (message: string, tone?: ToastItem['tone']) => void;

  // Navegação contextual entre módulos
  selectedContentForDrawer: { disciplineId: string; contentId: string } | null;
  setSelectedContentForDrawer: (
    val: { disciplineId: string; contentId: string } | null,
  ) => void;
  errorPrefill: { disciplineId?: string; contentId?: string } | null;
  clearErrorPrefill: () => void;
  errorsAllDisciplines: boolean;
  setErrorsAllDisciplines: (val: boolean) => void;
  openContentInTrail: (disciplineId: string, contentId: string) => void;
  openRegisterErrorForContent: (disciplineId: string, contentId: string) => void;
  startTrailSessionForContent: (disciplineId: string, contentId: string) => Promise<void>;
  startCycleSessionForContent: (disciplineId: string, contentId: string) => Promise<void>;

  // Concursos
  selectActiveExam: (id: string) => Promise<void>;
  addExam: (input: {
    name: string;
    description?: string;
    theme?: DisciplineTheme;
    targetDate?: string | null;
  }) => Promise<Result<Exam>>;
  updateExam: (exam: Exam, summary?: string) => Promise<Result<void>>;
  deleteExam: (examId: string) => Promise<Result<void>>;

  // Disciplinas e Trilhas
  selectActiveDiscipline: (id: string) => Promise<void>;
  addDisciplineFromTemplate: (
    template: TrailTemplate,
    options?: { inCycle?: boolean; weight?: 1 | 2 | 3 | 4 | 5; difficulty?: Difficulty },
  ) => Promise<Discipline>;
  addDisciplinesFromTemplates: (
    templates: TrailTemplate[],
    options?: { inCycle?: boolean },
  ) => Promise<Discipline[]>;
  addCustomDiscipline: (input: {
    name: string;
    description: string;
    theme: DisciplineTheme;
    weight: 1 | 2 | 3 | 4 | 5;
    difficulty: Difficulty;
    inCycle: boolean;
  }) => Promise<Result<Discipline>>;
  updateDiscipline: (discipline: Discipline, summary?: string) => Promise<void>;
  deleteDiscipline: (disciplineId: string) => Promise<void>;
  updateContentNode: (
    disciplineId: string,
    content: ContentNode,
    logSummary?: string,
  ) => Promise<void>;
  addContentToModule: (
    disciplineId: string,
    levelId: string,
    moduleId: string,
    input: { title: string; description: string; difficulty: 1 | 2 | 3 | 4; editalRef?: string },
  ) => Promise<void>;
  deleteContentNode: (disciplineId: string, content: ContentNode) => Promise<void>;

  // Ciclo de Estudos e Cronômetro
  updateCycleSettings: (settings: CycleSettings) => Promise<Result<void>>;
  jumpToCycleBlock: (blockIndex: number) => Promise<void>;
  advanceCycleBlock: () => Promise<void>;
  restartCycle: () => Promise<void>;
  startBlockSession: (
    block?: CycleBlock,
    contentId?: string | null,
    contentTitle?: string | null,
  ) => Promise<void>;
  pauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  setActiveSessionNotes: (notes: string) => Promise<void>;
  discardActiveSession: () => Promise<void>;
  finishActiveSession: (overrideMinutes?: number) => Promise<void>;
  skipCurrentBlock: () => Promise<void>;

  // Caderno de Erros e Revisão Ativa
  registerError: (input: {
    disciplineId: string;
    contentId: string;
    description: string;
    correction: string;
    prevention: string;
    priority: PriorityLevel;
    origin: ErrorOrigin;
    registrationDate: string;
    referenceQuestion?: ErrorRecord['referenceQuestion'];
  }) => Promise<Result<ErrorRecord>>;
  updateError: (record: ErrorRecord) => Promise<void>;
  submitErrorReview: (
    error: ErrorRecord,
    newPriority: PriorityLevel,
    action?: ErrorReviewEntry['action'],
    notes?: string,
  ) => Promise<void>;
  deleteError: (error: ErrorRecord) => Promise<void>;

  // Cartas Colecionáveis & Conquistas
  evaluatedCards: EvaluatedCard[];

  // Configurações & Backup
  updateUserName: (name: string) => Promise<void>;
  exportJsonBackup: () => Promise<void>;
  exportSqliteBackup: () => Promise<void>;
  restoreBackupJson: (
    rawJson: string,
    mode: 'replace' | 'merge',
  ) => Promise<Result<{ importedDisciplines: number; importedErrors: number; importedSessions: number }>>;
  revealDataFolder: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const repoRef = useRef<UnifiedRepository | null>(null);
  const backendRef = useRef<StorageBackend | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const [meta, setMeta] = useState<AppMeta>({
    schemaVersion: SCHEMA_VERSION,
    deviceId: '',
    userName: 'Estudante',
    activeExamId: null,
    activeDisciplineId: null,
    lastSyncAt: null,
  });
  const [exams, setExams] = useState<Exam[]>([]);
  const [examCycles, setExamCycles] = useState<
    Record<string, { cycleSettings: CycleSettings; cycleState: CycleState }>
  >({});
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [cycleSettings, setCycleSettings] = useState<CycleSettings>({
    cycleMinutes: 600,
    sessionMinutes: 50,
    minBlockMinutes: 25,
  });
  const [cycleState, setCycleState] = useState<CycleState>({
    plan: null,
    position: 0,
    cycleNumber: 1,
    completedCycles: 0,
  });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsedSessionMs, setElapsedSessionMs] = useState(0);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [allErrors, setAllErrors] = useState<ErrorRecord[]>([]);
  const [allOperationLogs, setAllOperationLogs] = useState<OperationLog[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncStatusSummary>({
    mode: 'offline',
    pendingChanges: 0,
    lastSyncAt: null,
  });
  const [dbLocationLabel, setDbLocationLabel] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [unlockedCardsMap, setUnlockedCardsMap] = useState<Record<string, string>>({});
  const cardsInitializedRef = useRef(false);

  const [selectedContentForDrawer, setSelectedContentForDrawer] = useState<{
    disciplineId: string;
    contentId: string;
  } | null>(null);
  const [errorPrefill, setErrorPrefill] = useState<{
    disciplineId?: string;
    contentId?: string;
  } | null>(null);
  const [errorsAllDisciplines, setErrorsAllDisciplines] = useState(false);

  const notify = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info') => {
      const id = uid('toast');
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncFromRepo = useCallback(() => {
    const repo = repoRef.current;
    if (!repo) return;
    const loaded = repo.loadAll();
    setMeta(loaded.meta);
    setExams(loaded.exams);
    setExamCycles(loaded.examCycles);
    setAllDisciplines(loaded.disciplines);
    setCycleSettings(loaded.cycleSettings);
    setCycleState(loaded.cycleState);
    setActiveSession(loaded.activeSession);
    setElapsedSessionMs(
      loaded.activeSession ? elapsedMs(loaded.activeSession, Date.now()) : 0,
    );
    setAllSessions(loaded.sessions);
    setAllErrors(loaded.errors);
    setAllOperationLogs(loaded.operationLogs);
    setSyncSummary(loaded.syncSummary);
    setUnlockedCardsMap(repo.getUnlockedCardsMap());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const backend = createStorageBackend();
        backendRef.current = backend;
        const repo = await UnifiedRepository.open(backend);
        if (!mounted) return;
        repoRef.current = repo;
        const loaded = repo.loadAll();
        setMeta(loaded.meta);
        setExams(loaded.exams);
        setExamCycles(loaded.examCycles);
        setAllDisciplines(loaded.disciplines);
        setCycleSettings(loaded.cycleSettings);
        setCycleState(loaded.cycleState);
        setActiveSession(loaded.activeSession);
        setElapsedSessionMs(
          loaded.activeSession ? elapsedMs(loaded.activeSession, Date.now()) : 0,
        );
        setAllSessions(loaded.sessions);
        setAllErrors(loaded.errors);
        setAllOperationLogs(loaded.operationLogs);
        setSyncSummary(loaded.syncSummary);
        setUnlockedCardsMap(repo.getUnlockedCardsMap());
        setDbLocationLabel(await backend.getLocationLabel());
        if (loaded.sessionRestore?.recovered) {
          notify(
            'Sessão em andamento foi pausada automaticamente após o encerramento do aplicativo.',
            'warning',
          );
        }
        setReady(true);
      } catch (err) {
        if (!mounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Não foi possível inicializar o banco de dados local.',
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify]);

  // Tick visual do cronômetro a cada 500ms
  useEffect(() => {
    if (!activeSession) {
      setElapsedSessionMs(0);
      return;
    }
    setElapsedSessionMs(elapsedMs(activeSession, Date.now()));
    if (activeSession.status !== 'running') return;
    const interval = setInterval(() => {
      setElapsedSessionMs(elapsedMs(activeSession, Date.now()));
    }, 500);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Heartbeat a cada 15s para recuperação em caso de queda
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return;
    const interval = setInterval(() => {
      const repo = repoRef.current;
      if (!repo) return;
      const beaten = heartbeat(activeSession, Date.now());
      setActiveSession(beaten);
      void repo.saveActiveSession(beaten);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeSession]);

  const activeExam = useMemo(() => {
    if (exams.length === 0) return null;
    return exams.find((e) => e.id === meta.activeExamId) ?? exams[0];
  }, [exams, meta.activeExamId]);

  const disciplines = useMemo(() => {
    if (!activeExam) return allDisciplines;
    return allDisciplines.filter((d) => d.examId === activeExam.id);
  }, [allDisciplines, activeExam]);

  const activeExamDisciplineIds = useMemo(
    () => new Set(disciplines.map((d) => d.id)),
    [disciplines],
  );

  const sessions = useMemo(
    () => allSessions.filter((s) => activeExamDisciplineIds.has(s.disciplineId)),
    [allSessions, activeExamDisciplineIds],
  );

  const errors = useMemo(
    () => allErrors.filter((e) => activeExamDisciplineIds.has(e.disciplineId)),
    [allErrors, activeExamDisciplineIds],
  );

  const operationLogs = useMemo(
    () =>
      allOperationLogs.filter(
        (l) => !l.disciplineId || activeExamDisciplineIds.has(l.disciplineId),
      ),
    [allOperationLogs, activeExamDisciplineIds],
  );

  const activeDiscipline = useMemo(() => {
    if (disciplines.length === 0) return null;
    return (
      disciplines.find((d) => d.id === meta.activeDisciplineId) ?? disciplines[0]
    );
  }, [disciplines, meta.activeDisciplineId]);

  const selectActiveExam = useCallback(
    async (id: string) => {
      if (id === activeExam?.id) return;
      setSelectedContentForDrawer(null);
      setErrorsAllDisciplines(false);
      await repoRef.current?.setActiveExamId(id);
      syncFromRepo();
    },
    [activeExam?.id, syncFromRepo],
  );

  const addExam = useCallback(
    async (input: {
      name: string;
      description?: string;
      theme?: DisciplineTheme;
      targetDate?: string | null;
    }): Promise<Result<Exam>> => {
      const check = validateExamInput({ name: input.name });
      if (!check.ok) return check;
      const now = new Date().toISOString();
      const exam: Exam = {
        id: uid('exam'),
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        theme: input.theme ?? 'sky',
        targetDate: input.targetDate ?? null,
        sortOrder: exams.length,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      };
      await repoRef.current?.saveExam(exam, `Concurso "${exam.name}" criado.`);
      await repoRef.current?.setActiveExamId(exam.id);
      setSelectedContentForDrawer(null);
      setErrorsAllDisciplines(false);
      syncFromRepo();
      notify(`Concurso "${exam.name}" criado.`, 'success');
      return { ok: true, value: exam };
    },
    [exams.length, notify, syncFromRepo],
  );

  const updateExam = useCallback(
    async (exam: Exam, summary?: string): Promise<Result<void>> => {
      const check = validateExamInput({ name: exam.name });
      if (!check.ok) return check;
      await repoRef.current?.saveExam(
        { ...exam, name: exam.name.trim(), description: exam.description.trim() },
        summary,
      );
      syncFromRepo();
      notify('Concurso atualizado.', 'success');
      return { ok: true, value: undefined };
    },
    [notify, syncFromRepo],
  );

  const deleteExam = useCallback(
    async (examId: string): Promise<Result<void>> => {
      if (exams.length <= 1) {
        return {
          ok: false,
          error: 'É necessário manter pelo menos um concurso ativo.',
        };
      }
      const target = exams.find((e) => e.id === examId);
      if (!target) return { ok: false, error: 'Concurso não encontrado.' };
      await repoRef.current?.deleteExam(examId, target.name);
      if (meta.activeExamId === examId) {
        const nextExam = exams.find((e) => e.id !== examId);
        await repoRef.current?.setActiveExamId(nextExam?.id ?? null);
      }
      setSelectedContentForDrawer(null);
      syncFromRepo();
      notify(`Concurso "${target.name}" removido.`, 'info');
      return { ok: true, value: undefined };
    },
    [exams, meta.activeExamId, notify, syncFromRepo],
  );

  const clearErrorPrefill = useCallback(() => setErrorPrefill(null), []);

  const openContentInTrail = useCallback(
    async (disciplineId: string, contentId: string) => {
      const targetDisc = allDisciplines.find((d) => d.id === disciplineId);
      if (targetDisc && targetDisc.examId !== activeExam?.id) {
        await repoRef.current?.setActiveExamId(targetDisc.examId);
      }
      await repoRef.current?.setActiveDisciplineId(disciplineId);
      syncFromRepo();
      setSelectedContentForDrawer({ disciplineId, contentId });
      setActiveTab('trails');
    },
    [activeExam?.id, allDisciplines, syncFromRepo],
  );

  const openRegisterErrorForContent = useCallback(
    async (disciplineId: string, contentId: string) => {
      setErrorsAllDisciplines(false);
      const targetDisc = allDisciplines.find((d) => d.id === disciplineId);
      if (targetDisc && targetDisc.examId !== activeExam?.id) {
        await repoRef.current?.setActiveExamId(targetDisc.examId);
      }
      await repoRef.current?.setActiveDisciplineId(disciplineId);
      syncFromRepo();
      setErrorPrefill({ disciplineId, contentId });
      setActiveTab('errors');
    },
    [activeExam?.id, allDisciplines, syncFromRepo],
  );

  const selectActiveDiscipline = useCallback(
    async (id: string) => {
      await repoRef.current?.setActiveDisciplineId(id);
      syncFromRepo();
    },
    [syncFromRepo],
  );

  const addDisciplineFromTemplate = useCallback(
    async (
      template: TrailTemplate,
      options?: { inCycle?: boolean; weight?: 1 | 2 | 3 | 4 | 5; difficulty?: Difficulty },
    ) => {
      const repo = repoRef.current!;
      const disc = instantiateTrailTemplate(template, {
        examId: activeExam?.id ?? DEFAULT_EXAM_ID,
        sortOrder: disciplines.length,
        inCycle: options?.inCycle ?? false,
        weight: options?.weight ?? 3,
        difficulty: options?.difficulty ?? 'medium',
      });
      await repo.saveDiscipline(disc, `Trilha "${disc.name}" adicionada.`);
      await repo.setActiveDisciplineId(disc.id);
      syncFromRepo();
      notify(`Trilha "${disc.name}" adicionada.`, 'success');
      return disc;
    },
    [activeExam?.id, disciplines.length, notify, syncFromRepo],
  );

  const addDisciplinesFromTemplates = useCallback(
    async (
      templates: TrailTemplate[],
      options?: { inCycle?: boolean },
    ) => {
      const repo = repoRef.current!;
      const currentCount = disciplines.length;
      const createdList: Discipline[] = [];

      for (let i = 0; i < templates.length; i++) {
        const tpl = templates[i];
        const disc = instantiateTrailTemplate(tpl, {
          examId: activeExam?.id ?? DEFAULT_EXAM_ID,
          sortOrder: currentCount + i,
          inCycle: options?.inCycle ?? false,
        });
        await repo.saveDiscipline(disc, `Trilha "${disc.name}" adicionada.`);
        createdList.push(disc);
      }

      if (createdList[0]) {
        await repo.setActiveDisciplineId(createdList[0].id);
      }
      syncFromRepo();
      notify(`${createdList.length} trilhas adicionadas com sucesso!`, 'success');
      return createdList;
    },
    [activeExam?.id, disciplines.length, notify, syncFromRepo],
  );

  const addCustomDiscipline = useCallback(
    async (input: {
      name: string;
      description: string;
      theme: DisciplineTheme;
      weight: 1 | 2 | 3 | 4 | 5;
      difficulty: Difficulty;
      inCycle: boolean;
    }): Promise<Result<Discipline>> => {
      const check = validateDisciplineInput({
        name: input.name,
        weight: input.weight,
      });
      if (!check.ok) return check;
      const repo = repoRef.current!;
      const disc = createCustomDiscipline({
        ...input,
        examId: activeExam?.id ?? DEFAULT_EXAM_ID,
        sortOrder: disciplines.length,
      });
      await repo.saveDiscipline(disc, `Disciplina "${disc.name}" criada.`);
      await repo.setActiveDisciplineId(disc.id);
      syncFromRepo();
      notify(`Disciplina "${disc.name}" criada.`, 'success');
      return { ok: true, value: disc };
    },
    [activeExam?.id, disciplines.length, notify, syncFromRepo],
  );

  const updateDiscipline = useCallback(
    async (discipline: Discipline, summary?: string) => {
      await repoRef.current?.saveDiscipline(discipline, summary);
      syncFromRepo();
    },
    [syncFromRepo],
  );

  const deleteDiscipline = useCallback(
    async (disciplineId: string) => {
      const target = disciplines.find((d) => d.id === disciplineId);
      if (!target) return;
      await repoRef.current?.deleteDiscipline(disciplineId, target.name);
      syncFromRepo();
      notify(`Disciplina "${target.name}" removida.`, 'info');
    },
    [disciplines, notify, syncFromRepo],
  );

  const updateContentNode = useCallback(
    async (_disciplineId: string, content: ContentNode, logSummary?: string) => {
      await repoRef.current?.saveContentNode(content, logSummary);
      syncFromRepo();
    },
    [syncFromRepo],
  );

  const addContentToModule = useCallback(
    async (
      disciplineId: string,
      levelId: string,
      moduleId: string,
      input: {
        title: string;
        description: string;
        difficulty: 1 | 2 | 3 | 4;
        editalRef?: string;
      },
    ) => {
      const disc = disciplines.find((d) => d.id === disciplineId);
      if (!disc) return;
      const now = new Date().toISOString();
      const mod = disc.levels
        .find((l) => l.id === levelId)
        ?.modules.find((m) => m.id === moduleId);
      const newNode: ContentNode = {
        id: uid('cnt'),
        disciplineId,
        levelId,
        moduleId,
        title: input.title.trim(),
        description: input.description.trim(),
        editalRef: input.editalRef?.trim() || undefined,
        sortOrder: mod ? mod.contents.length : 0,
        status: 'nao_iniciado',
        checklist: defaultChecklist(),
        completedAt: null,
        exercisesDone: 0,
        exercisesCorrect: 0,
        difficulty: input.difficulty,
        markedForReview: false,
        reviewCount: 0,
        lastStudiedAt: null,
        notes: '',
        difficulties: '',
        history: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      };
      await repoRef.current?.saveContentNode(
        newNode,
        `Conteúdo "${newNode.title}" adicionado em ${disc.name}.`,
      );
      syncFromRepo();
      notify(`Conteúdo "${newNode.title}" adicionado.`, 'success');
    },
    [disciplines, notify, syncFromRepo],
  );

  const deleteContentNode = useCallback(
    async (_disciplineId: string, content: ContentNode) => {
      await repoRef.current?.deleteContentNode(content);
      syncFromRepo();
      notify(`Conteúdo "${content.title}" removido.`, 'info');
    },
    [notify, syncFromRepo],
  );

  const updateCycleSettings = useCallback(
    async (settings: CycleSettings): Promise<Result<void>> => {
      const check = validateCycleSettings(settings);
      if (!check.ok) return check;
      await repoRef.current?.updateCycleSettings(settings);
      syncFromRepo();
      notify('Configurações do ciclo atualizadas.', 'success');
      return { ok: true, value: undefined };
    },
    [notify, syncFromRepo],
  );

  const jumpToCycleBlock = useCallback(
    async (blockIndex: number) => {
      const blocks = cycleState.plan?.blocks ?? [];
      if (blockIndex < 0 || blockIndex >= blocks.length) return;
      await repoRef.current?.saveCycleState({
        ...cycleState,
        position: blockIndex,
      });
      syncFromRepo();
    },
    [cycleState, syncFromRepo],
  );

  const advanceCycleState = useCallback(
    (state: CycleState): CycleState => {
      const total = state.plan?.blocks.length ?? 0;
      if (total === 0) return state;
      const nextPos = state.position + 1;
      if (nextPos >= total) {
        return {
          ...state,
          position: 0,
          cycleNumber: state.cycleNumber + 1,
          completedCycles: state.completedCycles + 1,
        };
      }
      return { ...state, position: nextPos };
    },
    [],
  );

  const advanceCycleBlock = useCallback(async () => {
    const next = advanceCycleState(cycleState);
    await repoRef.current?.saveCycleState(next);
    syncFromRepo();
  }, [advanceCycleState, cycleState, syncFromRepo]);

  const restartCycle = useCallback(async () => {
    const plan = computePlan(disciplines, cycleSettings);
    await repoRef.current?.saveCycleState(
      {
        ...cycleState,
        plan,
        position: 0,
      },
      `Ciclo #${cycleState.cycleNumber} reiniciado para o bloco 1.`,
    );
    syncFromRepo();
    notify('Ciclo reposicionado no primeiro bloco.', 'info');
  }, [cycleSettings, cycleState, disciplines, notify, syncFromRepo]);

  const startBlockSession = useCallback(
    async (
      blockArg?: CycleBlock,
      contentId: string | null = null,
      contentTitle: string | null = null,
    ) => {
      if (activeSession) {
        notify('Já existe uma sessão em andamento.', 'warning');
        return;
      }
      const blocks = cycleState.plan?.blocks ?? [];
      const block = blockArg ?? blocks[cycleState.position];
      if (!block) {
        notify('Adicione disciplinas ao ciclo antes de iniciar.', 'warning');
        return;
      }
      const nowMs = Date.now();
      const session: ActiveSession = {
        id: uid('sess'),
        origin: 'ciclo',
        disciplineId: block.disciplineId,
        disciplineName: block.disciplineName,
        contentId,
        contentTitle,
        blockIndex: block.index,
        cycleNumber: cycleState.cycleNumber,
        plannedMinutes: block.plannedMinutes,
        status: 'running',
        startedAt: new Date(nowMs).toISOString(),
        accumulatedMs: 0,
        lastResumedAt: nowMs,
        lastHeartbeatAt: nowMs,
        notes: '',
      };
      await repoRef.current?.saveActiveSession(session);
      syncFromRepo();
    },
    [activeSession, cycleState, notify, syncFromRepo],
  );

  const startTrailSessionForContent = useCallback(
    async (disciplineId: string, contentId: string) => {
      if (activeSession) {
        notify(
          'Finalize ou descarte a sessão atual antes de iniciar outra.',
          'warning',
        );
        return;
      }
      const disc = disciplines.find((d) => d.id === disciplineId);
      if (!disc) return;
      let contentTitle: string | null = null;
      for (const l of disc.levels) {
        for (const m of l.modules) {
          const found = m.contents.find((c) => c.id === contentId);
          if (found) contentTitle = found.title;
        }
      }
      const nowMs = Date.now();
      const session: ActiveSession = {
        id: uid('sess'),
        origin: 'trilha',
        disciplineId: disc.id,
        disciplineName: disc.name,
        contentId,
        contentTitle,
        blockIndex: -1,
        cycleNumber: 0,
        plannedMinutes: disc.sessionMinutesOverride ?? cycleSettings.sessionMinutes,
        status: 'running',
        startedAt: new Date(nowMs).toISOString(),
        accumulatedMs: 0,
        lastResumedAt: nowMs,
        lastHeartbeatAt: nowMs,
        notes: '',
      };
      await repoRef.current?.saveActiveSession(session);
      syncFromRepo();
      notify(`Sessão iniciada em "${contentTitle ?? disc.name}".`, 'info');
    },
    [activeSession, cycleSettings.sessionMinutes, disciplines, notify, syncFromRepo],
  );

  const startCycleSessionForContent = useCallback(
    async (disciplineId: string, contentId: string) => {
      const disc = disciplines.find((d) => d.id === disciplineId);
      if (!disc) return;
      let contentTitle: string | null = null;
      for (const l of disc.levels) {
        for (const m of l.modules) {
          const found = m.contents.find((c) => c.id === contentId);
          if (found) contentTitle = found.title;
        }
      }
      setActiveTab('cycle');
      if (activeSession) {
        notify(
          'Finalize ou descarte a sessão atual antes de iniciar outra.',
          'warning',
        );
        return;
      }
      const matchingBlock = cycleState.plan?.blocks.find(
        (b) => b.disciplineId === disciplineId,
      );
      const block: CycleBlock = matchingBlock ?? {
        index: cycleState.position,
        disciplineId: disc.id,
        disciplineName: disc.name,
        theme: disc.theme,
        plannedMinutes: disc.sessionMinutesOverride ?? cycleSettings.sessionMinutes,
        occurrence: 1,
        totalForDiscipline: 1,
      };
      await startBlockSession(block, contentId, contentTitle);
    },
    [
      activeSession,
      cycleSettings.sessionMinutes,
      cycleState.plan,
      cycleState.position,
      disciplines,
      notify,
      startBlockSession,
    ],
  );

  const pauseActiveSession = useCallback(async () => {
    if (!activeSession) return;
    const paused = pauseTimer(activeSession, Date.now());
    await repoRef.current?.saveActiveSession(paused);
    syncFromRepo();
  }, [activeSession, syncFromRepo]);

  const resumeActiveSession = useCallback(async () => {
    if (!activeSession) return;
    const resumed = resumeTimer(activeSession, Date.now());
    await repoRef.current?.saveActiveSession(resumed);
    syncFromRepo();
  }, [activeSession, syncFromRepo]);

  const setActiveSessionNotes = useCallback(
    async (notes: string) => {
      if (!activeSession) return;
      const next = { ...activeSession, notes };
      setActiveSession(next);
      await repoRef.current?.saveActiveSession(next);
    },
    [activeSession],
  );

  const discardActiveSession = useCallback(async () => {
    const isTrail = activeSession?.origin === 'trilha';
    await repoRef.current?.saveActiveSession(null);
    syncFromRepo();
    notify(
      isTrail
        ? 'Sessão descartada.'
        : 'Sessão descartada sem alterar o ciclo.',
      'info',
    );
  }, [activeSession?.origin, notify, syncFromRepo]);

  const finishActiveSession = useCallback(
    async (overrideMinutes?: number) => {
      if (!activeSession) return;
      const origin = activeSession.origin === 'trilha' ? 'trilha' : 'ciclo';
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const rawMinutes = Math.round(elapsedMs(activeSession, nowMs) / 60_000);
      const studiedMinutes =
        overrideMinutes !== undefined
          ? Math.max(0, Math.round(overrideMinutes))
          : Math.max(1, rawMinutes);

      const disc = allDisciplines.find((d) => d.id === activeSession.disciplineId);
      const status: SessionStatus =
        studiedMinutes <= 0
          ? 'skipped'
          : studiedMinutes >= activeSession.plannedMinutes * 0.8
            ? 'completed'
            : 'partial';

      const record: SessionRecord = {
        id: activeSession.id,
        origin,
        disciplineId: activeSession.disciplineId,
        disciplineName: activeSession.disciplineName,
        disciplineTheme: disc?.theme ?? 'sky',
        contentId: activeSession.contentId,
        contentTitle: activeSession.contentTitle,
        cycleNumber: activeSession.cycleNumber,
        blockIndex: activeSession.blockIndex,
        startedAt: activeSession.startedAt,
        endedAt: nowIso,
        plannedMinutes: activeSession.plannedMinutes,
        studiedMinutes,
        status,
        notes: activeSession.notes,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'pending',
      };

      let linkedContent: ContentNode | null = null;
      if (disc && activeSession.contentId) {
        for (const l of disc.levels) {
          for (const m of l.modules) {
            const found = m.contents.find(
              (c) => c.id === activeSession.contentId,
            );
            if (found) linkedContent = found;
          }
        }
      }

      const targetExamId = disc?.examId ?? activeExam?.id;
      const targetCycleState =
        (targetExamId ? examCycles[targetExamId]?.cycleState : undefined) ??
        cycleState;
      const nextCycleState =
        origin === 'ciclo' ? advanceCycleState(targetCycleState) : null;
      await repoRef.current?.finishStudySession({
        record,
        nextCycleState,
        linkedContent,
        examId: targetExamId,
      });
      syncFromRepo();
      notify('Sessão registrada no histórico.', 'success');
    },
    [
      activeExam?.id,
      activeSession,
      advanceCycleState,
      allDisciplines,
      cycleState,
      examCycles,
      notify,
      syncFromRepo,
    ],
  );

  const skipCurrentBlock = useCallback(async () => {
    const blocks = cycleState.plan?.blocks ?? [];
    const block = blocks[cycleState.position];
    if (!block) return;
    const nowIso = new Date().toISOString();
    const record: SessionRecord = {
      id: uid('sess'),
      disciplineId: block.disciplineId,
      disciplineName: block.disciplineName,
      disciplineTheme: block.theme,
      contentId: null,
      contentTitle: null,
      cycleNumber: cycleState.cycleNumber,
      blockIndex: block.index,
      startedAt: nowIso,
      endedAt: nowIso,
      plannedMinutes: block.plannedMinutes,
      studiedMinutes: 0,
      status: 'skipped',
      notes: 'Bloco pulado',
      createdAt: nowIso,
      updatedAt: nowIso,
      syncStatus: 'pending',
    };
    const nextCycleState = advanceCycleState(cycleState);
    await repoRef.current?.finishStudySession({
      record,
      nextCycleState,
      linkedContent: null,
    });
    syncFromRepo();
    notify(`Bloco de ${block.disciplineName} pulado.`, 'info');
  }, [advanceCycleState, cycleState, notify, syncFromRepo]);

  const registerError = useCallback(
    async (input: {
      disciplineId: string;
      contentId: string;
      description: string;
      correction: string;
      prevention: string;
      priority: PriorityLevel;
      origin: ErrorOrigin;
      registrationDate: string;
      referenceQuestion?: ErrorRecord['referenceQuestion'];
    }): Promise<Result<ErrorRecord>> => {
      const check = validateErrorInput(input);
      if (!check.ok) return check;
      const res = await repoRef.current!.addErrorRecord(input);
      if (res.ok) {
        syncFromRepo();
        notify('Erro registrado no caderno.', 'success');
      }
      return res;
    },
    [notify, syncFromRepo],
  );

  const updateError = useCallback(
    async (record: ErrorRecord) => {
      await repoRef.current?.updateErrorRecord(record);
      syncFromRepo();
      notify('Registro de erro atualizado.', 'success');
    },
    [notify, syncFromRepo],
  );

  const submitErrorReview = useCallback(
    async (
      error: ErrorRecord,
      newPriority: PriorityLevel,
      action: ErrorReviewEntry['action'] = 'revisao_2_ciclo',
      notes?: string,
    ) => {
      await repoRef.current?.submitErrorReview({
        error,
        newPriority,
        action,
        notes,
      });
      syncFromRepo();
      notify('Revisão registrada.', 'success');
    },
    [notify, syncFromRepo],
  );

  const deleteError = useCallback(
    async (error: ErrorRecord) => {
      await repoRef.current?.deleteErrorRecord(error);
      syncFromRepo();
      notify('Erro removido do caderno.', 'info');
    },
    [notify, syncFromRepo],
  );

  const updateUserName = useCallback(
    async (name: string) => {
      await repoRef.current?.updateUserName(name);
      syncFromRepo();
      notify('Perfil atualizado.', 'success');
    },
    [notify, syncFromRepo],
  );

  const exportJsonBackup = useCallback(async () => {
    const repo = repoRef.current;
    const backend = backendRef.current;
    if (!repo || !backend) return;
    const payload = repo.createBackupPayload();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const saved = await backend.exportText(
      `totalcontrole-backup-${dateStamp}.json`,
      JSON.stringify(payload, null, 2),
    );
    if (saved) notify('Backup JSON exportado com sucesso.', 'success');
  }, [notify]);

  const evaluatedCards = useMemo(
    () =>
      evaluateAllCards(
        {
          exams,
          disciplines: allDisciplines,
          sessions: allSessions,
          errors: allErrors,
          cycleState,
          operationLogs: allOperationLogs,
        },
        unlockedCardsMap,
      ),
    [
      exams,
      allDisciplines,
      allSessions,
      allErrors,
      cycleState,
      allOperationLogs,
      unlockedCardsMap,
    ],
  );

  useEffect(() => {
    if (!ready) return;
    const newlyUnlocked = evaluatedCards.filter(
      (item) => item.evaluation.unlocked && !unlockedCardsMap[item.card.id],
    );
    if (newlyUnlocked.length > 0) {
      const now = new Date().toISOString();
      const nextMap = { ...unlockedCardsMap };
      for (const item of newlyUnlocked) {
        nextMap[item.card.id] = now;
      }
      setUnlockedCardsMap(nextMap);
      void repoRef.current?.saveUnlockedCardsMap(nextMap);
      if (cardsInitializedRef.current) {
        for (const item of newlyUnlocked) {
          notify(`Nova carta desbloqueada: ${item.card.name}!`, 'success');
        }
      }
    }
    cardsInitializedRef.current = true;
  }, [ready, evaluatedCards, unlockedCardsMap, notify]);

  const exportSqliteBackup = useCallback(async () => {
    const repo = repoRef.current;
    const backend = backendRef.current;
    if (!repo || !backend) return;
    const bytes = repo.exportSqliteBytes();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const saved = await backend.exportBinary(
      `totalcontrole-db-${dateStamp}.sqlite`,
      bytes,
    );
    if (saved) notify('Banco SQLite exportado com sucesso.', 'success');
  }, [notify]);

  const restoreBackupJson = useCallback(
    async (rawJson: string, mode: 'replace' | 'merge') => {
      const res = await repoRef.current!.restoreFromBackup(rawJson, mode);
      if (res.ok) {
        syncFromRepo();
        notify('Backup restaurado com sucesso.', 'success');
      }
      return res;
    },
    [notify, syncFromRepo],
  );

  const revealDataFolder = useCallback(async () => {
    await backendRef.current?.revealFolder();
  }, []);

  const resetAllData = useCallback(async () => {
    await repoRef.current?.resetAll();
    syncFromRepo();
    notify('Dados restaurados para o estado inicial.', 'info');
  }, [notify, syncFromRepo]);

  const value: AppContextValue = {
    ready,
    loadError,
    activeTab,
    setActiveTab,
    meta,
    exams,
    activeExam,
    allDisciplines,
    disciplines,
    activeDiscipline,
    cycleSettings,
    cycleState,
    activeSession,
    elapsedSessionMs,
    allSessions,
    sessions,
    allErrors,
    errors,
    operationLogs,
    syncSummary,
    dbLocationLabel,
    isDesktop: backendRef.current?.isDesktop ?? false,
    toasts,
    dismissToast,
    notify,
    selectedContentForDrawer,
    setSelectedContentForDrawer,
    errorPrefill,
    clearErrorPrefill,
    errorsAllDisciplines,
    setErrorsAllDisciplines,
    openContentInTrail,
    openRegisterErrorForContent,
    startTrailSessionForContent,
    startCycleSessionForContent,
    selectActiveExam,
    addExam,
    updateExam,
    deleteExam,
    selectActiveDiscipline,
    addDisciplineFromTemplate,
    addDisciplinesFromTemplates,
    addCustomDiscipline,
    updateDiscipline,
    deleteDiscipline,
    updateContentNode,
    addContentToModule,
    deleteContentNode,
    updateCycleSettings,
    jumpToCycleBlock,
    advanceCycleBlock,
    restartCycle,
    startBlockSession,
    pauseActiveSession,
    resumeActiveSession,
    setActiveSessionNotes,
    discardActiveSession,
    finishActiveSession,
    skipCurrentBlock,
    registerError,
    updateError,
    submitErrorReview,
    deleteError,
    evaluatedCards,
    updateUserName,
    exportJsonBackup,
    exportSqliteBackup,
    restoreBackupJson,
    revealDataFolder,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}

