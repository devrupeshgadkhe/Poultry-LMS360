import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

export type EraseModuleKey =
  | 'sales'
  | 'purchasing'
  | 'finance'
  | 'dailylogs'
  | 'milling'
  | 'vaccinations';

interface EraseDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  formKey: EraseModuleKey;
  farmId: number;
  moduleName: string;
  recordsDescription: string;
  onSuccess: () => void | Promise<void>;
}

export default function EraseDataModal({
  isOpen,
  onClose,
  formKey,
  farmId,
  moduleName,
  recordsDescription,
  onSuccess,
}: EraseDataModalProps) {
  const [isErasing, setIsErasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsErasing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isErasing) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isErasing, onClose]);

  if (!isOpen) return null;

  const handleConfirmErase = async () => {
    if (isErasing) return;
    setIsErasing(true);
    setError(null);
    try {
      const res = await fetch('/api/developer/form-hard-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formKey, farmId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.dispatchEvent(new Event('farm-data-updated'));
        await onSuccess();
        onClose();
        if (typeof (window as any).showToast === 'function') {
          (window as any).showToast(`All ${moduleName} records have been erased.`);
        }
      } else {
        setError(data.error || `Failed to erase ${moduleName} data.`);
      }
    } catch (err: any) {
      setError(err?.message || `Network error while erasing ${moduleName} data.`);
    } finally {
      setIsErasing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erase-data-modal-title"
      onClick={() => {
        if (!isErasing) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 id="erase-data-modal-title" className="text-base font-bold text-slate-900">
                Erase All {moduleName} Data
              </h3>
              <p className="text-xs text-slate-500">Permanent data deletion confirmation</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isErasing}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          Are you sure you want to permanently erase all data from{' '}
          <span className="font-semibold text-slate-900">{moduleName}</span>?
        </p>

        <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-xs text-rose-800 leading-relaxed">
          <strong className="font-semibold block mb-1">Warning: This cannot be undone.</strong>
          All {recordsDescription} for this farm will be permanently deleted and module totals will
          be reset to zero. Other modules will remain untouched.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isErasing}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isErasing}
            onClick={handleConfirmErase}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isErasing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Erasing Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Erase All Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
