import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// =====================================================================
// Professional Confirmation Dialog System
// Replaces native confirm() with a branded, accessible modal.
// Usage:  const ok = await confirm({ title, message, confirmText, danger });
//         if (!ok) return;
// =====================================================================

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setOptions(opts);
        setResolver(() => resolve);
      }),
    [],
  );

  const settle = useCallback(
    (val: boolean) => {
      setOptions(null);
      if (resolver) resolver(val);
      setResolver(null);
    },
    [resolver],
  );

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  const danger = options?.danger ?? false;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 sku-pop-in">
            <div className="flex items-start gap-3.5">
              <div
                className={`shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center ${
                  danger ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug">{options.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{options.message}</p>
              </div>
              <button
                onClick={() => settle(false)}
                aria-label="Close"
                className="text-slate-300 hover:text-slate-500 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => settle(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => settle(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow transition cursor-pointer ${
                  danger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx.confirm;
}
