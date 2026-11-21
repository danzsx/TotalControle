import React, { useCallback, useRef, useState } from 'react';
import { Award, BookOpen, Crown, Lock, RotateCw, Sparkles } from 'lucide-react';
import type { CardRarity, EvaluatedCard } from '../../../domain/cards/types';
import './cards3d.css';

interface TradingCard3DProps {
  item: EvaluatedCard;
  size?: 'catalog' | 'inspector';
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  onOpenInspector?: () => void;
  interactive3d?: boolean;
}

const RARITY_STYLES: Record<
  CardRarity,
  {
    label: string;
    frameBg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    accentBar: string;
    holoClass: string;
    glowShadow: string;
  }
> = {
  comum: {
    label: 'Comum',
    frameBg: 'from-[#F5F2EB] via-[#ECE6D8] to-[#E2DAC7]',
    border: 'border-[#C9BFA9]',
    badgeBg: 'bg-[#E7E0D0]',
    badgeText: 'text-[#574E3B]',
    accentBar: 'bg-[#8C7A5B]',
    holoClass: 'tcg-holo-comum',
    glowShadow: 'shadow-[0_14px_30px_rgba(17,24,39,0.12)]',
  },
  rara: {
    label: 'Rara',
    frameBg: 'from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE]',
    border: 'border-[#60A5FA]',
    badgeBg: 'bg-[#DBEAFE]',
    badgeText: 'text-[#1D4ED8]',
    accentBar: 'bg-[#2563EB]',
    holoClass: 'tcg-holo-rara',
    glowShadow: 'shadow-[0_16px_34px_rgba(37,99,235,0.22)]',
  },
  epica: {
    label: 'Épica',
    frameBg: 'from-[#F5F3FF] via-[#EDE9FE] to-[#DDD6FE]',
    border: 'border-[#A78BFA]',
    badgeBg: 'bg-[#EDE9FE]',
    badgeText: 'text-[#6D28D9]',
    accentBar: 'bg-[#7C3AED]',
    holoClass: 'tcg-holo-epica',
    glowShadow: 'shadow-[0_18px_38px_rgba(124,58,237,0.26)]',
  },
  lendaria: {
    label: 'Lendária',
    frameBg: 'from-[#FEF9C3] via-[#FDE68A] to-[#F59E0B]',
    border: 'border-[#D97706]',
    badgeBg: 'bg-[#FEF3C7]',
    badgeText: 'text-[#92400E]',
    accentBar: 'bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-[#B45309]',
    holoClass: 'tcg-holo-lendaria',
    glowShadow: 'shadow-[0_20px_44px_rgba(217,119,6,0.34)]',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  personagens: 'Personagem',
  historias: 'História Épica',
  milagres: 'Milagre de Jesus',
};

function formatUnlockDate(iso: string | null): string {
  if (!iso) return 'Desbloqueada';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Desbloqueada';
  }
}

