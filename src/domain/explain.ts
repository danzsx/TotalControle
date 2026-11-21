import type { Difficulty, SubjectAllocation } from './types';

const DIFF_TEXT: Record<Difficulty, string> = {
  easy: 'fácil (×0,85)',
  medium: 'média (×1,00)',
  hard: 'difícil (×1,25)',
};

export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${String(rest).padStart(2, '0')}m`;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function explainAllocation(alloc: SubjectAllocation): string {
  const base = `${alloc.disciplineName}: peso ${alloc.weight}, dificuldade ${DIFF_TEXT[alloc.difficulty]} → ${formatMinutes(alloc.minutes)} (${formatPercent(alloc.finalShare)}) em ${alloc.blocks} ${alloc.blocks === 1 ? 'bloco' : 'blocos'}.`;
  if (alloc.clamped === 'min') {
    return `${base} Aplicado piso mínimo para garantir presença no ciclo.`;
  }
  if (alloc.clamped === 'max') {
    return `${base} Aplicado teto máximo para manter equilíbrio entre disciplinas.`;
  }
  return base;
}

