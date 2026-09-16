import React, { useState } from 'react';
import { Lock, User, ShieldAlert, Building2 } from 'lucide-react';

interface Props {
  onAuthenticated: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onAuthenticated }) => {
  const [adminName, setAdminName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminName.trim() === 'SKUAST-K' && password === 'Certificates001') {
      sessionStorage.setItem('skuastk_admin_auth', 'true');
      setError(false);
      onAuthenticated();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 text-white text-center">
          <Building2 className="text-amber-400 mx-auto mb-2" size={36} />
          <h2 className="text-base font-bold leading-tight">SKUAST-Kashmir Administration</h2>
          <p className="text-xs text-emerald-200 mt-1">Authorized Access Only • Shalimar Campus</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-700 text-xs font-semibold">
              <ShieldAlert size={16} />
              <span>Invalid Admin Name or Password!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="SKUAST-K"
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50"
              />
            </div>
          </div>

          <button
            type="submit"
            style={{ backgroundColor: '#0f5132' }}
            className="w-full py-2.5 text-white text-xs font-bold rounded-xl shadow hover:opacity-90 transition cursor-pointer mt-2"
          >
            Unlock Admin Console
          </button>
        </form>

        <div className="bg-slate-50 border-t border-gray-100 py-3 text-center text-[10px] text-slate-400">
          Sher-e-Kashmir University Digital Certification Engine
        </div>
      </div>
    </div>
  );
};