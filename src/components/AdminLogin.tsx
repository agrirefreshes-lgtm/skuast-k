import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lock, Mail, ShieldAlert, Building2, Loader2 } from 'lucide-react';

interface Props {
  onAuthenticated: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error) {
        throw new Error(error.message || 'Invalid Credentials');
      }

      if (data?.session) {
        // Safe backend token stored via Supabase Auth client automatically
        sessionStorage.setItem('skuastk_admin_auth', 'true');
        onAuthenticated();
      }
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('Invalid login credentials')
          ? 'Invalid University Email or Password!'
          : err.message || 'Authentication error. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 text-white text-center">
          <Building2 className="text-amber-400 mx-auto mb-2" size={36} />
          <h2 className="text-base font-bold leading-tight">SKUAST-Kashmir Administration</h2>
          <p className="text-xs text-emerald-200 mt-1">Authorized Department Console • Central Cloud</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-700 text-xs font-semibold">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Official University Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skuastkashmir.ac.in"
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Secure Password</label>
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
            disabled={loading}
            style={{ backgroundColor: '#0f5132' }}
            className="w-full py-2.5 text-white text-xs font-bold rounded-xl shadow hover:opacity-90 transition cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
            <span>{loading ? 'Authenticating...' : 'Unlock Admin Console'}</span>
          </button>
        </form>

        <div className="bg-slate-50 border-t border-gray-100 py-3 text-center text-[10px] text-slate-400">
          Sher-e-Kashmir University Digital Certification Engine
        </div>
      </div>
    </div>
  );
};