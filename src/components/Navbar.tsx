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
      <header className="sticky top-0 z-50 bg-[#0f5132] text-white shadow-md border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[4.25rem] py-2.5 sm:py-3 gap-2">
            
            {/* Left: University Brand & Logo */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3.5 group min-w-0 flex-1">
              {!imgError ? (
                <img 
                  src="./logo.png" 
                  alt="SKUAST-K Logo" 
                  onError={() => setImgError(true)}
                  className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 shrink-0 object-contain rounded-full bg-white p-0.5 sm:p-1 shadow-md group-hover:scale-105 transition"
                />
              ) : (
                <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-13 md:w-13 shrink-0 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md">
                  <Building2 size={22} className="sm:w-7 sm:h-7" />
                </div>
              )}
              
              <div className="min-w-0 leading-tight">
                <h1 className="text-xs sm:text-sm md:text-base font-black tracking-tight uppercase text-white font-serif truncate">
                  Sher-e-Kashmir University
                </h1>
                <p className="text-[10px] sm:text-[11px] md:text-xs text-emerald-200 font-medium truncate">
                  <span className="hidden sm:inline">of Agricultural Sciences and Technology of Kashmir</span>
                  <span className="sm:hidden">SKUAST - Kashmir</span>
                </p>
                <span className="hidden md:block text-[10px] text-amber-300 font-semibold uppercase tracking-wider mt-0.5 truncate">
                  Shalimar, Srinagar (J&K) • Central Certificate Engine
                </span>
              </div>
            </Link>

            {/* Right: Quick Navigation & Help */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              
              {/* How to Use Trigger */}
              <button
                onClick={() => setShowGuide(true)}
                aria-label="How to use guide"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-900/70 hover:bg-emerald-900 border border-emerald-700 text-[11px] sm:text-xs font-semibold text-emerald-100 transition cursor-pointer"
              >
                <HelpCircle size={14} className="text-amber-400" />
                <span className="hidden md:inline">Guide</span>
              </button>

              {/* View / Role Toggles */}
              <div className="flex items-center bg-emerald-950/80 p-0.5 sm:p-1 rounded-xl border border-emerald-800 text-[11px] sm:text-xs">
                <Link
                  to="/"
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    isActive('/') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Participant Portal"
                >
                  <Search size={13} />
                  <span className="hidden sm:inline">Portal</span>
                </Link>

                <Link
                  to="/verify"
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    isActive('/verify') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Verify Certificate"
                >
                  <ShieldCheck size={13} />
                  <span className="hidden sm:inline">Verify</span>
                </Link>

                <Link
                  to="/admin"
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    isActive('/admin') 
                      ? 'bg-amber-400 text-slate-950 shadow' 
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Admin Console"
                >
                  <Sliders size={13} />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* How To Use Modal Dialog */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-gray-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-4 border-b pb-3 pr-8">
              <FileCheck size={26} className="text-emerald-700 shrink-0" />
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">How To Use the SKUAST-K Certificate System</h2>
                <p className="text-[11px] text-gray-500">Guide for Participants and Event Coordinators</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-700 max-h-[65vh] overflow-y-auto pr-1">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                <h3 className="font-bold text-emerald-900 text-xs sm:text-sm mb-1">🎓 For Candidates / Participants</h3>
                <ol className="list-decimal pl-4 space-y-1 leading-relaxed text-emerald-800 font-medium">
                  <li>Portal par jaakar apna Event select karein ya direct shared event link kholein.</li>
                  <li>Apna <b>Name</b> aur <b>Security Check</b> (Mobile/Reg No) enter karein.</li>
                  <li>Live certificate screen par aate hi <b>Download Official PDF</b> dabayein.</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                <h3 className="font-bold text-amber-950 text-xs sm:text-sm mb-1">🛡️ For QR Verification</h3>
                <p className="text-amber-900 leading-relaxed font-medium">
                  Certificate par bane QR code ko mobile camera ya Verify tab ke camera scanner se scan karke authenticity check kar sakte hain.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm mb-1">⚙️ For Admins</h3>
                <ol className="list-decimal pl-4 space-y-1 leading-relaxed text-slate-700 font-medium">
                  <li>Admin tab me login karein.</li>
                  <li>New Event create karke blank template aur Excel sheet upload karein.</li>
                  <li>Inspector toolbar se fonts aur positioning adjust karke link share karein.</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t text-right">
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