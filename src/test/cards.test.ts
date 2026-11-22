import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  CARD_THEMES,
  evaluateAllCards,
  evaluateCardAchievement,
  getCardTheme,
  getCardsByTheme,
} from '../domain/cards/registry';
import type { AchievementContext } from '../domain/cards/types';
import type { CycleState, Discipline, ErrorRecord, SessionRecord } from '../domain/types';

function makeEmptyContext(): AchievementContext {
  const cycleState: CycleState = {
    plan: null,
    position: 0,
    cycleNumber: 1,
    completedCycles: 0,
  };
  return {
    exams: [],
    disciplines: [],
    sessions: [],
    errors: [],
    cycleState,
    operationLogs: [],
  };
}

describe('Catálogo Modular de Cartas & Conquistas', () => {
  it('registra o tema bíblico com 16 cartas únicas e categorias válidas', () => {
    const biblical = getCardTheme('biblico');
    expect(biblical).toBeDefined();
    expect(biblical?.categories.map((c) => c.id)).toEqual([
      'personagens',
      'historias',
      'milagres',
    ]);

    const cards = getCardsByTheme('biblico');
    expect(cards.length).toBe(16);
    expect(CARD_THEMES.length).toBeGreaterThanOrEqual(1);

    const ids = new Set(ALL_CARDS.map((c) => c.id));
    expect(ids.size).toBe(ALL_CARDS.length);

    const validCategories = new Set(biblical!.categories.map((c) => c.id));
    for (const card of cards) {
      expect(validCategories.has(card.categoryId)).toBe(true);
      expect(card.imageUrl).toMatch(/^\.\/cards\/biblical\/.+\.jpg$/);
    }
  });

  it('desbloqueia Caminhando Sobre as Águas com 180 minutos mesmo sem ciclo concluído e preserva conquistas já desbloqueadas', () => {
    const emptyCtx = makeEmptyContext();
    const walkingWater = ALL_CARDS.find((c) => c.id === 'bib-walking-water')!;
    const ctx180: AchievementContext = {
      ...emptyCtx,
      sessions: [
        {
          id: 's-180',
          origin: 'trilha',
          disciplineId: 'd-1',
          disciplineName: 'TI',
          disciplineTheme: 'sky',
          contentId: null,
          contentTitle: null,
          cycleNumber: 0,
          blockIndex: -1,
          startedAt: '2026-11-01T10:00:00Z',
          endedAt: '2026-11-01T13:00:00Z',
          plannedMinutes: 180,
          studiedMinutes: 180,
          status: 'completed',
          notes: '',
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T13:00:00Z',
          syncStatus: 'pending',
        },
      ],
    };

    const eval180 = evaluateCardAchievement(walkingWater, ctx180);
    expect(eval180.current).toBe(180);
    expect(eval180.unlocked).toBe(true);

    // Uma vez registrada no mapa de desbloqueio, a carta permanece desbloqueada
    const evaluatedWithMap = evaluateAllCards(emptyCtx, {
      'bib-walking-water': '2026-11-01T13:00:00Z',
    });
    const preserved = evaluatedWithMap.find((i) => i.card.id === 'bib-walking-water')!;
    expect(preserved.evaluation.unlocked).toBe(true);
    expect(preserved.unlockedAt).toBe('2026-11-01T13:00:00Z');
  });

  it('mantém cartas avançadas bloqueadas com progresso inicial e desbloqueia quando conquistas são atingidas', () => {
    const emptyCtx = makeEmptyContext();
    const initialEval = evaluateAllCards(emptyCtx, {});

    const moses = initialEval.find((i) => i.card.id === 'bib-moses');
    const storm = initialEval.find((i) => i.card.id === 'bib-storm-galilee');
    expect(moses?.evaluation.unlocked).toBe(true);
    expect(storm?.evaluation.unlocked).toBe(false);
    expect(storm?.evaluation.current).toBe(0);
    expect(storm?.evaluation.target).toBe(3);

    const sessions: SessionRecord[] = [1, 2, 3].map((n) => ({
      id: `s-${n}`,
      origin: 'ciclo',
      disciplineId: 'd-1',
      disciplineName: 'Direito',
      disciplineTheme: 'sky',
      contentId: null,
      contentTitle: null,
      cycleNumber: 1,
      blockIndex: n - 1,
      startedAt: `2026-11-0${n}T10:00:00Z`,
      endedAt: `2026-11-0${n}T11:00:00Z`,
      plannedMinutes: 60,
      studiedMinutes: 60,
      status: 'completed',
      notes: '',
      createdAt: `2026-11-0${n}T10:00:00Z`,
      updatedAt: `2026-11-0${n}T11:00:00Z`,
      syncStatus: 'pending',
    }));

    const richCtx: AchievementContext = {
      ...emptyCtx,
      sessions,
      disciplines: [
        { id: 'd-1', levels: [] } as unknown as Discipline,
        { id: 'd-2', levels: [] } as unknown as Discipline,
      ],
      errors: [{ priority: 'superado', reviewHistory: [] } as unknown as ErrorRecord],
    };

    const stormCard = ALL_CARDS.find((c) => c.id === 'bib-storm-galilee')!;
    const danielCard = ALL_CARDS.find((c) => c.id === 'bib-daniel-lions')!;
    const noahCard = ALL_CARDS.find((c) => c.id === 'bib-noah-ark')!;

    expect(evaluateCardAchievement(stormCard, richCtx).unlocked).toBe(true);
    expect(evaluateCardAchievement(danielCard, richCtx).unlocked).toBe(true);
    expect(evaluateCardAchievement(noahCard, richCtx).unlocked).toBe(true);
  });
});
