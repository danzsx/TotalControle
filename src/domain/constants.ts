import type {
  CycleSettings,
  Difficulty,
  DisciplineTheme,
  ErrorOrigin,
  PriorityLevel,
} from './types';

export const SCHEMA_VERSION = 2;
export const BACKUP_FORMAT_VERSION = '2.0.0';
export const DEFAULT_EXAM_ID = 'exam_default';

export const DIFFICULTY_FACTORS: Record<Difficulty, number> = {
  easy: 0.85,
  medium: 1.0,
  hard: 1.25,
};

export const LIMITS = {
  MAX_DISCIPLINES: 40,
  MIN_CYCLE_MINUTES: 30,
  MAX_CYCLE_MINUTES: 6000,
  MIN_SESSION_MINUTES: 15,
  MAX_SESSION_MINUTES: 180,
  MIN_BLOCK_MINUTES: 10,
  MAX_BLOCK_MINUTES: 60,
  MIN_WEIGHT: 1,
  MAX_WEIGHT: 5,
  MIN_ADJUSTMENT: 0.5,
  MAX_ADJUSTMENT: 1.5,
} as const;

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  cycleMinutes: 600, // 10h
  sessionMinutes: 50,
  minBlockMinutes: 25,
};

export interface ThemeTokens {
  id: DisciplineTheme;
  label: string;
  accentHex: string;
  softBgHex: string;
  pillBg: string;
  pillText: string;
  border: string;
  gradient: string;
  dot: string;
}

export const DISCIPLINE_THEMES: Record<DisciplineTheme, ThemeTokens> = {
  sky: {
    id: 'sky',
    label: 'Céu da Manhã',
    accentHex: '#3B82F6',
    softBgHex: '#EFF6FF',
    pillBg: 'bg-[#EFF6FF]',
    pillText: 'text-[#1D4ED8]',
    border: 'border-[#BFDBFE]',
    gradient: 'from-[#EFF6FF] to-[#DBEAFE]',
    dot: 'bg-[#3B82F6]',
  },
  deep: {
    id: 'deep',
    label: 'Azul Profundo',
    accentHex: '#2B4C7E',
    softBgHex: '#EEF2F7',
    pillBg: 'bg-[#EEF2F7]',
    pillText: 'text-[#1E3A5F]',
    border: 'border-[#CBD5E1]',
    gradient: 'from-[#EEF2F7] to-[#E2E8F0]',
    dot: 'bg-[#2B4C7E]',
  },
  lavender: {
    id: 'lavender',
    label: 'Lavanda Clara',
    accentHex: '#7C3AED',
    softBgHex: '#F3EEFF',
    pillBg: 'bg-[#F3EEFF]',
    pillText: 'text-[#5B21B6]',
    border: 'border-[#DDD6FE]',
    gradient: 'from-[#F5F3FF] to-[#EDE9FE]',
    dot: 'bg-[#7C3AED]',
  },
  sage: {
    id: 'sage',
    label: 'Sálvia Sereno',
    accentHex: '#15803D',
    softBgHex: '#ECFDF3',
    pillBg: 'bg-[#ECFDF3]',
    pillText: 'text-[#166534]',
    border: 'border-[#BBF7D0]',
    gradient: 'from-[#ECFDF3] to-[#DCFCE7]',
    dot: 'bg-[#16A34A]',
  },
  gold: {
    id: 'gold',
    label: 'Âmbar Dourado',
    accentHex: '#B45309',
    softBgHex: '#FEF9EC',
    pillBg: 'bg-[#FEF9EC]',
    pillText: 'text-[#92400E]',
    border: 'border-[#FDE68A]',
    gradient: 'from-[#FEF9EC] to-[#FEF3C7]',
    dot: 'bg-[#D97706]',
  },
  rose: {
    id: 'rose',
    label: 'Rosa Suave',
    accentHex: '#BE185D',
    softBgHex: '#FDF2F8',
    pillBg: 'bg-[#FDF2F8]',
    pillText: 'text-[#9D174D]',
    border: 'border-[#FBCFE8]',
    gradient: 'from-[#FDF2F8] to-[#FCE7F3]',
    dot: 'bg-[#DB2777]',
  },
};

