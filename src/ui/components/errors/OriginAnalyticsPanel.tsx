import React from 'react';
import { Lightbulb } from 'lucide-react';
import { ORIGINS } from '../../../domain/constants';
import type { ErrorOrigin } from '../../../domain/types';
import { ORIGIN_ACTION_PLANS } from './errorHelpers';

interface OriginStatItem {
  origin: ErrorOrigin;
  count: number;
  percent: number;
}

interface OriginAnalyticsPanelProps {
  originStats: OriginStatItem[];
  totalErrors: number;
  scopeLabel: string;
}

export const OriginAnalyticsPanel: React.FC<OriginAnalyticsPanelProps> = ({
  originStats,
  totalErrors,
  scopeLabel,
}) => {
  const topBottleneck = originStats[0] ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-[26px] surface-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-[#111827]">
              Distribuição por Origem do Erro
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Escopo atual: <span className="font-medium text-[#111827]">{scopeLabel}</span> ({totalErrors}{' '}
              {totalErrors === 1 ? 'registro' : 'registros'})
            </p>
          </div>
        </div>

        {originStats.length === 0 ? (
          <p className="text-sm text-[#6B7280]">
            Registre erros para enxergar onde estão seus maiores gargalos na prova.
          </p>
        ) : (
          <div className="space-y-3.5">
            {originStats.map((item) => {
              const meta = ORIGINS[item.origin];
              return (
                <div key={item.origin} className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <div>
                      <span className="font-semibold text-[#111827]">
                        {meta.label}
                      </span>
                      <span className="text-[#6B7280] ml-2 hidden sm:inline">
                        — {meta.description}
                      </span>
                    </div>
                    <span className="text-[#4B5563] font-medium tabular-nums shrink-0 ml-2">
                      {item.count} ({item.percent}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: meta.hex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {topBottleneck && (
        <section className="rounded-[24px] bg-[#FEF9EC]/80 border border-[#FDE68A] p-5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-[#FDE68A] flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#92400E]">
              Principal gargalo: {ORIGINS[topBottleneck.origin].label} ({topBottleneck.percent}%)
            </p>
            <p className="text-[13px] text-[#78350F] leading-relaxed">
              {ORIGIN_ACTION_PLANS[topBottleneck.origin]}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
