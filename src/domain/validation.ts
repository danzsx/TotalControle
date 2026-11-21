import { LIMITS } from './constants';
import { isValidDDMMYYYY } from './text';
import type { CycleSettings, ErrorOrigin, Result } from './types';

export function validateExamInput(input: { name: string }): Result<void> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Informe o nome do concurso.' };
  if (name.length > 80) {
    return { ok: false, error: 'O nome do concurso deve ter no máximo 80 caracteres.' };
  }
  return { ok: true, value: undefined };
}

export function validateDisciplineInput(input: {
  name: string;
  weight: number;
  sessionMinutesOverride?: number | null;
}): Result<void> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Informe o nome da disciplina.' };
  if (name.length > 80) {
    return { ok: false, error: 'O nome da disciplina deve ter no máximo 80 caracteres.' };
  }
  if (
    !Number.isInteger(input.weight) ||
    input.weight < LIMITS.MIN_WEIGHT ||
    input.weight > LIMITS.MAX_WEIGHT
  ) {
    return { ok: false, error: 'O peso deve estar entre 1 e 5.' };
  }
  if (
    input.sessionMinutesOverride !== undefined &&
    input.sessionMinutesOverride !== null
  ) {
    if (
      input.sessionMinutesOverride < LIMITS.MIN_SESSION_MINUTES ||
      input.sessionMinutesOverride > LIMITS.MAX_SESSION_MINUTES
    ) {
      return {
        ok: false,
        error: `A sessão personalizada deve ficar entre ${LIMITS.MIN_SESSION_MINUTES} e ${LIMITS.MAX_SESSION_MINUTES} minutos.`,
      };
    }
  }
  return { ok: true, value: undefined };
}

export function validateCycleSettings(settings: CycleSettings): Result<void> {
  if (
    settings.cycleMinutes < LIMITS.MIN_CYCLE_MINUTES ||
    settings.cycleMinutes > LIMITS.MAX_CYCLE_MINUTES
  ) {
    return {
      ok: false,
      error: `O tempo total do ciclo deve ficar entre ${LIMITS.MIN_CYCLE_MINUTES} e ${LIMITS.MAX_CYCLE_MINUTES} minutos.`,
    };
  }
  if (
    settings.sessionMinutes < LIMITS.MIN_SESSION_MINUTES ||
    settings.sessionMinutes > LIMITS.MAX_SESSION_MINUTES
  ) {
    return {
      ok: false,
      error: `A duração padrão da sessão deve ficar entre ${LIMITS.MIN_SESSION_MINUTES} e ${LIMITS.MAX_SESSION_MINUTES} minutos.`,
    };
  }
  if (
    settings.minBlockMinutes < LIMITS.MIN_BLOCK_MINUTES ||
    settings.minBlockMinutes > LIMITS.MAX_BLOCK_MINUTES
  ) {
    return {
      ok: false,
      error: `O bloco mínimo deve ficar entre ${LIMITS.MIN_BLOCK_MINUTES} e ${LIMITS.MAX_BLOCK_MINUTES} minutos.`,
    };
  }
  if (settings.minBlockMinutes > settings.sessionMinutes) {
    return {
      ok: false,
      error: 'O bloco mínimo não pode ser maior que a duração padrão da sessão.',
    };
  }
  return { ok: true, value: undefined };
}

export function validateErrorInput(input: {
  disciplineId: string;
  contentId: string;
  origin: ErrorOrigin;
  description: string;
  correction: string;
  registrationDate: string;
}): Result<void> {
  if (!input.disciplineId) {
    return { ok: false, error: 'Selecione uma disciplina.' };
  }
  if (!input.contentId) {
    return { ok: false, error: 'Selecione um conteúdo vinculado.' };
  }
  if (input.origin === 'nao_classificado') {
    return { ok: false, error: 'Classifique a origem do erro.' };
  }
  if (!input.description.trim()) {
    return { ok: false, error: 'Descreva o que você errou.' };
  }
  if (!input.correction.trim()) {
    return { ok: false, error: 'Informe a correção / fundamento correto.' };
  }
  if (!isValidDDMMYYYY(input.registrationDate)) {
    return { ok: false, error: 'Data inválida. Use o formato DD/MM/AAAA.' };
  }
  return { ok: true, value: undefined };
}