export interface PriorityMeta {
  id: PriorityLevel;
  label: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  hex: string;
}

export const PRIORITIES: Record<PriorityLevel, PriorityMeta> = {
  alta: {
    id: 'alta',
    label: 'Prioridade Alta',
    description:
      'Lacunas persistentes, conceitos ainda não consolidados ou incidência recorrente.',
    badgeBg: 'bg-[#FEE2E2]',
    badgeText: 'text-[#B91C1C]',
    dotColor: 'bg-[#DC2626]',
    hex: '#DC2626',
  },
  media: {
    id: 'media',
    label: 'Prioridade Média',
    description:
      'Conceitos compreendidos na teoria, mas que exigem maturação e revisão ativa.',
    badgeBg: 'bg-[#FEF3C7]',
    badgeText: 'text-[#B45309]',
    dotColor: 'bg-[#D97706]',
    hex: '#D97706',
  },
  superado: {
    id: 'superado',
    label: 'Superado',
    description:
      'Domínio verificado na prática por meio de recuperação ativa consistente.',
    badgeBg: 'bg-[#DCFCE7]',
    badgeText: 'text-[#15803D]',
    dotColor: 'bg-[#16A34A]',
    hex: '#16A34A',
  },
};

export const PRIORITY_LIST: PriorityMeta[] = [
  PRIORITIES.alta,
  PRIORITIES.media,
  PRIORITIES.superado,
];

export interface OriginMeta {
  id: ErrorOrigin;
  label: string;
  description: string;
  example: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
}

export const ORIGINS: Record<ErrorOrigin, OriginMeta> = {
  desconhecimento: {
    id: 'desconhecimento',
    label: 'Desconhecimento',
    description: 'Ausência de contato prévio com o conceito ou dispositivo exigido.',
    example: 'Ex.: desconhecia a regra ou exceção cobrada.',
    badgeBg: 'bg-[#EEF2FF]',
    badgeText: 'text-[#3730A3]',
    hex: '#4338CA',
  },
  confusao: {
    id: 'confusao',
    label: 'Confusão entre Conceitos',
    description: 'Conhecimento parcial com troca de institutos ou fórmulas próximas.',
    example: 'Ex.: anulação vs. revogação administrativa.',
    badgeBg: 'bg-[#F3E8FF]',
    badgeText: 'text-[#6B21A8]',
    hex: '#7E22CE',
  },
  esquecimento: {
    id: 'esquecimento',
    label: 'Esquecimento',
    description: 'Conteúdo já estudado, porém sem retenção suficiente na evocação.',
    example: 'Ex.: falha ao recordar prazo legal ou fórmula.',
    badgeBg: 'bg-[#FEF3C7]',
    badgeText: 'text-[#92400E]',
    hex: '#D97706',
  },
  interpretacao: {
    id: 'interpretacao',
    label: 'Erro de Interpretação',
    description: 'Leitura apressada do enunciado, inversão de comando ou pegadinha.',
    example: 'Ex.: não percebeu "exceto" ou "incorreta" no comando.',
    badgeBg: 'bg-[#E0F2FE]',
    badgeText: 'text-[#075985]',
    hex: '#0284C7',
  },
  nao_classificado: {
    id: 'nao_classificado',
    label: 'Não classificado',
    description: 'Registro legado sem classificação de origem.',
    example: '',
    badgeBg: 'bg-[#F1F5F9]',
    badgeText: 'text-[#475569]',
    hex: '#64748B',
  },
};

export const SELECTABLE_ORIGINS: OriginMeta[] = [
  ORIGINS.desconhecimento,
  ORIGINS.confusao,
  ORIGINS.esquecimento,
  ORIGINS.interpretacao,
];

