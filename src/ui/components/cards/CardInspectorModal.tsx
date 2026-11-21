import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, X } from 'lucide-react';
import type { EvaluatedCard } from '../../../domain/cards/types';
import { TradingCard3D } from './TradingCard3D';

interface CardInspectorModalProps {
  items: EvaluatedCard[];
  activeIndex: number | null;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export const CardInspectorModal: React.FC<CardInspectorModalProps> = ({
  items,
  activeIndex,
  onClose,
  onSelectIndex,
}) => {
  const [flipped, setFlipped] = useState(false);

  const currentItem =
    activeIndex !== null && activeIndex >= 0 && activeIndex < items.length
      ? items[activeIndex]
      : null;

  useEffect(() => {
    setFlipped(false);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        onSelectIndex(activeIndex - 1);
      } else if (e.key === 'ArrowRight' && activeIndex < items.length - 1) {
        onSelectIndex(activeIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, items.length, onClose, onSelectIndex]);

  if (!currentItem || activeIndex === null) return null;

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < items.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/80 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspeção 3D de ${currentItem.card.name}`}
    >
      <div
        className="relative flex flex-col items-center gap-5 max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior */}
        <div className="w-full flex items-center justify-between text-white px-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#FBBF24] font-semibold">
              Visualização 3D · {currentItem.card.number}
            </p>
            <h3 className="font-display text-lg font-bold">
              {currentItem.evaluation.unlocked
                ? currentItem.card.name
                : 'Carta Bloqueada'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização 3D"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Área da Carta + Navegação */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 w-full">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectIndex(activeIndex - 1)}
            aria-label="Carta anterior"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <TradingCard3D
            item={currentItem}
            size="inspector"
            flipped={flipped}
            onFlipChange={setFlipped}
          />

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectIndex(activeIndex + 1)}
            aria-label="Próxima carta"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Controles inferiores */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#111827] text-xs font-semibold shadow-lg hover:bg-[#F3F4F6] transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {flipped ? 'Ver Frente da Carta' : 'Ver Verso & Lore'}
          </button>
          <span className="text-[11.5px] text-white/70">
            Mova o cursor ou toque para inclinar em 3D · {activeIndex + 1} de {items.length}
          </span>
        </div>
      </div>
    </div>
  );
};
