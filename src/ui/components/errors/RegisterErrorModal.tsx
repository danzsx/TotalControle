import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  ORIGINS,
  PRIORITY_LIST,
  SELECTABLE_ORIGINS,
} from '../../../domain/constants';
import { flattenContents } from '../../../domain/mastery';
import { formatToDDMMYYYY } from '../../../domain/text';
import type {
  Discipline,
  ErrorOrigin,
  ErrorRecord,
  PriorityLevel,
  Result,
} from '../../../domain/types';
import { composeErrorDescription } from './errorHelpers';

interface RegisterErrorModalProps {
  open: boolean;
  disciplines: Discipline[];
  initialDisciplineId?: string;
  initialContentId?: string;
  onClose: () => void;
  onSubmit: (input: {
    disciplineId: string;
    contentId: string;
    description: string;
    correction: string;
    prevention: string;
    priority: PriorityLevel;
    origin: ErrorOrigin;
    registrationDate: string;
    referenceQuestion?: ErrorRecord['referenceQuestion'];
  }) => Promise<Result<ErrorRecord>>;
}

export const RegisterErrorModal: React.FC<RegisterErrorModalProps> = ({
  open,
  disciplines,
  initialDisciplineId,
  initialContentId,
  onClose,
  onSubmit,
}) => {
  const [formDiscId, setFormDiscId] = useState(
    initialDisciplineId || disciplines[0]?.id || '',
  );
  const [formContentId, setFormContentId] = useState(initialContentId || '');
  const [formOrigin, setFormOrigin] = useState<ErrorOrigin>('desconhecimento');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('alta');
  const [formDate, setFormDate] = useState(formatToDDMMYYYY());
  const [formBoard, setFormBoard] = useState('');
  const [formTimeSpent, setFormTimeSpent] = useState('');
  const [formStatement, setFormStatement] = useState('');
  const [formBottleneck, setFormBottleneck] = useState('');
  const [formCorr, setFormCorr] = useState('');
  const [formPrev, setFormPrev] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sincroniza disciplina/conteúdo ao abrir modal
  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initialDisciplineId) {
      setFormDiscId(initialDisciplineId);
    } else if (!formDiscId && disciplines[0]?.id) {
      setFormDiscId(disciplines[0].id);
    }
    if (initialContentId) {
      setFormContentId(initialContentId);
    }
  }, [open, initialDisciplineId, initialContentId, disciplines, formDiscId]);

  const formContents = useMemo(() => {
    const disc = disciplines.find((d) => d.id === formDiscId);
    return disc ? flattenContents(disc) : [];
  }, [disciplines, formDiscId]);

  useEffect(() => {
    if (
      formContents.length > 0 &&
      !formContents.some((c) => c.id === formContentId)
    ) {
      setFormContentId(formContents[0].id);
    } else if (formContents.length === 0) {
      setFormContentId('');
    }
  }, [formContents, formContentId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const description = composeErrorDescription({
        statement: formStatement,
        bottleneck: formBottleneck,
        timeSpent: formTimeSpent,
      });

      const res = await onSubmit({
        disciplineId: formDiscId,
        contentId: formContentId,
        description,
        correction: formCorr,
        prevention: formPrev,
        priority: formPriority,
        origin: formOrigin,
        registrationDate: formDate,
        referenceQuestion: formBoard.trim()
          ? { examBoard: formBoard.trim() }
          : undefined,
      });

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      setFormStatement('');
      setFormBottleneck('');
      setFormCorr('');
      setFormPrev('');
      setFormBoard('');
      setFormTimeSpent('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/35 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-error-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white border border-[#EAE9E4] shadow-[0_24px_60px_rgba(17,24,39,0.18)] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="register-error-title"
              className="font-display text-xl font-bold text-[#111827]"
            >
              Registrar erro no caderno
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Registre de forma objetiva para revisar por evocação ativa depois.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de registro"
            className="p-2 rounded-xl text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]">
              {formError}
            </div>
          )}

          {/* Disciplina & Conteúdo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Disciplina
              </label>
              <select
                value={formDiscId}
                onChange={(e) => setFormDiscId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Tópico na Trilha
              </label>
              <select
                value={formContentId}
                onChange={(e) => setFormContentId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                {formContents.length === 0 ? (
                  <option value="">
                    Nenhum tópico nesta disciplina (crie na Trilha)
                  </option>
                ) : (
                  formContents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Classificação e referência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Origem do erro
              </label>
              <select
                value={formOrigin}
                onChange={(e) => setFormOrigin(e.target.value as ErrorOrigin)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                {SELECTABLE_ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Prioridade
              </label>
              <select
                value={formPriority}
                onChange={(e) =>
                  setFormPriority(e.target.value as PriorityLevel)
                }
                className="w-full px-3 py-2 rounded-xl border border-[#EAE9E4] bg-white text-sm text-[#111827]"
              >
                {PRIORITY_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Banca / Questão
              </label>
              <input
                type="text"
                value={formBoard}
                onChange={(e) => setFormBoard(e.target.value)}
                placeholder="Ex.: FGV Q12"
                className="w-full px-3 py-2 rounded-xl text-sm input-ambient"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Tempo (opcional)
              </label>
              <input
                type="text"
                value={formTimeSpent}
                onChange={(e) => setFormTimeSpent(e.target.value)}
                placeholder="Ex.: 3 min"
                className="w-full px-3 py-2 rounded-xl text-sm input-ambient"
              />
            </div>
          </div>

          <p className="text-[11.5px] text-[#6B7280] -mt-1">
            {ORIGINS[formOrigin].description}
          </p>

          {/* Enunciado / O que errei */}
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              O que você errou? (enunciado ou ponto cobrado)
            </label>
            <textarea
              rows={2}
              value={formStatement}
              onChange={(e) => setFormStatement(e.target.value)}
              placeholder="Ex.: Questão sobre prazo de decadência no lançamento por homologação..."
              className="w-full rounded-2xl p-3 text-sm input-ambient"
            />
          </div>

          {/* Gargalo separado */}
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              Gargalo / Por que errou? (opcional)
            </label>
            <input
              type="text"
              value={formBottleneck}
              onChange={(e) => setFormBottleneck(e.target.value)}
              placeholder="Ex.: Confundi contagem com ou sem pagamento antecipado"
              className="w-full px-3.5 py-2 rounded-xl text-sm input-ambient"
            />
          </div>

          {/* Correção / Fundamento */}
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              Correção / Fundamento correto
            </label>
            <textarea
              rows={3}
              value={formCorr}
              onChange={(e) => setFormCorr(e.target.value)}
              placeholder="Qual é a regra, súmula, artigo ou raciocínio correto?"
              className="w-full rounded-2xl p-3 text-sm input-ambient"
            />
          </div>

          {/* Prevenção + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Como evitar na prova (opcional)
              </label>
              <input
                type="text"
                value={formPrev}
                onChange={(e) => setFormPrev(e.target.value)}
                placeholder="Ex.: Verificar sempre se houve pagamento parcial"
                className="w-full px-3.5 py-2 rounded-xl text-sm input-ambient"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Data (DD/MM/AAAA)
              </label>
              <input
                type="text"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm tabular-nums input-ambient"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium shadow-sm disabled:opacity-60 transition cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar no caderno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
