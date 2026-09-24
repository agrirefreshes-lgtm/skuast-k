import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { EventItem, IssuedCertificate } from '../types/certificate';
import { CertificateCanvas } from '../components/CertificateCanvas';
import { getFieldDisplayLabel, getFieldReference, resolveFieldReferenceValue } from '../lib/certificateFields';

import { supabase } from '../lib/supabaseClient';
import { ShieldAlert, Download, Building2, CheckCircle2, Lock, Loader2 } from 'lucide-react';

export const PublicEventDownload: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [primaryInput, setPrimaryInput] = useState('');
  const [securityInput, setSecurityInput] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchedCert, setMatchedCert] = useState<IssuedCertificate | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventSlug) return;
      setLoadingEvent(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`slug.eq.${eventSlug},id.eq.${eventSlug}`)
        .single();

      if (!error && data) {
        setEvent({
          id: data.id,
          name: data.name,
          slug: data.slug,
          certPrefix: data.cert_prefix,
          templateUrl: data.template_url,
          fields: data.fields || [],
          batches: data.batches || [],
          primaryAuthField: data.primary_auth_field || '',
          securityAuthField: data.security_auth_field || '',
          qrConfig: data.qr_config || { x: 80, y: 75, size: 75, visible: true },
          certNoConfig: data.cert_no_config || { x: 8, y: 92, fontSize: 13, color: '#222222', isBold: false, visible: true },
          isDownloadEnabled: data.is_download_enabled ?? true,
          isPublished: data.is_published ?? false,
          publishedAt: data.published_at || undefined,
          created_at: data.created_at
        });
      }
      setLoadingEvent(false);
    };

    fetchEvent();
  }, [eventSlug]);

  const handleSearchAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    if (!event.isPublished || event.isDownloadEnabled === false) {
      setSearching(false);
      setSearched(true);
      setMatchedCert(null);
      return;
    }

    setSearching(true);
    setSearched(true);

    const norm = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const { data: certsList, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('event_id', event.id)
      .eq('status', 'verified');

    if (!error && certsList) {
      const pKey = event.primaryAuthField || getFieldReference(event.fields[0]);
      const sKey = event.securityAuthField || getFieldReference(event.fields[1]);

      const found = certsList.find((c: any) => {
        const pVal = resolveFieldReferenceValue(c.data || {}, event.fields, pKey);
        const sVal = resolveFieldReferenceValue(c.data || {}, event.fields, sKey);
        const match1 = norm(pVal) === norm(primaryInput) || norm(c.certificate_no) === norm(primaryInput);
        const match2 = norm(sVal) === norm(securityInput);
        return match1 && match2;
      });

      if (found) {
        setMatchedCert({
          certificate_no: found.certificate_no,
          event_id: found.event_id,
          event_name: found.event_name,
          batchId: found.batch_id,
          issue_date: found.issue_date,
          status: found.status,
          data: found.data,
        });
      } else {
        setMatchedCert(null);
      }
    } else {
      setMatchedCert(null);
    }
    setSearching(false);
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-center">
        <Loader2 className="animate-spin text-emerald-800 mb-2" size={32} />
        <p className="text-xs text-gray-600 font-medium">Connecting to SKUAST-K Cloud...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200 max-w-md">
          <ShieldAlert className="text-amber-500 mx-auto mb-3" size={44} />
          <h2 className="text-lg font-bold text-gray-800">Event Not Found or Link Expired</h2>
          <p className="text-xs text-gray-500 mt-2">
            URL check karein ya apne SKUAST-K Event Coordinator se sampark karein.
          </p>
        </div>
      </div>
    );
  }

  const primaryReference = event.primaryAuthField || getFieldReference(event.fields[0]);
  const securityReference = event.securityAuthField || getFieldReference(event.fields[1]);
  const primaryLabel = getFieldDisplayLabel(event.fields, primaryReference) || 'Candidate Name';
  const securityLabel = getFieldDisplayLabel(event.fields, securityReference) || 'Security Verification';
  const isActive = event.isDownloadEnabled !== false && event.isPublished !== false;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header style={{ backgroundColor: '#0f5132' }} className="p-4 md:p-6 text-white shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Building2 className="text-amber-400" size={32} />
          <div>
            <h1 className="text-sm md:text-base font-bold">Sher-e-Kashmir University (SKUAST-K)</h1>
            <p className="text-xs text-emerald-200">{event.name} • Official Certificate Portal</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-gray-200 space-y-6">
          <div className="text-center space-y-1.5">
            <span className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block">
              Participant Self-Service Portal
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-800">Download Your Verified Certificate</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Certificate nikalne ke liye dono security fields enter karein.
            </p>
            {!isActive && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-md mx-auto">
                Ye event abhi draft/pause mode me hai. Event Coordinator ke Publish karne ke baad hi download hoga.
              </p>
            )}
          </div>

          <form onSubmit={handleSearchAndDownload} className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. {primaryLabel} *</label>
              <input
                type="text"
                required
                placeholder={`Enter exact ${primaryLabel}...`}
                value={primaryInput}
                onChange={(e) => setPrimaryInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Lock size={13} className="text-amber-500" />
                2. {securityLabel} *
              </label>
              <input
                type="text"
                required
                placeholder={`Enter exact ${securityLabel}...`}
                value={securityInput}
                onChange={(e) => setSecurityInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={searching || !isActive}
              style={{ backgroundColor: '#0f5132' }}
              className="w-full py-3 text-white text-xs font-bold rounded-xl shadow hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {searching ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
              {searching ? 'Verifying...' : 'Authenticate & Access Certificate'}
            </button>
          </form>

          {searched && (
            <div className="pt-4 border-t border-gray-100">
              {matchedCert ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="text-emerald-700" size={24} />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">Certificate Identity Authenticated!</p>
                        <p className="text-[11px] text-emerald-700 font-mono">ID: {matchedCert.certificate_no}</p>
                      </div>
                    </div>
                  </div>

                  <CertificateCanvas
                    event={event}
                    cert={matchedCert}
                    readOnly={true}
                  />
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center space-y-2">
                  <ShieldAlert className="text-rose-500 mx-auto" size={36} />
                  <h4 className="text-sm font-bold text-rose-800">Certificate Not Found</h4>
                  <p className="text-xs text-rose-600 max-w-sm mx-auto leading-relaxed">
                    Aapke daale gaye details se koi certificate match nahi hua. Kripya details check karein ya <b>Event Coordinator</b> se contact karein.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-400">
        © 2026 SKUAST-Kashmir Official Digital Certification System
      </footer>
    </div>
  );
};