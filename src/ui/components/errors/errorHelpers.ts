import type { ErrorOrigin } from '../../../domain/types';

export interface ParsedErrorDescription {
  statement: string;
  bottleneck: string | null;
  timeTag: string | null;
  hasExtraDetails: boolean;
}

/**
 * Separa a descrição livre ou estruturada em blocos curtos:
 * - enunciado/contexto
 * - gargalo/análise (quando houver quebra ou marcador)
 * - tempo gasto (tag opcional `[Tempo: ...]`)
 */
export function parseErrorDescription(raw: string): ParsedErrorDescription {
  let text = raw.trim();
  let timeTag: string | null = null;

  const timeMatch = text.match(/\[Tempo:\s*([^\]]+)\]/i);
  if (timeMatch) {
    timeTag = timeMatch[1].trim();
    text = text.replace(timeMatch[0], '').trim();
  }

  const bottleneckMarker = text.match(/\n?Gargalo:\s*([\s\S]+)$/i);
  if (bottleneckMarker) {
    const statement = text.slice(0, bottleneckMarker.index).trim();
    const bottleneck = bottleneckMarker[1].trim();
    return {
      statement: statement || bottleneck,
      bottleneck: statement ? bottleneck : null,
      timeTag,
      hasExtraDetails:
        Boolean(statement && bottleneck) || statement.length > 150,
    };
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    const statement = paragraphs[0];
    const bottleneck = paragraphs.slice(1).join('\n\n');
    return {
      statement,
      bottleneck,
      timeTag,
      hasExtraDetails: true,
    };
  }

  return {
    statement: text,
    bottleneck: null,
    timeTag,
    hasExtraDetails: text.length > 150 || text.includes('\n'),
  };
}

/**
 * Formata descrição estruturada mantendo compatibilidade com ErrorRecord.description.
 */
export function composeErrorDescription(params: {
  statement: string;
  bottleneck?: string;
  timeSpent?: string;
}): string {
  const parts: string[] = [params.statement.trim()];
  if (params.bottleneck?.trim()) {
    parts.push(`Gargalo: ${params.bottleneck.trim()}`);
  }
  if (params.timeSpent?.trim()) {
    parts.push(`[Tempo: ${params.timeSpent.trim()}]`);
  }
  return parts.join('\n\n');
}

/**
 * Calcula tempo decorrido desde o registro (em linguagem direta).
 */
export function formatRelativeErrorAge(
  registrationDate: string,
  createdAtIso: string,
): string {
  let refDate: Date | null = null;
  const ddmmyyyy = registrationDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3]);
    const candidate = new Date(year, month, day, 12, 0, 0);
    if (!Number.isNaN(candidate.getTime())) {
      refDate = candidate;
    }
  }
  if (!refDate && createdAtIso) {
    const parsed = new Date(createdAtIso);
    if (!Number.isNaN(parsed.getTime())) {
      refDate = parsed;
    }
  }
  if (!refDate) return registrationDate;

  const now = new Date();
  const todayNoon = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
  );
  const refNoon = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
    12,
    0,
    0,
  );
  const diffDays = Math.round(
    (todayNoon.getTime() - refNoon.getTime()) / 86_400_000,
  );

  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  const months = Math.floor(diffDays / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

export const ORIGIN_REVIEW_TIPS: Record<ErrorOrigin, string> = {
  desconhecimento:
    'Foque na regra-base e na exceção mais cobrada pela banca.',
  confusao:
    'Diferencie os dois institutos antes de abrir o gabarito.',
  esquecimento:
    'Resgate a palavra-chave, prazo ou gatilho de memória.',
  interpretacao:
    'Releia o comando procurando "exceto", "incorreta" ou restrições.',
  nao_classificado:
    'Identifique se o erro foi de conteúdo, leitura ou memória.',
};

export const ORIGIN_ACTION_PLANS: Record<ErrorOrigin, string> = {
  desconhecimento:
    'Reforce a teoria-base na Trilha e resolva baterias comentadas do tópico antes de avançar.',
  confusao:
    'Monte um quadro comparativo rápido (diferença-chave em 2 colunas) e revise antes de simulados.',
  esquecimento:
    'Aumente a frequência de Revisão Ativa (2º Ciclo) para fixar prazos, números e exceções.',
  interpretacao:
    'Treine grifar o comando da questão ("incorreta", "exceto", "sempre") antes de ler as alternativas.',
  nao_classificado:
    'Classifique seus registros antigos para enxergar onde você perde mais pontos na prova.',
};
