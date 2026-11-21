import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Compass,
  History,
  Home,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { DISCIPLINE_THEMES } from '../../domain/constants';
import { detectStudyContext } from '../../domain/stats';
import type { NavTab } from '../../domain/types';
import { ExamManagerModal } from './ExamManagerModal';
import { TimerReadout } from './ui/TimerReadout';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'trails', label: 'Trilha', icon: Compass },
  { id: 'cycle', label: 'Ciclo de estudos', icon: RefreshCw },
  { id: 'errors', label: 'Caderno de erros', icon: BookOpen },
  { id: 'cards', label: 'Cartas', icon: Sparkles },
  { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  { id: 'history', label: 'Evolução', icon: History },
];

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeSession,
    elapsedSessionMs,
    errors,
    cycleState,
    exams,
    activeExam,
    allDisciplines,
    disciplines,
    activeDiscipline,
    selectActiveExam,
    selectActiveDiscipline,
    errorsAllDisciplines,
    setErrorsAllDisciplines,
    evaluatedCards,
  } = useApp();

  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const examMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!examMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        examMenuRef.current &&
        !examMenuRef.current.contains(e.target as Node)
      ) {
        setExamMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [examMenuOpen]);

  const openErrorsCount = errors.filter((e) => e.priority !== 'superado').length;
  const unlockedCardsCount = evaluatedCards.filter((c) => c.evaluation.unlocked).length;
  const studyContext = detectStudyContext(disciplines, cycleState);
  const activeExamTheme = activeExam
    ? (DISCIPLINE_THEMES[activeExam.theme] ?? DISCIPLINE_THEMES.sky)
    : DISCIPLINE_THEMES.sky;

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col bg-[#FAFAF8]/90 backdrop-blur-md rounded-[26px] border border-[#EAE9E4] p-3.5 shadow-[0_8px_30px_rgba(17,24,39,0.035)]">
      {/* Marca com orbe iridescente */}
      <div className="px-2 pt-1 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full iridescent-orb shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-[15px] tracking-tight text-[#111827] leading-tight truncate">
              TotalControle
            </h1>
            <p className="text-[11px] text-[#6B7280] leading-tight">
              Jornada iluminada
            </p>
          </div>
        </div>
      </div>

      {/* Seletor de Concurso Ativo */}
      <div className="relative mb-3" ref={examMenuRef}>
        <button
          type="button"
          onClick={() => setExamMenuOpen((v) => !v)}
          aria-expanded={examMenuOpen}
          aria-label="Trocar concurso ativo"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#EAE9E4] hover:border-[#D1D5DB] shadow-[0_2px_8px_rgba(17,24,39,0.03)] transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${activeExamTheme.dot}`} />
            <div className="min-w-0">
              <span className="block text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#9CA3AF] leading-none mb-0.5">
                Concurso ativo
              </span>
              <span className="block text-[12.5px] font-semibold text-[#111827] truncate leading-tight">
                {activeExam?.name ?? 'Concurso Principal'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#6B7280] shrink-0 transition-transform ${
              examMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {examMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl bg-white border border-[#EAE9E4] shadow-xl p-1.5 space-y-0.5">
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {exams.map((exam) => {
                const isSelected = exam.id === activeExam?.id;
                const theme = DISCIPLINE_THEMES[exam.theme] ?? DISCIPLINE_THEMES.sky;
                const count = allDisciplines.filter(
                  (d) => d.examId === exam.id,
                ).length;
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={async () => {
                      setExamMenuOpen(false);
                      await selectActiveExam(exam.id);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-[12.5px] transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                        : 'text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                      <span className="truncate">{exam.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10.5px] text-[#9CA3AF] tabular-nums">
                        {count}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pt-1 mt-1 border-t border-[#F3F4F6]">
              <button
                type="button"
                onClick={() => {
                  setExamMenuOpen(false);
                  setExamModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Gerenciar concursos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navegação principal */}
      <nav className="space-y-0.5" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all text-left cursor-pointer border ${
                isActive
                  ? 'bg-white text-[#111827] font-semibold border-[#EAE9E4] shadow-[0_2px_10px_rgba(17,24,39,0.045)]'
                  : 'border-transparent text-[#4B5563] font-medium hover:bg-white/60 hover:text-[#111827]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#111827]' : 'text-[#6B7280]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'errors' && openErrorsCount > 0 && (
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums bg-[#EDE9FE] text-[#6D28D9]">
                  {openErrorsCount}
                </span>
              )}
              {item.id === 'cards' && evaluatedCards.length > 0 && (
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums bg-[#FEF3C7] text-[#92400E]">
                  {unlockedCardsCount}/{evaluatedCards.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divisor + Lista de Disciplinas */}
      <div className="mt-4 pt-3.5 border-t border-[#F3F4F6] flex-1 min-h-0 flex flex-col">
        <div className="px-2.5 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
              Disciplinas
            </span>
            {activeTab === 'errors' && errorsAllDisciplines && (
              <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">
                Todas
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('trails')}
            title="Gerenciar ou adicionar disciplinas"
            aria-label="Adicionar disciplina"
            className="w-5 h-5 rounded-md flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
          {disciplines.length === 0 ? (
            <p className="px-2.5 py-2 text-[11.5px] text-[#9CA3AF]">
              Nenhuma disciplina ainda
            </p>
          ) : (
            disciplines.map((d) => {
              const theme = DISCIPLINE_THEMES[d.theme];
              const isSelected =
                activeDiscipline?.id === d.id &&
                !(activeTab === 'errors' && errorsAllDisciplines);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={async () => {
                    setErrorsAllDisciplines(false);
                    await selectActiveDiscipline(d.id);
                    if (
                      activeTab !== 'dashboard' &&
                      activeTab !== 'trails' &&
                      activeTab !== 'errors'
                    ) {
                      setActiveTab('trails');
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[12.5px] transition text-left cursor-pointer border ${
                    isSelected
                      ? 'bg-white text-[#111827] font-semibold border-[#EAE9E4] shadow-[0_1px_6px_rgba(17,24,39,0.04)]'
                      : 'border-transparent text-[#4B5563] hover:bg-white/60 hover:text-[#111827]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                  <span className="truncate">{d.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Rodapé: Sessão ativa (se houver) + Configurações */}
      <div className="pt-3 border-t border-[#F3F4F6] space-y-2">
        {activeSession ? (
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeSession.origin === 'trilha' ? 'trails' : 'cycle')
            }
            className="w-full text-left p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]/80 hover:bg-[#DBEAFE]/60 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-[10.5px] font-medium text-[#1D4ED8] mb-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeSession.status === 'running' ? 'Em curso' : 'Pausada'}
              </span>
              <TimerReadout ms={elapsedSessionMs} className="text-[11px] font-semibold" />
            </div>
            <p className="text-[12px] font-semibold text-[#111827] truncate">
              {activeSession.disciplineName}
            </p>
          </button>
        ) : (
          studyContext.hasActiveCycle && (
            <button
              type="button"
              onClick={() => setActiveTab('cycle')}
              className="w-full text-left px-2.5 py-2 rounded-xl bg-[#F7F7F5] border border-[#EAE9E4] hover:bg-[#F3F4F6] transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[10.5px] text-[#6B7280]">
                <span>Ciclo #{cycleState.cycleNumber}</span>
                <span className="tabular-nums">
                  {cycleState.position + 1}/{cycleState.plan!.blocks.length}
                </span>
              </div>
              <p className="text-[11.5px] text-[#111827] font-medium truncate">
                {cycleState.plan!.blocks[cycleState.position]?.disciplineName}
              </p>
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[12.5px] transition-all text-left cursor-pointer border ${
            activeTab === 'settings'
              ? 'bg-white text-[#111827] font-semibold border-[#EAE9E4] shadow-[0_2px_10px_rgba(17,24,39,0.045)]'
              : 'border-transparent text-[#4B5563] font-medium hover:bg-white/60 hover:text-[#111827]'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Settings
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'settings' ? 'text-[#111827]' : 'text-[#6B7280]'
              }`}
            />
            <span className="truncate">Dados & Preferências</span>
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0"
            title="Offline local"
          />
        </button>
      </div>
      <ExamManagerModal
        open={examModalOpen}
        onClose={() => setExamModalOpen(false)}
      />
    </aside>
  );
};
