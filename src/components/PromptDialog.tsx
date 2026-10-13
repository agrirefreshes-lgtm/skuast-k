import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

// =====================================================================
// Professional Prompt Dialog System
// Replaces native prompt() (the biggest "AI-generated" tell) with a
// branded, accessible modal that can collect one or more text fields.
//
// Usage:
//   const values = await prompt({
//     title: 'Create a new event',
//     fields: [
//       { key: 'name', label: 'Event name', placeholder: '...', required: true },
//       { key: 'prefix', label: 'Certificate number prefix', defaultValue: '...' },
//     ],
//     confirmText: 'Create event',
//   });
//   if (!values) return;               // user cancelled
//   const name = values.name.trim();
// =====================================================================

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  fields: PromptField[];
  confirmText?: string;
  cancelText?: string;
}

interface PromptContextValue {
  prompt: (options: PromptOptions) => Promise<Record<string, string> | null>;
}

const PromptContext = createContext<PromptContextValue | null>(null);

const emptyValues = (fields: PromptField[]): Record<string, string> =>
  fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.key] = f.defaultValue ?? '';
    return acc;
  }, {});

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [resolver, setResolver] = useState<((v: Record<string, string> | null) => void) | null>(null);

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<Record<string, string> | null>((resolve) => {
        setOptions(opts);
        setValues(emptyValues(opts.fields));
        setResolver(() => resolve);
      }),
    [],
  );

  const settle = useCallback(
    (val: Record<string, string> | null) => {
      setOptions(null);
      if (resolver) resolver(val);
      setResolver(null);
    },
    [resolver],
  );

  const handleConfirm = () => {
    if (!options) return;
    // Validate required fields
    const missing = options.fields.some(
      (f) => f.required && !(values[f.key] || '').trim(),
    );
    if (missing) return;
    settle(values);
  };

  const value = useMemo<PromptContextValue>(() => ({ prompt }), [prompt]);

  return (
    <PromptContext.Provider value={value}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 sku-pop-in">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-base font-bold text-slate-900 leading-snug">{options.title}</h3>
              <button
                onClick={() => settle(null)}
                aria-label="Close"
                className="text-slate-300 hover:text-slate-500 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            {options.message && (
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">{options.message}</p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              className="space-y-3.5"
            >
              {options.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor={`prompt-${f.key}`}>
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                  </label>
                  <input
                    id={`prompt-${f.key}`}
                    type="text"
                    autoFocus={f === options.fields[0]}
                    placeholder={f.placeholder}
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f5132]/30 focus:border-[#0f5132] transition"
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => settle(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  {options.cancelText || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow transition cursor-pointer bg-emerald-700 hover:bg-emerald-800"
                >
                  {options.confirmText || 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
};

export function usePrompt(): PromptContextValue['prompt'] {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error('usePrompt must be used within a PromptProvider');
  return ctx.prompt;
}
