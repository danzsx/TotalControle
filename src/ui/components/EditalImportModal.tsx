import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import {
  parseEditalText,
  type ParsedDisciplineDraft,
} from '../../domain/editalParser';
import type { DisciplineTheme } from '../../domain/types';

interface EditalImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultIncludeInCycle?: boolean;
}

const SAMPLE_EDITAL_TEXT = `CONHECIMENTOS BÁSICOS

LÍNGUA PORTUGUESA
1. Compreensão e interpretação de textos de gêneros variados.
2. Reconhecimento de tipos e gêneros textuais.
3. Domínio da ortografia oficial e acentuação gráfica.
4. Domínio dos mecanismos de coesão textual: emprego de elementos de referenciação, substituição e repetição, conectores e sequenciação.
5. Emprego de tempos e modos verbais; concordância verbal e nominal; regência verbal e nominal; crase.

RACIOCÍNIO LÓGICO
1. Estruturas lógicas e lógica de argumentação: analogias, inferências, deduções e conclusões.
2. Lógica sentencial (proposicional): proposições simples e compostas, tabelas-verdade, equivalências e leis de De Morgan.
3. Princípios de contagem, análise combinatória e probabilidade.

CONHECIMENTOS ESPECÍFICOS

DIREITO ADMINISTRATIVO
1. Estado, governo e administração pública: conceitos, elementos, poderes e organização.
2. Ato administrativo: conceito, requisitos, atributos, classificação e espécies.
3. Licitações e contratos administrativos (Lei nº 14.133/2021): princípios, modalidades e dispensa.`;

