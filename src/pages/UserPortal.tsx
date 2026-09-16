import React, { useState } from 'react';
import { Search, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import type { IssuedCertificate } from '../types/certificate';
import { Link } from 'react-router-dom';

export const UserPortal: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [certResult, setCertResult] = useState<IssuedCertificate | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearched(true);
    const stored = localStorage.getItem('skuastk_certificates');
    if (stored) {
      const list: IssuedCertificate[] = JSON.parse(stored);
      const q = searchQuery.trim().toLowerCase();
      const found = list.find((c) =>
        c.certificate_no.toLowerCase() === q ||
        Object.values(c.data).some((val) => String(val).toLowerCase().includes(q))
      );
      setCertResult(found || null);
    } else {
      setCertResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header style={{ backgroundColor: '#0f5132' }} className="text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Building2 className="text-amber-400" size={32} />
            <div>
              <h1 className="text-base md:text-lg font-bold leading-tight">Sher-e-Kashmir University (SKUAST-K)</h1>
              <p className="text-xs text-green-200">Official Certificate Verification & Registry</p>
            </div>
          </div>
          <Link
            to="/admin"
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition"
          >
            Admin Portal
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-800">Verify SKUAST-K Certificate</h2>
          <p className="text-xs text-slate-600">
            Enter Certificate Number (e.g. SKUASTK/ISAE/2026/0001) or Candidate Name
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Enter Certificate No or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-sm bg-white shadow-sm"
            />
          </div>
          <button
            type="submit"
            style={{ backgroundColor: '#0f5132' }}
            className="px-6 py-2.5 text-white font-semibold text-sm rounded-xl hover:opacity-90 shadow-sm cursor-pointer transition"
          >
            Verify
          </button>
        </form>

        {searched && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            {certResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-600" size={24} />
                    <h3 className="font-bold text-slate-800 text-base">{certResult.event_name}</h3>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    VERIFIED
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-gray-500">Certificate No:</span>
                    <span className="font-mono font-bold text-slate-900">{certResult.certificate_no}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-gray-500">Issue Date:</span>
                    <span className="text-slate-800">{certResult.issue_date}</span>
                  </div>

                  {Object.entries(certResult.data).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-1.5 gap-2">
                      <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-slate-900 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <AlertTriangle className="text-amber-500 mx-auto" size={32} />
                <h4 className="font-bold text-slate-800 text-sm">No Record Found</h4>
                <p className="text-xs text-slate-500">Is number se koi bhi registered certificate record nahi mila.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};