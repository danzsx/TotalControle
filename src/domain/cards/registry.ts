import { BIBLICAL_CARDS, BIBLICAL_THEME } from './themes/biblical';
import type {
  AchievementContext,
  AchievementEvaluation,
  CardThemeDefinition,
  CardThemeId,
  CollectibleCard,
  EvaluatedCard,
} from './types';

/**
 * Registro central de temas de cartas colecionáveis.
 * Para adicionar um novo tema no futuro, crie um módulo em `./themes/<tema>.ts`
 * e adicione sua definição e lista de cartas abaixo.
 */
export const CARD_THEMES: CardThemeDefinition[] = [BIBLICAL_THEME];

export const ALL_CARDS: CollectibleCard[] = [...BIBLICAL_CARDS];

export function getCardTheme(themeId: CardThemeId): CardThemeDefinition | undefined {
  return CARD_THEMES.find((t) => t.id === themeId);
}

export function getCardsByTheme(themeId: CardThemeId): CollectibleCard[] {
  return ALL_CARDS.filter((c) => c.themeId === themeId);
}

export function evaluateCardAchievement(
  card: CollectibleCard,
  ctx: AchievementContext,
): AchievementEvaluation {
  const { current, target } = card.achievement.evaluate(ctx);
  const safeTarget = Math.max(1, target);
  const clampedCurrent = Math.max(0, Math.min(current, safeTarget));
  const progressPct = Math.round((clampedCurrent / safeTarget) * 100);
  return {
    current: Math.max(0, current),
    target: safeTarget,
    progressPct,
    unlocked: current >= safeTarget,
  };
}

export function evaluateAllCards(
  ctx: AchievementContext,
  unlockedAtMap: Record<string, string>,
): EvaluatedCard[] {
  return ALL_CARDS.map((card) => {
    const rawEval = evaluateCardAchievement(card, ctx);
    const previouslyUnlockedAt = unlockedAtMap[card.id] ?? null;
    const isUnlocked = rawEval.unlocked || Boolean(previouslyUnlockedAt);
    const evaluation: AchievementEvaluation = isUnlocked && !rawEval.unlocked
      ? {
          ...rawEval,
          current: Math.max(rawEval.current, rawEval.target),
          progressPct: 100,
          unlocked: true,
        }
      : rawEval;
    return {
      card,
      evaluation,
      unlockedAt: isUnlocked ? previouslyUnlockedAt : null,
    };
  });
}
