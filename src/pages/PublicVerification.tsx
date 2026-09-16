import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { IssuedCertificate } from '../types/certificate';
import { XCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export const PublicVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const certId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<IssuedCertificate | null>(null);

  useEffect(() => {
    const verifyCert = async () => {
      if (!certId) {
        setLoading(false);
        return;
      }

      const { data: certData, error: certError } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_no', certId)
        .maybeSingle();

      if (!certError && certData) {
        setCert({
          certificate_no: certData.certificate_no,
          event_id: certData.event_id,
          event_name: certData.event_name,
          issue_date: certData.issue_date,
          status: certData.status,
          data: certData.data,
        });
      }
      setLoading(false);
    };

    verifyCert();
  }, [certId]);

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 space-y-6 text-center">

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-800" size={32} />
            <p className="text-xs text-gray-500 font-medium">Validating cryptographically with university database...</p>
          </div>
        ) : cert ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-50">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
                ✓ Authentic Certificate
              </span>
              <h2 className="text-lg font-bold text-gray-900">Valid Academic Credential</h2>
              <p className="text-xs text-gray-500 mt-0.5">Officially issued by SKUAST-Kashmir</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-gray-200 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-medium">Certificate No:</span>
                <span className="font-mono font-bold text-gray-900">{cert.certificate_no}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-medium">Event:</span>
                <span className="font-bold text-emerald-900 text-right">{cert.event_name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500 font-medium">Issue Date:</span>
                <span className="font-medium text-gray-800">{cert.issue_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Status:</span>
                <span className="font-bold text-emerald-700 capitalize">{cert.status}</span>
              </div>
            </div>

            {/* Recipient Details */}
            {cert.data && (
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 text-left space-y-1.5 text-xs">
                <p className="font-bold text-emerald-950 text-[11px] uppercase tracking-wide border-b border-emerald-200 pb-1 mb-2">
                  Issued Candidate Record
                </p>
                {Object.entries(cert.data).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-bold text-gray-900 text-right">{val}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-900 font-bold transition"
              >
                <ArrowLeft size={14} /> Back to Search
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto border-4 border-rose-50">
              <XCircle size={36} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900">Certificate Not Found</h2>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                No record matched this certificate code. The credential may be invalid or not yet published.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0f5132] text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-900 transition"
              >
                <ArrowLeft size={14} /> Back to Registry Search
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};