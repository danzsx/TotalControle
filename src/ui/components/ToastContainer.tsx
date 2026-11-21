import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../application/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  const toneStyles = {
    info: 'bg-white/95 border-[#EAE9E4] text-[#111827]',
    success: 'bg-[#ECFDF5]/95 border-[#A7F3D0] text-[#065F46]',
    warning: 'bg-[#FEF9EC]/95 border-[#FDE68A] text-[#92400E]',
    error: 'bg-[#FEF2F2]/95 border-[#FECACA] text-[#B91C1C]',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-[0_10px_30px_rgba(17,24,39,0.08)] text-sm font-medium ${toneStyles[t.tone]}`}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="opacity-60 hover:opacity-100 cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
