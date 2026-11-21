import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Check, ChevronDown, ChevronRight, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import type { DisciplineTheme, Exam } from '../../domain/types';

interface ExamManagerModalProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = Object.values(DISCIPLINE_THEMES);

export const ExamManagerModal: React.FC<ExamManagerModalProps> = ({
  open,
  onClose,
}) => {
  const {
    exams,
    activeExam,
    allDisciplines,
    selectActiveExam,
    addExam,
    updateExam,
    deleteExam,
    updateDiscipline,
    notify,
  } = useApp();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTheme, setNewTheme] = useState<DisciplineTheme>('sky');
  const [newDate, setNewDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTheme, setEditTheme] = useState<DisciplineTheme>('sky');
  const [editDate, setEditDate] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setEditingId(null);
    setConfirmDeleteId(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = await addExam({
      name: newName,
      description: newDesc,
      theme: newTheme,
      targetDate: newDate || null,
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setNewName('');
    setNewDesc('');
    setNewDate('');
    setNewTheme('sky');
  };

  const startEdit = (exam: Exam) => {
    setEditingId(exam.id);
    setEditName(exam.name);
    setEditDesc(exam.description);
    setEditTheme(exam.theme);
    setEditDate(exam.targetDate ?? '');
    setFormError(null);
  };

  const handleSaveEdit = async (exam: Exam) => {
    setFormError(null);
    const res = await updateExam({
      ...exam,
      name: editName,
      description: editDesc,
      theme: editTheme,
      targetDate: editDate || null,
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setEditingId(null);
  };

  const handleDelete = async (examId: string) => {
    setFormError(null);
    const res = await deleteExam(examId);
    if (!res.ok) {
      setFormError(res.error);
    }
    setConfirmDeleteId(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[28px] bg-white border border-[#EAE9E4] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#111827]">
                Meus Concursos
              </h3>
              <p className="text-xs text-[#6B7280]">
                Cada concurso mantém suas próprias disciplinas, ciclo e estatísticas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {formError}
            </div>
          )}

          {/* Lista de concursos */}
          <div className="space-y-2">
            {exams.map((exam) => {
              const isActive = activeExam?.id === exam.id;
              const theme = DISCIPLINE_THEMES[exam.theme] ?? DISCIPLINE_THEMES.sky;
              const discCount = allDisciplines.filter(
                (d) => d.examId === exam.id,
              ).length;
              const isEditing = editingId === exam.id;
              const isConfirmingDelete = confirmDeleteId === exam.id;

              if (isEditing) {
                return (
                  <div
                    key={exam.id}
                    className="p-4 rounded-2xl border border-[#BFDBFE] bg-[#F8FAFC] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome do concurso"
                        className="px-3 py-2 rounded-xl text-sm input-ambient bg-white"
                        autoFocus
                      />
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="px-3 py-2 rounded-xl text-sm input-ambient bg-white"
                      />
                    </div>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Cargo, banca ou observação (opcional)"
                      className="w-full px-3 py-2 rounded-xl text-sm input-ambient bg-white"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {THEME_OPTIONS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setEditTheme(t.id)}
                            title={t.label}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer transition ${
                              editTheme === t.id
                                ? 'border-[#111827] scale-110'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${t.dot}`} />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB] transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(exam)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#111827] text-white hover:bg-[#1F2937] transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const isExpanded = expandedExamId === exam.id;
              const examDisciplines = allDisciplines.filter((d) => d.examId === exam.id);

              return (
                <div
                  key={exam.id}
                  className={`rounded-2xl border transition overflow-hidden ${
                    isActive
                      ? 'bg-[#EFF6FF]/60 border-[#BFDBFE]'
                      : 'bg-white border-[#EAE9E4] hover:border-[#D1D5DB]'
                  }`}
                >
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await selectActiveExam(exam.id);
                        onClose();
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${theme.dot}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#111827] truncate">
                            {exam.name}
                          </p>
                          {isActive && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1D4ED8] text-white shrink-0">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] truncate">
                          {discCount} {discCount === 1 ? 'disciplina' : 'disciplinas'}
                          {exam.description ? ` · ${exam.description}` : ''}
                          {exam.targetDate ? ` · Prova: ${exam.targetDate}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {discCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                          title={isExpanded ? 'Ocultar disciplinas' : 'Ver disciplinas'}
                          className="px-2 py-1 rounded-xl flex items-center gap-1 text-[11.5px] font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
                        >
                          <span>Disciplinas</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(exam)}
                        title="Editar concurso"
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {exams.length > 1 && (
                        isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDelete(exam.id)}
                              className="px-2 py-1 rounded-lg bg-[#DC2626] text-white text-[11px] font-medium hover:bg-[#B91C1C] cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-[#F3F4F6] text-[#4B5563] text-[11px] font-medium hover:bg-[#E5E7EB] cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(exam.id)}
                            title="Excluir concurso"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Lista de disciplinas com opção de mover de concurso */}
                  {isExpanded && examDisciplines.length > 0 && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-[#F3F4F6] bg-[#FAFAF9]/80 space-y-1.5">
                      <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">
                        Disciplinas deste concurso:
                      </p>
                      {examDisciplines.map((d) => {
                        const dTheme = DISCIPLINE_THEMES[d.theme] ?? DISCIPLINE_THEMES.sky;
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-[#EAE9E4]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${dTheme.dot}`} />
                              <span className="text-[12.5px] font-medium text-[#111827] truncate">
                                {d.name}
                              </span>
                            </div>

                            {exams.length > 1 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] text-[#6B7280]">Mover para:</span>
                                <select
                                  value={d.examId}
                                  onChange={async (e) => {
                                    const targetExamId = e.target.value;
                                    if (targetExamId === d.examId) return;
                                    const targetExam = exams.find((x) => x.id === targetExamId);
                                    await updateDiscipline(
                                      { ...d, examId: targetExamId },
                                      `Disciplina "${d.name}" movida para "${targetExam?.name ?? 'outro concurso'}".`,
                                    );
                                    notify(`"${d.name}" movida para ${targetExam?.name ?? 'outro concurso'}.`, 'success');
                                  }}
                                  className="px-2 py-1 rounded-lg border border-[#D1D5DB] text-xs bg-white text-[#111827] cursor-pointer"
                                  title="Mudar disciplina de concurso"
                                >
                                  {exams.map((target) => (
                                    <option key={target.id} value={target.id}>
                                      {target.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Criar novo concurso */}
          <form
            onSubmit={handleCreate}
            className="pt-4 border-t border-[#F3F4F6] space-y-3"
          >
            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
              Adicionar novo concurso
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: TJ-SP, Receita Federal, ENEM..."
                className="px-3.5 py-2 rounded-xl text-sm input-ambient"
              />
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  title="Data prevista da prova (opcional)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm input-ambient"
                />
              </div>
            </div>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Cargo, banca ou observação (opcional)"
              className="w-full px-3.5 py-2 rounded-xl text-sm input-ambient"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewTheme(t.id)}
                    title={t.label}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer transition ${
                      newTheme === t.id
                        ? 'border-[#111827] scale-110'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${t.dot}`} />
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Criar concurso
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};
