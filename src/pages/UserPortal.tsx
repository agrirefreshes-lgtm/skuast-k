import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, Loader2, ArrowRight, Award } from 'lucide-react';

export const UserPortal: React.FC = () => {
  const [certNo, setCertNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certNo.trim()) return;

    setLoading(true);
    setErrorMsg('');

    const query = certNo.trim();
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .ilike('certificate_no', query)
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setErrorMsg('No certificate record found with this Certificate Number. Please verify and try again.');
    } else {
      navigate(`/verify?id=${encodeURIComponent(data.certificate_no)}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 text-center space-y-5">
        
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-800 border border-emerald-100">
          <Award size={36} />
        </div>

        <div>
          <h2 className="text-xl font-black text-gray-900 font-serif">Certificate Registry Search</h2>
          <p className="text-xs text-gray-500 mt-1">Enter your assigned SKUAST-K Certificate Number to view or verify</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. SKUASTK/ISAE/2026/0001"
              value={certNo}
              onChange={(e) => setCertNo(e.target.value)}
              className="w-full text-xs px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#0f5132] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <span>Search & View Certificate</span>
            <ArrowRight size={14} />
          </button>
        </form>

      </div>
    </div>
  );
};