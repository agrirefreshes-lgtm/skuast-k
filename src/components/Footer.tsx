import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  ExternalLink, 
  ShieldCheck, 
  Sliders, 
  Search, 
  Code2 
} from 'lucide-react';

export const Footer: React.FC = () => {
  const [logoErr, setLogoErr] = useState(false);

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 font-sans mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: University Info & Original Small Logo */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              {!logoErr ? (
                <img 
                  src="./logo.png" 
                  alt="SKUAST-K Logo" 
                  onError={() => setLogoErr(true)}
                  className="h-10 w-10 object-contain rounded-full bg-white p-0.5 shadow border border-emerald-600"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-emerald-700/30 border border-emerald-600 flex items-center justify-center text-emerald-400">
                  <Building2 size={20} />
                </div>
              )}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                  Sher-e-Kashmir University
                </h2>
                <p className="text-xs text-emerald-400">
                  of Agricultural Sciences and Technology of Kashmir
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
              Official Multi-Event Digital Certification, Authentication & Tamper-Proof Verification Infrastructure. Powered by cloud-backed encrypted ledgers for conferences, seminars, and academic workshops.
            </p>

            <div className="pt-2">
              <a
                href="https://skuastkashmir.co.in/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline transition"
              >
                <span>Visit Official SKUAST-Kashmir Website</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Col 2: Fast Navigation */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1.5">
              Quick Navigation
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <Link to="/" className="hover:text-amber-400 transition flex items-center gap-1.5">
                  <Search size={13} /> Participant Download Portal
                </Link>
              </li>
              <li>
                <Link to="/verify" className="hover:text-amber-400 transition flex items-center gap-1.5">
                  <ShieldCheck size={13} /> QR Certificate Verification
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-amber-400 transition flex items-center gap-1.5">
                  <Sliders size={13} /> Coordinator Admin Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Student Developer Credits */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1.5">
              Platform Engineering
            </h3>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                <Code2 size={15} />
                <span>Designed & Managed by</span>
              </div>
              <p className="text-sm font-extrabold text-white">Aditya Jha</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                B.Tech Agricultural Engineering Student
              </p>
              <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 mt-1">
                SKUAST-K Shalimar Campus
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © {new Date().getFullYear()} Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir. All Rights Reserved.
          </p>
          <p className="text-slate-400 flex items-center gap-1">
            Certified Academic Credential Management System
          </p>
        </div>
      </div>
    </footer>
  );
};