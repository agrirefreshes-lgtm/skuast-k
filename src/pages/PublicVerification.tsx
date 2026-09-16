import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { IssuedCertificate } from '../types/certificate';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const PublicVerification: React.FC = () => {
  const [params] = useSearchParams();
  const certId = params.get('id');
  const [cert, setCert] = useState<IssuedCertificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certId) {
      setLoading(false);
      return;
    }

    const stored = localStorage.getItem('skuastk_certificates');
    if (stored) {
      try {
        const list: IssuedCertificate[] = JSON.parse(stored);
        const query = decodeURIComponent(certId).trim().toLowerCase();
        const found = list.find((c) => c.certificate_no.toLowerCase() === query);
        if (found) setCert(found);
      } catch (err) {
        console.error(err);
      }
    }
    setLoading(false);
  }, [certId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-800 mb-3"></div>
        <p className="text-gray-700 text-sm font-medium">Verifying with SKUAST-K Official Registry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 text-white text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <ShieldCheck className="text-amber-400" size={24} />
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200">Official Portal</span>
          </div>
          <h2 className="text-sm font-bold leading-tight">
            Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir
          </h2>
          <p className="text-[11px] text-emerald-200 mt-1">Shalimar Campus, Srinagar, J&K - 190025</p>

          <div className="mt-3 text-xs bg-black/30 border border-white/20 py-1 px-3 rounded-full font-mono font-bold text-white inline-block">
            {certId || 'ID MISSING'}
          </div>
        </div>

        <div className="p-6">
          {cert && cert.status === 'verified' ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="text-emerald-700" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Official Certificate Verified</h3>
                <p className="text-xs text-emerald-700 font-semibold">{cert.event_name}</p>
              </div>

              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-gray-500">Certificate No</span>
                  <span className="font-bold text-gray-900 font-mono">{cert.certificate_no}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-gray-500">Issue Date</span>
                  <span className="font-medium text-gray-800">{cert.issue_date}</span>
                </div>

                {Object.entries(cert.data).map(([key, val]) => (
                  <div key={key} className="flex justify-between border-b pb-1.5 gap-2">
                    <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-gray-800 text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 py-4">
              <AlertTriangle className="text-amber-500 mx-auto" size={40} />
              <h3 className="text-lg font-bold text-gray-800">Record Not Found / Invalid</h3>
              <p className="text-xs text-gray-500">No matching SKUAST-K certificate record found for this number.</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t border-gray-100 py-3 text-center text-[10px] text-gray-400">
          Sher-e-Kashmir University Digital Verification Services
        </div>
      </div>
    </div>
  );
};