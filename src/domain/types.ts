export type NavTab =
  | 'dashboard'
  | 'trails'
  | 'cycle'
  | 'errors'
  | 'cards'
  | 'stats'
  | 'history'
  | 'settings';

export type DisciplineTheme =
  | 'sky'
  | 'deep'
  | 'lavender'
  | 'sage'
  | 'gold'
  | 'rose';

export type ContentStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'concluido'
  | 'revisao';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type SyncStatus = 'pending' | 'synced';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ContentEvolutionEntry {
  id: string;
  date: string;
  action: string;
  detail?: string;
}

/**
 * Nó de conteúdo unificado: serve simultaneamente como unidade da Trilha de
 * Aprendizagem (Be a Master), alvo opcional de Sessão de Estudo (Ciclo) e
 * tópico vinculado no Caderno de Erros (ERRATA).
 */
export interface ContentNode {
  id: string;
  disciplineId: string;
  levelId: string;
  moduleId: string;
  title: string;
  description: string;
  editalRef?: string;
  sortOrder: number;
  // Conclusão de conteúdo (separada de desempenho e domínio)
  status: ContentStatus;
  checklist: ChecklistItem[];
  completedAt: string | null;
  // Desempenho em questões
  exercisesDone: number;
  exercisesCorrect: number;
  // Domínio real & revisão
  difficulty: 1 | 2 | 3 | 4;
  markedForReview: boolean;
  reviewCount: number;
  lastStudiedAt: string | null;
  notes: string;
  difficulties: string;
  history: ContentEvolutionEntry[];
  // Metadados de sincronização futura
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

export interface TrailModule {
  id: string;
  levelId: string;
  disciplineId: string;
  title: string;
  subtitle?: string;
  sortOrder: number;
  contents: ContentNode[];
}

export interface TrailLevel {
  id: string;
  disciplineId: string;
  title: string;
  subtitle: string;
  landscapeName: string;
  sortOrder: number;
  modules: TrailModule[];
}

/**
 * Concurso / Objetivo de Estudo: agrupa disciplinas, ciclo de estudos,
 * sessões e estatísticas pertinentes a um edital ou prova específica.
 */
export interface Exam {
  id: string;
  name: string;
  description: string;
  theme: DisciplineTheme;
  targetDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

/**
 * Disciplina unificada: único identificador compartilhado entre Trilhas,
 * Ciclo de Estudos, Caderno de Erros e Histórico.
 */
export interface Discipline {
  id: string;
  examId: string;
  name: string;
  description: string;
  theme: DisciplineTheme;
  icon: string;
  templateId?: string;
  sortOrder: number;
  // Parâmetros do Ciclo de Estudos
  inCycle: boolean;
  weight: 1 | 2 | 3 | 4 | 5;
  difficulty: Difficulty;
  sessionMinutesOverride: number | null;
  adjustment: number; // 0.5 .. 1.5 (padrão 1.0)
  // Hierarquia de trilha
  levels: TrailLevel[];
  // Metadados de sincronização futura
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

// ============================================================================
// Ciclo de Estudos (núcleo preservado do ciclo-estudo)
// ============================================================================

export interface CycleSettings {
  cycleMinutes: number;
  sessionMinutes: number;
  minBlockMinutes: number;
}

export interface SubjectAllocation {
  disciplineId: string;
  disciplineName: string;
  theme: DisciplineTheme;
  weight: 1 | 2 | 3 | 4 | 5;
  difficulty: Difficulty;
  score: number;
  rawShare: number;
  finalShare: number;
  minutes: number;
  blocks: number;
  clamped: 'min' | 'max' | null;
}

export interface CycleBlock {
  index: number;
  disciplineId: string;
  disciplineName: string;
  theme: DisciplineTheme;
  plannedMinutes: number;
  occurrence: number;
  totalForDiscipline: number;
}

export interface CyclePlan {
  signature: string;
  generatedAt: string;
  totalMinutes: number;
  allocations: SubjectAllocation[];
  blocks: CycleBlock[];
  warnings: string[];
}

export interface CycleState {
  plan: CyclePlan | null;
  position: number;
  cycleNumber: number;
  completedCycles: number;
}

export type SessionStatus = 'completed' | 'partial' | 'skipped';

export type StudySessionOrigin = 'ciclo' | 'trilha';

export interface ActiveSession {
  id: string;
  origin?: StudySessionOrigin;
  disciplineId: string;
  disciplineName: string;
  contentId: string | null;
  contentTitle: string | null;
  blockIndex: number;
  cycleNumber: number;
  plannedMinutes: number;
  status: 'running' | 'paused';
  startedAt: string;
  accumulatedMs: number;
  lastResumedAt: number | null;
  lastHeartbeatAt: number | null;
  notes: string;
}

export interface SessionRecord {
  id: string;
  origin?: StudySessionOrigin;
  disciplineId: string;
  disciplineName: string;
  disciplineTheme: DisciplineTheme;
  contentId: string | null;
  contentTitle: string | null;
  cycleNumber: number;
  blockIndex: number;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  studiedMinutes: number;
  status: SessionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// ============================================================================
// Caderno de Erros & Revisão Ativa (núcleo preservado do ERRATA)
// ============================================================================

export type PriorityLevel = 'alta' | 'media' | 'superado';

export type ErrorOrigin =
  | 'desconhecimento'
  | 'confusao'
  | 'esquecimento'
  | 'interpretacao'
  | 'nao_classificado';

export interface ReferenceQuestion {
  questionNumber?: string;
  examBoard?: string;
  link?: string;
}

export interface ErrorReviewEntry {
  id: string;
  errorId: string;
  timestamp: string;
  previousPriority: PriorityLevel;
  newPriority: PriorityLevel;
  action: 'revisao_2_ciclo' | 'reabertura' | 'alteracao_rapida';
  notes?: string;
}

export interface ErrorRecord {
  id: string;
  disciplineId: string;
  contentId: string;
  description: string;
  correction: string;
  prevention: string;
  priority: PriorityLevel;
  origin: ErrorOrigin;
  referenceQuestion?: ReferenceQuestion;
  registrationDate: string; // DD/MM/AAAA
  overcomeAt: string | null;
  reviewHistory: ErrorReviewEntry[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

// ============================================================================
// Histórico Unificado & Métricas Separadas
// ============================================================================

export type OperationEntityType =
  | 'exam'
  | 'discipline'
  | 'content'
  | 'session'
  | 'error'
  | 'cycle'
  | 'backup';

export interface OperationLog {
  id: string;
  entityType: OperationEntityType;
  entityId: string;
  disciplineId: string | null;
  contentId: string | null;
  action: string;
  summary: string;
  metadataJson: string | null;
  timestamp: string;
  syncStatus: SyncStatus;
}

/**
 * Métricas separadas por dimensão:
 * 1. completion: conclusão estruturada do conteúdo (status + checklist)
 * 2. performance: desempenho objetivo em questões (acertos / feitas)
 * 3. mastery: domínio real do conhecimento (conclusão + questões + estudo ativo + resolução de erros + revisões)
 */
export interface SeparatedMetrics {
  completion: number; // 0-100
  performance: number | null; // 0-100 ou null se sem questões
  mastery: number; // 0-100
  completedCount: number;
  inProgressCount: number;
  reviewCount: number;
  totalContents: number;
  exercisesDone: number;
  exercisesCorrect: number;
  totalStudiedMinutes: number;
  openErrorsCount: number;
  overcomeErrorsCount: number;
}

export interface TrailTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  theme: DisciplineTheme;
  icon: string;
  levels: Array<{
    title: string;
    subtitle: string;
    landscapeName: string;
    modules: Array<{
      title: string;
      subtitle?: string;
      contents: Array<{
        title: string;
        description: string;
        editalRef?: string;
        difficulty: 1 | 2 | 3 | 4;
      }>;
    }>;
  }>;
}

export interface BackupPayload {
  formatVersion: string;
  appName: 'TotalControle';
  exportedAt: string;
  userName: string;
  exams?: Exam[];
  activeExamId?: string | null;
  examCycles?: Record<string, { cycleSettings: CycleSettings; cycleState: CycleState }>;
  disciplines: Discipline[];
  cycleSettings: CycleSettings;
  cycleState: CycleState;
  sessions: SessionRecord[];
  errors: ErrorRecord[];
  operationLogs: OperationLog[];
  unlockedCards?: Record<string, string>;
}

export interface AppMeta {
  schemaVersion: number;
  deviceId: string;
  userName: string;
  activeExamId: string | null;
  activeDisciplineId: string | null;
  lastSyncAt: string | null;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

