import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  HelpCircle, 
  X, 
  FileCheck, 
  Sliders, 
  Search 
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [showGuide, setShowGuide] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Active path checker for HashRouter
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0f5132] text-white shadow-lg border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Left: University Brand & Logo */}
            <Link to="/" className="flex items-center gap-3.5 group">
              {!imgError ? (
                <img 
                  src="./logo.png" 
                  alt="SKUAST-K Logo" 
                  onError={() => setImgError(true)}
                  className="h-14 w-14 object-contain rounded-full bg-white p-1 shadow-md group-hover:scale-105 transition"
                />
              ) : (
                <div className="h-13 w-13 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md">
                  <Building2 size={28} />
                </div>
              )}
              
              <div className="leading-tight">
                <h1 className="text-sm md:text-base lg:text-lg font-black tracking-tight uppercase text-white font-serif drop-shadow-sm">
                  Sher-e-Kashmir University
                </h1>
                <p className="text-[11px] md:text-xs text-emerald-200 font-medium tracking-wide">
                  of Agricultural Sciences and Technology of Kashmir
                </p>
                <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider block mt-0.5">
                  Shalimar, Srinagar (J&K) • Central Certificate Engine
                </span>
              </div>
            </Link>

            {/* Right: Navigation / Quick Toggles */}
            <div className="flex items-center gap-2 md:gap-3">
              
              {/* How to Use Modal Trigger */}
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700 text-xs font-semibold text-emerald-100 transition cursor-pointer"
              >
                <HelpCircle size={14} className="text-amber-400" />
                <span className="hidden sm:inline">How To Use</span>
              </button>

              {/* View / Role Toggles */}
              <div className="flex items-center bg-emerald-950/70 p-1 rounded-xl border border-emerald-800 text-xs">
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    isActive('/') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  <Search size={13} />
                  <span className="hidden md:inline">Portal</span>
                </Link>

                <Link
                  to="/verify"
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    isActive('/verify') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span className="hidden md:inline">Verify</span>
                </Link>

                <Link
                  to="/admin"
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    isActive('/admin') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  <Sliders size={13} />
                  <span>Admin</span>
                </Link>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* How To Use Modal Dialog */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-gray-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-4 border-b pb-3">
              <FileCheck size={26} className="text-emerald-700" />
              <div>
                <h2 className="text-base font-bold text-gray-900">How To Use the SKUAST-K Certificate System</h2>
                <p className="text-xs text-gray-500">Step-by-step guidance for Participants and Administrators</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-gray-700 max-h-[65vh] overflow-y-auto pr-2">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                <h3 className="font-bold text-emerald-900 text-sm mb-1">🎓 For Candidates / Participants</h3>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-emerald-800 font-medium">
                  <li>Apne event ka specific public link kholein (jaise <code>/#/event/60th-isae</code>) ya Home search use karein.</li>
                  <li>Apna <b>Name</b> aur <b>Security Check</b> (Mobile number ya Reg No) exactly enter karein.</li>
                  <li>Verify hone par live certificate generate hoga; <b>Download PDF</b> button dabakar save karein.</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                <h3 className="font-bold text-amber-950 text-sm mb-1">🛡️ For Public Certificate Verification</h3>
                <p className="text-amber-900 leading-relaxed font-medium">
                  Certificate ke upar diye gaye QR Code ko kisi bhi smartphone camera se scan karein. Yeh instant SKUAST-K verification page par redirect karega aur tamper-proof validation dikhayega.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <h3 className="font-bold text-slate-900 text-sm mb-1">⚙️ For Event Coordinators & Admins</h3>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-slate-700 font-medium">
                  <li><b>Admin</b> tab par click karke secure password se login karein.</li>
                  <li><b>+ Create New Event</b> par click karke conference/workshop banayein.</li>
                  <li>Blank Certificate template image upload karein.</li>
                  <li>Excel batch upload karein (Serial numbers automatically generate honge).</li>
                  <li>Inspector Toolbar se font, size, line clamping aur alignments pixel-perfect adjust karein.</li>
                </ol>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t text-right">
              <button
                onClick={() => setShowGuide(false)}
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow transition cursor-pointer"
              >
                Got it, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};