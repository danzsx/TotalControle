import React from 'react';
import { formatClock } from '../../../domain/explain';

interface TimerReadoutProps {
  ms: number;
  className?: string;
}

/**
 * Exibe a contagem do cronômetro na fonte Outfit (mesma do Domínio Geral),
 * com slots fixos por caractere para impedir qualquer tremor horizontal a cada segundo.
 */
export const TimerReadout: React.FC<TimerReadoutProps> = ({
  ms,
  className = '',
}) => {
  const formatted = formatClock(ms);

  return (
    <span
      className={`font-display tabular-nums tracking-[-0.02em] inline-flex items-baseline select-none ${className}`}
      aria-label={formatted}
    >
      {Array.from(formatted).map((char, idx) => {
        const isSeparator = char === ':';
        return (
          <span
            key={idx}
            className={
              isSeparator
                ? 'inline-block w-[0.3em] text-center opacity-55'
                : 'inline-block w-[0.62em] text-center'
            }
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};