export const TradingCard3D: React.FC<TradingCard3DProps> = ({
  item,
  size = 'catalog',
  flipped: controlledFlipped,
  onFlipChange,
  onOpenInspector,
  interactive3d = true,
}) => {
  const { card, evaluation, unlockedAt } = item;
  const unlocked = evaluation.unlocked;
  const style = RARITY_STYLES[card.rarity];

  const [internalFlipped, setInternalFlipped] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const tiltRef = useRef<HTMLDivElement | null>(null);

  const isFlipped = controlledFlipped ?? internalFlipped;
  const isInspector = size === 'inspector';
  const maxTilt = isInspector ? 20 : 14;

  const updateTiltFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = tiltRef.current;
      if (!el || !interactive3d) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const rx = (0.5 - py) * maxTilt;
      const ry = (px - 0.5) * maxTilt;
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      el.style.setProperty('--glow', '1');
    },
    [interactive3d, maxTilt],
  );

  const resetTilt = useCallback(() => {
    const el = tiltRef.current;
    setIsInteracting(false);
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--glow', '0');
  }, []);

  const handleCardClick = () => {
    if (onOpenInspector && !isInspector) {
      onOpenInspector();
      return;
    }
    const next = !isFlipped;
    if (onFlipChange) onFlipChange(next);
    else setInternalFlipped(next);
  };

  return (
    <div
      className={`tcg-scene select-none ${
        isInspector
          ? 'w-[320px] sm:w-[356px] h-[476px] sm:h-[526px]'
          : 'w-full aspect-[2.5/3.65]'
      }`}
    >
      <div
        ref={tiltRef}
        onPointerEnter={() => interactive3d && setIsInteracting(true)}
        onPointerMove={(e) => {
          if (!interactive3d) return;
          if (!isInteracting) setIsInteracting(true);
          updateTiltFromPoint(e.clientX, e.clientY);
        }}
        onPointerLeave={resetTilt}
        onTouchMove={(e) => {
          if (!interactive3d || e.touches.length === 0) return;
          if (!isInteracting) setIsInteracting(true);
          updateTiltFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={resetTilt}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        aria-label={
          unlocked
            ? `Carta ${card.name}, raridade ${style.label}. ${
                isInspector ? 'Clique para virar frente ou verso.' : 'Clique para inspecionar em 3D.'
              }`
            : `Carta bloqueada: ${card.achievement.title}. Progresso ${evaluation.current} de ${evaluation.target}.`
        }
        className={`tcg-tilt w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] rounded-[20px] ${
          isInteracting ? 'is-interacting' : ''
        }`}
      >
        <div className={`tcg-flipper ${isFlipped ? 'is-flipped' : ''}`}>
          {/* ===============================================================
              FRENTE DA CARTA
             =============================================================== */}
          <div
            className={`tcg-face border-2 ${
              unlocked
                ? `${style.border} bg-gradient-to-br ${style.frameBg} ${style.glowShadow}`
                : 'border-[#374151] bg-gradient-to-br from-[#1F2937] via-[#111827] to-[#0F172A] shadow-[0_14px_30px_rgba(17,24,39,0.2)]'
            } p-2.5 flex flex-col justify-between`}
          >
            {/* Camada holográfica */}
            {unlocked && <div className={`tcg-holo-layer ${style.holoClass}`} />}

            {/* Borda interna ornamental */}
            <div
              className={`relative z-10 flex-1 rounded-[14px] border flex flex-col overflow-hidden ${
                unlocked
                  ? 'border-white/70 bg-white/80 backdrop-blur-[2px]'
                  : 'border-white/10 bg-[#111827]/90'
              }`}
            >
              {/* Cabeçalho */}
              <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        unlocked ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {card.number}
                    </span>
                    <span
                      className={`text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        unlocked
                          ? `${style.badgeBg} ${style.badgeText}`
                          : 'bg-white/10 text-[#D1D5DB]'
                      }`}
                    >
                      {unlocked ? style.label : 'Bloqueada'}
                    </span>
                  </div>
                  <h3
                    className={`font-display font-bold truncate leading-tight mt-0.5 ${
                      isInspector ? 'text-[17px]' : 'text-[14px]'
                    } ${unlocked ? 'text-[#111827]' : 'text-white/90'}`}
                  >
                    {unlocked ? card.name : 'Carta Misteriosa'}
                  </h3>
                </div>

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    unlocked
                      ? `${style.badgeBg} ${style.badgeText}`
                      : 'bg-white/10 text-[#9CA3AF]'
                  }`}
                >
                  {unlocked ? (
                    card.rarity === 'lendaria' ? (
                      <Crown className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>

              {/* Moldura da Ilustração */}
              <div className="px-2.5">
                <div
                  className={`relative w-full overflow-hidden rounded-xl border ${
                    isInspector ? 'h-48 sm:h-52' : 'aspect-[4/3]'
                  } ${
                    unlocked
                      ? 'border-[#D1D5DB]/80 bg-[#111827]'
                      : 'border-white/10 bg-[#090D16]'
                  }`}
                >
                  <img
                    src={card.imageUrl}
                    alt={unlocked ? `${card.name} — ${card.artwork.title}` : 'Silhueta bloqueada'}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      unlocked
                        ? 'scale-[1.01]'
                        : 'grayscale brightness-[0.14] contrast-125 opacity-60 blur-[1px]'
                    }`}
                  />

                  {unlocked ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2 py-1.5">
                      <p className="text-[9.5px] text-white/90 truncate font-medium">
                        {card.artwork.artist} · {card.artwork.year}
                      </p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-black/25 via-transparent to-black/65">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center mb-1.5">
                        <Lock className="w-4 h-4 text-[#FBBF24]" />
                      </div>
                      <span className="text-[10.5px] font-semibold text-white/90 leading-snug line-clamp-2">
                        {card.achievement.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Faixa de Referência & Conteúdo */}
              <div className="px-2.5 pt-2 pb-2 flex-1 flex flex-col justify-between gap-1.5">
                {unlocked ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-medium text-[#6B7280] mb-1">
                        <span className="truncate">{card.subtitle}</span>
                        <span className="shrink-0 font-mono text-[9.5px] text-[#9CA3AF]">
                          {CATEGORY_LABELS[card.categoryId] ?? card.categoryId}
                        </span>
                      </div>

                      <p
                        className={`italic text-[#374151] leading-snug ${
                          isInspector ? 'text-[11.5px] line-clamp-3' : 'text-[10.5px] line-clamp-2'
                        }`}
                      >
                        {card.quote}
                      </p>
                    </div>

                    {/* Atributos */}
                    <div className="space-y-1 pt-1 border-t border-[#E5E7EB]/80">
                      {card.attributes.map((attr) => (
                        <div key={attr.label} className="flex items-center gap-2">
                          <span className="text-[9.5px] font-semibold text-[#4B5563] w-20 truncate">
                            {attr.label}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${style.accentBar}`}
                              style={{ width: `${attr.value}%` }}
                            />
                          </div>
                          <span className="text-[9.5px] font-mono font-semibold text-[#111827] w-6 text-right tabular-nums">
                            {attr.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[9.5px] text-[#6B7280]">
                      <span className="truncate">{card.reference}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#4B5563] shrink-0">
                        <RotateCw className="w-2.5 h-2.5" />
                        {isInspector ? 'Virar' : '3D'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-[10.5px] text-[#D1D5DB] leading-snug line-clamp-3">
                      {card.achievement.description}
                    </p>
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] tabular-nums">
                        <span>Progresso</span>
                        <span className="font-semibold text-white">
                          {Math.min(evaluation.current, evaluation.target)}/{evaluation.target} (
                          {evaluation.progressPct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]"
                          style={{ width: `${evaluation.progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===============================================================
              VERSO DA CARTA (DETALHADO COM LORE, OBRA E CONQUISTA)
             =============================================================== */}
          <div className="tcg-face tcg-face-back tcg-back-pattern border-2 border-[#D97706]/60 p-3 flex flex-col justify-between text-white shadow-[0_20px_45px_rgba(17,24,39,0.35)]">
            {unlocked && <div className={`tcg-holo-layer ${style.holoClass}`} />}

            <div className="relative z-10 flex-1 rounded-[14px] border border-[#F59E0B]/30 bg-[#0F131D]/85 p-3 flex flex-col justify-between overflow-y-auto gap-2.5">
              {/* Cabeçalho do Verso */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
                <div className="min-w-0">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#FBBF24]">
                    Crônicas Bíblicas · {card.number}
                  </span>
                  <h4 className="font-display font-bold text-[15px] text-white truncate">
                    {unlocked ? card.name : 'Carta Bloqueada'}
                  </h4>
                  <p className="text-[11px] text-[#9CA3AF] truncate">
                    {unlocked ? card.reference : card.achievement.title}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#D1D5DB] bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                  <RotateCw className="w-2.5 h-2.5" />
                  Frente
                </span>
              </div>

              {/* Lore / História */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#FBBF24]">
                  <BookOpen className="w-3 h-3" />
                  Lore & Narrativa
                </div>
                <p className="text-[11.5px] text-[#E5E7EB] leading-relaxed">
                  {unlocked
                    ? card.lore
                    : 'Conclua a conquista vinculada para revelar a história completa e a obra de arte desta carta.'}
                </p>
              </div>

              {/* Dados da Obra Real */}
              {unlocked && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-2 space-y-0.5">
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    Obra de Arte Real
                  </p>
                  <p className="text-[11px] font-semibold text-white leading-snug">
                    {card.artwork.title}
                  </p>
                  <p className="text-[10.5px] text-[#D1D5DB]">
                    {card.artwork.artist} ({card.artwork.year})
                  </p>
                  <p className="text-[10px] text-[#9CA3AF]">{card.artwork.museum}</p>
                </div>
              )}

              {/* Dados da Conquista */}
              <div className="rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#FBBF24]">
                    <Award className="w-3 h-3" />
                    Conquista
                  </span>
                  <span className="text-[10px] font-medium text-[#FDE68A]">
                    {unlocked ? formatUnlockDate(unlockedAt) : `${evaluation.progressPct}%`}
                  </span>
                </div>
                <p className="text-[11.5px] font-semibold text-white">
                  {card.achievement.title}
                </p>
                <p className="text-[10.5px] text-[#D1D5DB] leading-snug">
                  {card.achievement.description}
                </p>
                {!unlocked && (
                  <p className="text-[10px] text-[#FDE68A]/90 pt-0.5">
                    Dica: {card.achievement.hint}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
