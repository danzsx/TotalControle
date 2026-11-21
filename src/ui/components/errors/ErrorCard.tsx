import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  FileText,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DISCIPLINE_THEMES,
  ORIGINS,
  PRIORITIES,
  PRIORITY_LIST,
} from '../../../domain/constants';
import type {
  DisciplineTheme,
  ErrorRecord,
  PriorityLevel,
} from '../../../domain/types';
import {
  formatRelativeErrorAge,
  parseErrorDescription,
} from './errorHelpers';

interface ErrorCardProps {
  error: ErrorRecord;
  disciplineName: string;
  disciplineTheme?: DisciplineTheme;
  contentTitle: string;
  isRevealed: boolean;
  onToggleReveal: () => void;
  onOpenInTrail: () => void;
  onChangePriority: (newPriority: PriorityLevel) => Promise<void>;
  onRequestDelete: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  error,
  disciplineName,
  disciplineTheme = 'sky',
  contentTitle,
  isRevealed,
  onToggleReveal,
  onOpenInTrail,
  onChangePriority,
  onRequestDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [justSaved]);

  const prio = PRIORITIES[error.priority];
  const orig = ORIGINS[error.origin];
  const theme = DISCIPLINE_THEMES[disciplineTheme];
  const parsed = parseErrorDescription(error.description);
  const ageLabel = formatRelativeErrorAge(
    error.registrationDate,
    error.createdAt,
  );

  const handlePriorityChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = e.target.value as PriorityLevel;
    await onChangePriority(next);
    setJustSaved(true);
  };

  return (
    <article className="rounded-[24px] surface-card p-5 space-y-3.5 transition-shadow hover:shadow-[0_10px_32px_rgba(17,24,39,0.055)]">
      {/* Cabeçalho: contexto à esquerda, status/prioridade isolados à direita (sem lixeira perto!) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
            <span className="font-semibold text-[#111827]">
              {disciplineName}
            </span>
            <span className="text-[#9CA3AF]">·</span>
            <button
              type="button"
              onClick={onOpenInTrail}
              className="text-[#4B5563] font-medium hover:text-[#111827] hover:underline cursor-pointer text-left truncate max-w-[340px]"
              title="Abrir tópico na Trilha"
            >
              {contentTitle}
            </button>
          </div>

          {/* Tags rápidas de referência, origem e tempo */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${orig.badgeBg} ${orig.badgeText}`}
            >
              {orig.label}
            </span>
            {error.referenceQuestion?.examBoard && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#374151]">
                <FileText className="w-3 h-3 text-[#6B7280]" />
                {error.referenceQuestion.examBoard}
              </span>
            )}
            {parsed.timeTag && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] tabular-nums">
                <Clock className="w-3 h-3 text-[#6B7280]" />
                {parsed.timeTag}
              </span>
            )}
          </div>
        </div>

        {/* Controles de status/prioridade + feedback de salvamento automático */}
        <div className="flex items-center gap-2 shrink-0">
          {justSaved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />
              Salvo
            </span>
          )}
          <select
            value={error.priority}
            onChange={handlePriorityChange}
            aria-label="Prioridade do erro (salva automaticamente)"
            title="Alterações são salvas automaticamente"
            className={`text-[11.5px] font-semibold px-3 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#111827]/15 ${prio.badgeBg} ${prio.badgeText}`}
          >
            {PRIORITY_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Corpo em 2 colunas: O que errei (estruturado + recolhível) | Correção (recuperação ativa) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {/* Bloco 1: O que errei */}
        <div className="p-3.5 rounded-2xl surface-inset flex flex-col justify-between gap-2.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                O que errei
              </p>
              {parsed.hasExtraDetails && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4B5563] hover:text-[#111827] cursor-pointer"
                >
                  {expanded ? (
                    <>
                      Recolher
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Expandir
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Enunciado / contexto curto */}
            <p
              className={`text-[#111827] leading-relaxed whitespace-pre-wrap ${
                !expanded ? 'line-clamp-3' : ''
              }`}
            >
              {parsed.statement}
            </p>

            {/* Gargalo / análise separado */}
            {parsed.bottleneck && expanded && (
              <div className="pt-2 border-t border-[#EAE9E4] space-y-1">
                <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#B45309]">
                  <ShieldAlert className="w-3 h-3" />
                  Gargalo / Ponto de falha
                </p>
                <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {parsed.bottleneck}
                </p>
              </div>
            )}
            {parsed.bottleneck && !expanded && (
              <p className="text-[11.5px] text-[#6B7280] truncate">
                <span className="font-medium text-[#B45309]">Gargalo:</span>{' '}
                {parsed.bottleneck}
              </p>
            )}
          </div>
        </div>

        {/* Bloco 2: Correção / Fundamento (evocação ativa) */}
        <div className="p-3.5 rounded-2xl bg-[#ECFDF5]/65 border border-[#A7F3D0]/60 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#047857]">
              Correção / Fundamento
            </p>
            {isRevealed && (
              <button
                type="button"
                onClick={onToggleReveal}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#047857] hover:underline cursor-pointer"
              >
                <EyeOff className="w-3 h-3" />
                Ocultar
              </button>
            )}
          </div>

          {isRevealed ? (
            <div className="space-y-2.5">
              <p className="text-[#111827] leading-relaxed whitespace-pre-wrap">
                {error.correction}
              </p>
              {error.prevention && (
                <div className="pt-2 border-t border-[#A7F3D0]/70 text-xs text-[#065F46] flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#059669]" />
                  <span>
                    <strong>Como evitar:</strong> {error.prevention}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleReveal}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl border border-dashed border-[#059669]/35 bg-white/85 text-xs font-medium text-[#047857] hover:bg-white transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Tentar lembrar e revelar resposta
            </button>
          )}
        </div>
      </div>

      {/* Rodapé: metadados temporais + salvamento automático + excluir afastado dos selects */}
      <div className="pt-2 border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Registrado {ageLabel} ({error.registrationDate})
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {error.reviewHistory.length}{' '}
            {error.reviewHistory.length === 1 ? 'revisão' : 'revisões'}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline text-[#9CA3AF]">
            Salvamento automático
          </span>
        </div>

        <button
          type="button"
          onClick={onRequestDelete}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition cursor-pointer"
          aria-label="Excluir registro de erro"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir</span>
        </button>
      </div>
    </article>
  );
};
