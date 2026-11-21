import type {
  CycleState,
  Discipline,
  ErrorRecord,
  Exam,
  OperationLog,
  SessionRecord,
} from '../types';

export type CardRarity = 'comum' | 'rara' | 'epica' | 'lendaria';

export type CardThemeId = string;
export type CardCategoryId = string;

export interface CardCategoryDefinition {
  id: CardCategoryId;
  label: string;
  description: string;
}

export interface CardThemeDefinition {
  id: CardThemeId;
  name: string;
  subtitle: string;
  description: string;
  badgeLabel: string;
  accentGradient: string;
  categories: CardCategoryDefinition[];
}

export interface AchievementContext {
  exams: Exam[];
  disciplines: Discipline[];
  sessions: SessionRecord[];
  errors: ErrorRecord[];
  cycleState: CycleState;
  operationLogs: OperationLog[];
}

export interface AchievementEvaluation {
  current: number;
  target: number;
  progressPct: number;
  unlocked: boolean;
}

export interface CardAchievementDefinition {
  id: string;
  title: string;
  description: string;
  hint: string;
  evaluate: (ctx: AchievementContext) => { current: number; target: number };
}

export interface CardArtworkInfo {
  title: string;
  artist: string;
  year: string;
  museum: string;
}

export interface CardAttribute {
  label: string;
  value: number;
}

export interface CollectibleCard {
  id: string;
  number: string;
  themeId: CardThemeId;
  categoryId: CardCategoryId;
  name: string;
  subtitle: string;
  rarity: CardRarity;
  reference: string;
  imageUrl: string;
  artwork: CardArtworkInfo;
  quote: string;
  lore: string;
  attributes: [CardAttribute, CardAttribute, CardAttribute];
  achievement: CardAchievementDefinition;
}

export interface EvaluatedCard {
  card: CollectibleCard;
  evaluation: AchievementEvaluation;
  unlockedAt: string | null;
}