export const EditalImportModal: React.FC<EditalImportModalProps> = ({
  open,
  onClose,
  defaultIncludeInCycle = false,
}) => {
  const { addDisciplinesFromEdital, activeExam } = useApp();

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [rawText, setRawText] = useState('');
  const [defaultDisciplineName, setDefaultDisciplineName] = useState('');
  const [includeInCycle, setIncludeInCycle] = useState(defaultIncludeInCycle);
  const [drafts, setDrafts] = useState<ParsedDisciplineDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expandedDiscIds, setExpandedDiscIds] = useState<Record<string, boolean>>({});
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIncludeInCycle(defaultIncludeInCycle);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, defaultIncludeInCycle, onClose]);

  const handleAnalyze = () => {
    const result = parseEditalText(rawText, {
      defaultDisciplineName: defaultDisciplineName.trim() || undefined,
    });
    setDrafts(result.disciplines);
    setWarnings(result.warnings);
    const expanded: Record<string, boolean> = {};
    if (result.disciplines[0]) {
      expanded[result.disciplines[0].id] = true;
    }
    setExpandedDiscIds(expanded);
    if (result.disciplines.length > 0) {
      setStep('preview');
    }
  };

  const selectedDrafts = useMemo(
    () => drafts.filter((d) => d.selected && d.name.trim().length > 0),
    [drafts],
  );

  const totalSelectedTopics = useMemo(
    () =>
      selectedDrafts.reduce(
        (acc, d) =>
          acc +
          d.levels.reduce(
            (lAcc, l) => lAcc + l.modules.reduce((mAcc, m) => mAcc + m.contents.length, 0),
            0,
          ),
        0,
      ),
    [selectedDrafts],
  );

  const handleConfirmImport = async () => {
    if (selectedDrafts.length === 0 || isImporting) return;
    setIsImporting(true);
    try {
      await addDisciplinesFromEdital(selectedDrafts, {
        inCycle: includeInCycle,
      });
      setRawText('');
      setDefaultDisciplineName('');
      setDrafts([]);
      setWarnings([]);
      setStep('input');
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<ParsedDisciplineDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeContentFromDraft = (discId: string, levelId: string, modId: string, cntId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== discId) return d;
        return {
          ...d,
          levels: d.levels
            .map((l) => {
              if (l.id !== levelId) return l;
              return {
                ...l,
                modules: l.modules
                  .map((m) =>
                    m.id === modId
                      ? { ...m, contents: m.contents.filter((c) => c.id !== cntId) }
                      : m,
                  )
                  .filter((m) => m.contents.length > 0),
              };
            })
            .filter((l) => l.modules.length > 0),
        };
      }),
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Importar Edital para Trilhas"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[28px] bg-white border border-[#EAE9E4] shadow-[0_24px_60px_rgba(17,24,39,0.16)] overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#F3EEFF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-[#111827] truncate">
                Transformar Edital em Trilha
              </h3>
              <p className="text-xs text-[#6B7280] truncate">
                Cole o conteúdo programático do edital{activeExam ? ` para "${activeExam.name}"` : ''}. O algoritmo organiza em disciplinas, módulos e tópicos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-xl text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 'input' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#4B5563]">
                  Cole abaixo o texto copiado do PDF ou página do edital:
                </span>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_EDITAL_TEXT)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3EEFF] text-[#5B21B6] text-xs font-medium hover:bg-[#EDE9FE] transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Carregar exemplo de edital
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder={`Exemplo:\nLÍNGUA PORTUGUESA\n1. Compreensão e interpretação de textos.\n2. Ortografia oficial e acentuação.\n\nDIREITO CONSTITUCIONAL\n1. Princípios fundamentais.\n2. Direitos e garantias fundamentais.`}
                className="w-full px-4 py-3 rounded-2xl text-sm input-ambient font-sans leading-relaxed resize-y min-h-[240px]"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                    Nome padrão da disciplina (opcional)
                  </label>
                  <input
                    type="text"
                    value={defaultDisciplineName}
                    onChange={(e) => setDefaultDisciplineName(e.target.value)}
                    placeholder="Usado se você colar tópicos sem título"
                    className="w-full px-3.5 py-2 rounded-xl text-sm input-ambient"
                  />
                </div>
                <label className="flex items-center gap-2.5 p-3.5 rounded-2xl surface-inset cursor-pointer self-end">
                  <input
                    type="checkbox"
                    checked={includeInCycle}
                    onChange={(e) => setIncludeInCycle(e.target.checked)}
                    className="w-4 h-4 accent-[#111827]"
                  />
                  <span className="text-xs text-[#4B5563]">
                    Incluir disciplinas geradas no Ciclo de Estudos
                  </span>
                </label>
              </div>

              {warnings.length > 0 && drafts.length === 0 && (
                <div className="p-3.5 rounded-2xl bg-[#FEF9EC] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Resumo da análise */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl surface-inset">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#4B5563]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827]">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    {selectedDrafts.length} disciplina{selectedDrafts.length === 1 ? '' : 's'} selecionada{selectedDrafts.length === 1 ? '' : 's'}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {totalSelectedTopics} tópico{totalSelectedTopics === 1 ? '' : 's'} na trilha
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInCycle}
                    onChange={(e) => setIncludeInCycle(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#111827]"
                  />
                  <span className="text-xs text-[#4B5563]">Incluir no Ciclo</span>
                </label>
              </div>

              {warnings.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#FEF9EC] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de disciplinas analisadas */}
              <div className="space-y-3">
                {drafts.map((disc) => {
                  const isExpanded = Boolean(expandedDiscIds[disc.id]);
                  const theme = DISCIPLINE_THEMES[disc.theme];
                  const topicCount = disc.levels.reduce(
                    (acc, l) => acc + l.modules.reduce((mAcc, m) => mAcc + m.contents.length, 0),
                    0,
                  );

                  return (
                    <div
                      key={disc.id}
                      className={`rounded-2xl border transition ${
                        disc.selected
                          ? 'bg-white border-[#EAE9E4]'
                          : 'bg-[#F9FAFB] border-[#F3F4F6] opacity-60'
                      }`}
                    >
                      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={disc.selected}
                            onChange={(e) => updateDraft(disc.id, { selected: e.target.checked })}
                            className="w-4 h-4 accent-[#111827] shrink-0"
                          />
                          <span className={`w-3 h-3 rounded-full shrink-0 ${theme.dot}`} />
                          <input
                            type="text"
                            value={disc.name}
                            onChange={(e) => updateDraft(disc.id, { name: e.target.value })}
                            className="font-display font-semibold text-sm text-[#111827] bg-transparent border-b border-transparent focus:border-[#D1D5DB] focus:outline-none min-w-0 flex-1"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={disc.theme}
                            onChange={(e) =>
                              updateDraft(disc.id, { theme: e.target.value as DisciplineTheme })
                            }
                            aria-label={`Tema de ${disc.name}`}
                            className="px-2.5 py-1 rounded-lg border border-[#EAE9E4] text-xs bg-white text-[#4B5563]"
                          >
                            {Object.values(DISCIPLINE_THEMES).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>

                          <span className="text-xs text-[#6B7280] tabular-nums px-2 py-1 rounded-lg bg-[#F3F4F6]">
                            {disc.levels.length} níve{disc.levels.length === 1 ? 'l' : 'is'} · {topicCount} tópico{topicCount === 1 ? '' : 's'}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDiscIds((prev) => ({
                                ...prev,
                                [disc.id]: !prev[disc.id],
                              }))
                            }
                            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] cursor-pointer"
                            aria-label="Expandir prévia da disciplina"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[#F3F4F6] space-y-3">
                          {disc.levels.map((lvl) => (
                            <div key={lvl.id} className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold text-[#4B5563] pt-1">
                                <span>{lvl.title}</span>
                                <span className="text-[11px] font-normal text-[#9CA3AF]">
                                  {lvl.landscapeName}
                                </span>
                              </div>
                              <div className="space-y-2 pl-2 border-l-2 border-[#EAE9E4]">
                                {lvl.modules.map((mod) => (
                                  <div key={mod.id} className="space-y-1.5">
                                    <p className="text-xs font-medium text-[#111827]">
                                      {mod.title}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {mod.contents.map((cnt) => (
                                        <div
                                          key={cnt.id}
                                          className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]"
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              {cnt.editalRef && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] shrink-0">
                                                  {cnt.editalRef}
                                                </span>
                                              )}
                                              <span className="text-xs font-medium text-[#111827] truncate">
                                                {cnt.title}
                                              </span>
                                            </div>
                                            {cnt.description !== cnt.title && (
                                              <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-0.5">
                                                {cnt.description}
                                              </p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeContentFromDraft(disc.id, lvl.id, mod.id, cnt.id)
                                            }
                                            title="Remover tópico"
                                            className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] hover:bg-white shrink-0 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3 bg-[#FAFAF9]">
          {step === 'input' ? (
            <>
              <span className="text-xs text-[#6B7280]">
                Processamento 100% local e instantâneo.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!rawText.trim()}
                  onClick={handleAnalyze}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1F2937] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analisar e gerar prévia
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar e editar texto
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedDrafts.length === 0 || isImporting}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isImporting
                    ? 'Gerando trilhas...'
                    : `Criar ${selectedDrafts.length} trilha${selectedDrafts.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
