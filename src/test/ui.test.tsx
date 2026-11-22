import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createCustomDiscipline, defaultChecklist } from '../domain/prebuiltTrails';
import type { Discipline, ErrorRecord } from '../domain/types';
import { ActiveReviewPanel } from '../ui/components/errors/ActiveReviewPanel';
import { RegisterErrorModal } from '../ui/components/errors/RegisterErrorModal';

function makeDisciplineWithContent(id: string, name: string, contentId: string, contentTitle: string): Discipline {
  const disc = createCustomDiscipline({
    name,
    description: '',
    theme: 'sky',
    inCycle: true,
  });
  disc.id = id;
  disc.levels[0].disciplineId = id;
  disc.levels[0].modules[0].disciplineId = id;
  disc.levels[0].modules[0].contents = [
    {
      id: contentId,
      disciplineId: id,
      levelId: disc.levels[0].id,
      moduleId: disc.levels[0].modules[0].id,
      title: contentTitle,
      description: '',
      sortOrder: 0,
      status: 'em_andamento',
      checklist: defaultChecklist(),
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
      createdAt: '2026-11-22T10:00:00Z',
      updatedAt: '2026-11-22T10:00:00Z',
      deletedAt: null,
      syncStatus: 'pending',
    },
  ];
  return disc;
}

describe('UI — RegisterErrorModal', () => {
  it('permite trocar a disciplina selecionada mesmo quando initialDisciplineId é informado', async () => {
    const d1 = makeDisciplineWithContent('d1', 'Português', 'c1', 'Crase');
    const d2 = makeDisciplineWithContent('d2', 'Matemática', 'c2', 'Logaritmos');
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, value: {} });

    render(
      <RegisterErrorModal
        open={true}
        disciplines={[d1, d2]}
        initialDisciplineId="d1"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    const discSelect = selects[0] as HTMLSelectElement;
    expect(discSelect.value).toBe('d1');

    fireEvent.change(discSelect, { target: { value: 'd2' } });

    await waitFor(() => {
      expect(discSelect.value).toBe('d2');
    });
    const topicSelect = selects[1] as HTMLSelectElement;
    expect(topicSelect.value).toBe('c2');
  });
});

describe('UI — ActiveReviewPanel', () => {
  it('avança para o próximo card da fila ao classificar como Manter Alta sem entrar em loop infinito', async () => {
    const err1: ErrorRecord = {
      id: 'err_1',
      disciplineId: 'd1',
      contentId: 'c1',
      description: 'Primeiro erro crítico',
      correction: 'Correção 1',
      prevention: '',
      priority: 'alta',
      origin: 'confusao',
      registrationDate: '22/11/2026',
      overcomeAt: null,
      reviewHistory: [],
      createdAt: '2026-11-22T10:00:00Z',
      updatedAt: '2026-11-22T10:00:00Z',
      deletedAt: null,
      syncStatus: 'pending',
    };
    const err2: ErrorRecord = {
      ...err1,
      id: 'err_2',
      description: 'Segundo erro crítico',
      correction: 'Correção 2',
    };

    const onSubmitReview = vi.fn().mockResolvedValue(undefined);

    render(
      <ActiveReviewPanel
        scopedQueue={[err1, err2]}
        allPendingQueue={[err1, err2]}
        totalErrorsCount={2}
        overcomeCount={0}
        isScopedByDiscipline={false}
        onShowAllDisciplines={vi.fn()}
        onGoToLibrary={vi.fn()}
        onOpenRegister={vi.fn()}
        lookupMap={{
          discNames: new Map([['d1', 'Português']]),
          discThemes: new Map([['d1', 'sky']]),
          contentTitles: new Map([['c1', 'Crase']]),
        }}
        onOpenContentInTrail={vi.fn()}
        onSubmitReview={onSubmitReview}
      />,
    );

    expect(screen.getByText('Primeiro erro crítico')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ver gabarito e fundamento/i }));
    fireEvent.click(screen.getByRole('button', { name: /Errei de novo/i }));

    await waitFor(() => {
      expect(screen.getByText('Segundo erro crítico')).toBeInTheDocument();
    });
  });
});
