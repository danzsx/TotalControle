import React, { useMemo, useState } from 'react';
import { Award, Layers, Lock, Search, Sparkles } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { CARD_THEMES, getCardTheme } from '../../domain/cards/registry';
import type { CardRarity } from '../../domain/cards/types';
import { CardInspectorModal } from '../components/cards/CardInspectorModal';
import { TradingCard3D } from '../components/cards/TradingCard3D';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';

type UnlockFilter = 'all' | 'unlocked' | 'locked';

const RARITY_ORDER: Record<CardRarity, number> = {
  lendaria: 4,
  epica: 3,
  rara: 2,
  comum: 1,
};

export const CardsView: React.FC = () => {
  const { evaluatedCards } = useApp();

  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    CARD_THEMES[0]?.id ?? 'biblico',
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [unlockFilter, setUnlockFilter] = useState<UnlockFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'number' | 'rarity' | 'progress'>('number');
  const [inspectorIndex, setInspectorIndex] = useState<number | null>(null);

  const activeTheme = getCardTheme(selectedThemeId) ?? CARD_THEMES[0];

  const themeCards = useMemo(
    () => evaluatedCards.filter((item) => item.card.themeId === selectedThemeId),
    [evaluatedCards, selectedThemeId],
  );

  const unlockedCount = useMemo(
    () => themeCards.filter((item) => item.evaluation.unlocked).length,
    [themeCards],
  );
  const totalCount = themeCards.length;
  const completionPct =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = themeCards.filter((item) => {
      if (selectedCategoryId !== 'all' && item.card.categoryId !== selectedCategoryId) {
        return false;
      }
      if (unlockFilter === 'unlocked' && !item.evaluation.unlocked) return false;
      if (unlockFilter === 'locked' && item.evaluation.unlocked) return false;

      if (q) {
        const haystack = [
          item.card.name,
          item.card.subtitle,
          item.card.reference,
          item.card.artwork.artist,
          item.card.achievement.title,
          item.card.achievement.description,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'rarity') {
        const diff = RARITY_ORDER[b.card.rarity] - RARITY_ORDER[a.card.rarity];
        if (diff !== 0) return diff;
      } else if (sortBy === 'progress') {
        if (a.evaluation.unlocked !== b.evaluation.unlocked) {
          return a.evaluation.unlocked ? -1 : 1;
        }
        const diff = b.evaluation.progressPct - a.evaluation.progressPct;
        if (diff !== 0) return diff;
      }
      return a.card.number.localeCompare(b.card.number);
    });
  }, [themeCards, selectedCategoryId, unlockFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <PageHeader
        useOrbBadge
        badge="Coleção & Conquistas"
        title="Catálogo de Cartas"
        subtitle="Conclua sessões, avance nas trilhas e supere erros para desbloquear cartas colecionáveis em 3D."
        actions={
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-[#EAE9E4] shadow-[0_2px_10px_rgba(17,24,39,0.03)]">
            <Sparkles className="w-4 h-4 text-[#D97706]" />
            <span className="text-xs font-semibold text-[#111827] tabular-nums">
              {unlockedCount}/{totalCount} desbloqueadas ({completionPct}%)
            </span>
          </div>
        }
      />

      {/* Painel de Temas & Progresso */}
      <section className="surface-card rounded-[24px] p-4 md:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {CARD_THEMES.map((theme) => {
              const isSelected = theme.id === selectedThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSelectedThemeId(theme.id);
                    setSelectedCategoryId('all');
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#111827] text-white border-[#111827] shadow-sm'
                      : 'bg-[#FAFAF9] text-[#4B5563] border-[#EAE9E4] hover:bg-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{theme.name}</span>
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-medium bg-[#FAFAF9] text-[#9CA3AF] border border-dashed border-[#D1D5DB]">
              + Novos temas em breve
            </span>
          </div>

          {/* Barra de progresso do tema */}
          <div className="w-full lg:w-72 space-y-1.5">
            <div className="flex items-center justify-between text-[11.5px] text-[#4B5563]">
              <span className="font-medium">{activeTheme?.subtitle}</span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {completionPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] via-[#D97706] to-[#B45309] transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filtros por Categoria, Status e Busca */}
        <div className="pt-3 border-t border-[#F3F4F6] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Categorias do Tema */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                selectedCategoryId === 'all'
                  ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] font-semibold'
                  : 'bg-[#FAFAF9] text-[#4B5563] border-[#EAE9E4] hover:bg-white'
              }`}
            >
              Todas ({themeCards.length})
            </button>
            {activeTheme?.categories.map((cat) => {
              const count = themeCards.filter(
                (i) => i.card.categoryId === cat.id,
              ).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] font-semibold'
                      : 'bg-[#FAFAF9] text-[#4B5563] border-[#EAE9E4] hover:bg-white'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Status, Ordenação e Busca */}
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              value={unlockFilter}
              onChange={(v) => setUnlockFilter(v as UnlockFilter)}
              options={[
                { id: 'all', label: 'Todas' },
                { id: 'unlocked', label: `Desbloqueadas (${unlockedCount})` },
                { id: 'locked', label: `Bloqueadas (${totalCount - unlockedCount})` },
              ]}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'number' | 'rarity' | 'progress')}
              aria-label="Ordenar cartas"
              className="input-ambient rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer"
            >
              <option value="number">Ordem (#)</option>
              <option value="rarity">Raridade</option>
              <option value="progress">Progresso</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar carta ou conquista..."
                className="input-ambient rounded-xl pl-8 pr-3 py-1.5 text-xs w-52"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Cartas 3D */}
      {filteredCards.length === 0 ? (
        <div className="surface-card rounded-[24px] p-10 text-center space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center mx-auto">
            {unlockFilter === 'locked' ? (
              <Award className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>
          <h3 className="font-display font-semibold text-base text-[#111827]">
            Nenhuma carta encontrada neste filtro
          </h3>
          <p className="text-xs text-[#6B7280]">
            Ajuste a categoria, o filtro de desbloqueio ou o termo de busca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCards.map((item, idx) => (
            <TradingCard3D
              key={item.card.id}
              item={item}
              size="catalog"
              onOpenInspector={() => setInspectorIndex(idx)}
            />
          ))}
        </div>
      )}

      {/* Modal de Inspeção 3D Ampliado */}
      <CardInspectorModal
        items={filteredCards}
        activeIndex={inspectorIndex}
        onClose={() => setInspectorIndex(null)}
        onSelectIndex={(idx) => setInspectorIndex(idx)}
      />
    </div>
  );
};
