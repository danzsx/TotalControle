import React, { useEffect, useState } from 'react';

export const AnalogClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6;
  const hourDeg = hours * 30;

  return (
    <div
      className={`relative w-14 h-14 rounded-full bg-white/95 border border-[#EAE9E4] shadow-[0_8px_24px_rgba(17,24,39,0.055),inset_0_1px_2px_rgba(255,255,255,0.9)] flex items-center justify-center shrink-0 ${className}`}
      title={now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      aria-label={`Relógio: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Aro interno sutil */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="#FAFAF9"
          stroke="#F3F4F6"
          strokeWidth="1.2"
        />

        {/* Marcadores das 12 horas */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          const isQuarter = i % 3 === 0;
          return (
            <line
              key={i}
              x1="50"
              y1={isQuarter ? '10' : '12'}
              x2="50"
              y2={isQuarter ? '16.5' : '15.5'}
              stroke={isQuarter ? 'rgba(17,24,39,0.42)' : 'rgba(17,24,39,0.16)'}
              strokeWidth={isQuarter ? '2.2' : '1.4'}
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          );
        })}

        {/* Ponteiro das horas */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="29"
          stroke="#111827"
          strokeWidth="3.2"
          strokeLinecap="round"
          transform={`rotate(${hourDeg} 50 50)`}
        />

        {/* Ponteiro dos minutos */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="20"
          stroke="#4B5563"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${minuteDeg} 50 50)`}
        />

        {/* Ponteiro dos segundos */}
        <line
          x1="50"
          y1="57"
          x2="50"
          y2="17"
          stroke="#38BDF8"
          strokeWidth="1.4"
          strokeLinecap="round"
          transform={`rotate(${secondDeg} 50 50)`}
        />

        {/* Centro */}
        <circle cx="50" cy="50" r="3.2" fill="#111827" />
        <circle cx="50" cy="50" r="1.2" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
