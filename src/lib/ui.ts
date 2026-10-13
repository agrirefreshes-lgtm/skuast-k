// =====================================================================
// Shared design tokens — single source of truth for the app's visual
// language. Using these everywhere keeps spacing, radius, color and
// motion perfectly consistent, which is what separates a hand-crafted
// product from a generic AI scaffold.
// =====================================================================

// Brand colors (SKUAST-K institutional green + gold accent)
export const BRAND = {
  green: '#0f5132',
  greenDark: '#0b3d26',
  gold: '#c9a227',
  ink: '#0f172a',
};

// Primary heading font (serif, academic) — defined in index.css imports
export const fontSerif = 'font-serif';

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f5132] text-white text-sm font-semibold shadow-sm shadow-emerald-900/20 ' +
    'hover:bg-[#0b3d26] active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f5132]',
  secondary:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 text-sm font-semibold border border-slate-300 ' +
    'hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold shadow-sm shadow-rose-900/20 ' +
    'hover:bg-rose-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-600 text-sm font-semibold ' +
    'hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer',
  gold:
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a227] text-[#1a1300] text-sm font-bold shadow-sm ' +
    'hover:bg-[#b8901c] active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
};

// ---------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------
export const card =
  'bg-white rounded-3xl border border-slate-200 shadow-sm';
export const cardLg =
  'bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-900/5';
export const inputBase =
  'w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0f5132]/30 focus:border-[#0f5132] transition';
export const labelBase = 'block text-xs font-semibold text-slate-700 mb-1.5';

// Small pill/badge above section titles
export const eyebrow =
  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider';

// ---------------------------------------------------------------------
// Feedback panels (inline, for important state that shouldn't float away)
// ---------------------------------------------------------------------
export const feedback = {
  success:
    'flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900',
  error:
    'flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900',
  warning:
    'flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900',
  info:
    'flex items-start gap-3 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900',
};

// Entrance animation helper for page sections
export const animateIn = 'animate-fade-up';
