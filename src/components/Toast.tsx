import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

// =====================================================================
// Professional Toast Notification System
// Replaces native alert() across the entire app with a clean,
// on-brand, auto-dismissing notification stack (top-right).
// =====================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface ToastContextValue {
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLES: Record<ToastType, { wrap: string; bar: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'bg-white border-emerald-200',
    bar: 'bg-emerald-600',
    icon: <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />,
  },
  error: {
    wrap: 'bg-white border-rose-200',
    bar: 'bg-rose-600',
    icon: <AlertCircle size={20} className="text-rose-600 shrink-0" />,
  },
  warning: {
    wrap: 'bg-white border-amber-200',
    bar: 'bg-amber-500',
    icon: <AlertTriangle size={20} className="text-amber-500 shrink-0" />,
  },
  info: {
    wrap: 'bg-white border-sky-200',
    bar: 'bg-sky-600',
    icon: <Info size={20} className="text-sky-600 shrink-0" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const push = useCallback(
    (type: ToastType, title: string, message?: string, duration: number = 4200) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (t, m, d) => push('success', t, m, d),
      error: (t, m, d) => push('error', t, m, d),
      warning: (t, m, d) => push('warning', t, m, d),
      info: (t, m, d) => push('info', t, m, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map((t) => {
          const s = TYPE_STYLES[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto relative flex items-start gap-3 rounded-2xl border shadow-lg shadow-slate-900/10 overflow-hidden pl-4 pr-3 py-3 sku-toast-in ${s.wrap}`}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${s.bar}`} />
              <div className="mt-0.5">{s.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 leading-snug">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-slate-300 hover:text-slate-500 transition p-0.5 rounded-full hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
