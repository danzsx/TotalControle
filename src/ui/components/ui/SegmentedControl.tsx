export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-white/95 border border-[#EAE9E4] shadow-[0_2px_10px_rgba(17,24,39,0.03)]"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
              active
                ? 'bg-[#111827] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]/80'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
