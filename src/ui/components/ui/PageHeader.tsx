import React from 'react';

interface PageHeaderProps {
  badge: string;
  badgeDotClassName?: string;
  useOrbBadge?: boolean;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  badgeDotClassName = 'bg-[#38BDF8]',
  useOrbBadge = false,
  title,
  subtitle,
  actions,
}) => {
  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/95 border border-[#EAE9E4] shadow-[0_1px_4px_rgba(17,24,39,0.03)] mb-2.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              useOrbBadge ? 'iridescent-orb' : badgeDotClassName
            }`}
          />
          <span className="text-[11.5px] font-medium text-[#4B5563]">
            {badge}
          </span>
        </div>

        <h2 className="font-display text-2xl md:text-[30px] font-bold tracking-tight text-[#111827] leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13.5px] text-[#6B7280] mt-1">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};

