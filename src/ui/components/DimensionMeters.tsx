import React from 'react';

interface DimensionMetersProps {
  completion: number;
  performance: number | null;
  mastery: number;
  compact?: boolean;
}

/**
 * Exibe separadamente as três dimensões fundamentais da aprendizagem:
 * - Conclusão (avanço estruturado na trilha)
 * - Desempenho (acerto objetivo em questões)
 * - Domínio real (consolidação integrada)
 */
export const DimensionMeters: React.FC<DimensionMetersProps> = ({
  completion,
  performance,
  mastery,
  compact = false,
}) => {
  const items = [
    {
      label: 'Conclusão',
      valueText: `${completion}%`,
      percent: completion,
      barColor: 'bg-gradient-to-r from-[#60A5FA] to-[#38BDF8]',
      dotColor: 'bg-[#38BDF8]',
      hint: 'Checklist e etapas da trilha',
    },
    {
      label: 'Desempenho',
      valueText: performance !== null ? `${performance}%` : '—',
      percent: performance ?? 0,
      barColor: 'bg-gradient-to-r from-[#34D399] to-[#10B981]',
      dotColor: 'bg-[#10B981]',
      hint: 'Acertos em questões',
    },
    {
      label: 'Domínio real',
      valueText: `${mastery}%`,
      percent: mastery,
      barColor: 'bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]',
      dotColor: 'bg-[#7C3AED]',
      hint: 'Estudo + questões + revisões + erros',
    },
  ];

  return (
    <div className={compact ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-4'}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl bg-[#FAFAF9] border border-[#EAE9E4] px-4 py-3"
          title={item.hint}
        >
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#6B7280]">
              <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor}`} />
              {item.label}
            </span>
            <span className="font-display text-[15px] font-bold text-[#111827] tabular-nums">
              {item.valueText}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#E5E7EB]/70 overflow-hidden">
            <div
              className={`h-full rounded-full ${item.barColor} transition-all duration-300`}
              style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
            />
          </div>
          {!compact && (
            <p className="mt-1.5 text-[10.5px] text-[#6B7280]">{item.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
};
