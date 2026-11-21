import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-[26px] bg-white border border-[#EAE9E4] p-6 shadow-[0_20px_50px_rgba(17,24,39,0.12)]">
        <h3 className="font-display text-lg font-bold text-[#111827]">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#4B5563] bg-[#F3F4F6] hover:bg-[#E5E7EB] transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition cursor-pointer shadow-sm ${
              danger
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#111827] hover:bg-[#1F2937]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
