import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CertificateCanvas } from '../components/CertificateCanvas';
import type { EventItem, IssuedCertificate } from '../types/certificate';
import { 
  ShieldCheck, 
  Search, 
  AlertCircle, 
  Loader2, 
  Building, 
  Lock,
  PauseCircle,
  FileCheck
} from 'lucide-react';

export const UserPortal: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug?: string }>();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);

  // Form Inputs
  const [primaryInput, setPrimaryInput] = useState<string>('');
  const [securityInput, setSecurityInput] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Matched Data
  const [activeCert, setActiveCert] = useState<IssuedCertificate | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);

  // Load events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      const { data, error } = await supabase.from('events').select('*');
      if (!error && data) {
        const formatted: EventItem[] = data.map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          certPrefix: e.cert_prefix,
          templateUrl: e.template_url,
          fields: e.fields || [],
          batches: e.batches || [],
          primaryAuthField: e.primary_auth_field || 'Student Name',
          securityAuthField: e.security_auth_field || 'Student Name',
          qrConfig: e.qr_config || { x: 80, y: 75, size: 75, visible: true },
          certNoConfig: e.cert_no_config || { x: 8, y: 92, fontSize: 13, color: '#222222', isBold: false, visible: true },
          isDownloadEnabled: e.is_download_enabled ?? true
        } as any));

        setEvents(formatted);

        if (eventSlug) {
          const matched = formatted.find(ev => ev.slug === eventSlug || ev.id === eventSlug);
          if (matched) setSelectedEventId(matched.id);
          else if (formatted.length > 0) setSelectedEventId(formatted[0].id);
        } else if (formatted.length > 0) {
          setSelectedEventId(formatted[0].id);
        }
      }
      setLoadingEvents(false);
    };

    fetchEvents();
  }, [eventSlug]);

  const currentEvent = events.find(e => e.id === selectedEventId) || events[0];
  const isDownloadsActive = (currentEvent as any)?.isDownloadEnabled !== false;

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent) return;

    setErrorMsg(null);
    setActiveCert(null);
    setVerifying(true);

    try {
      // 1. Check if downloads are paused by admin
      if (!isDownloadsActive) {
        throw new Error('Certificates download for this event is temporarily paused by department administrator.');
      }

      // 2. Fetch all certificates for this event from Supabase safely
      const { data: certsData, error: certsErr } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', currentEvent.id);

      if (certsErr) throw certsErr;
      if (!certsData || certsData.length === 0) {
        throw new Error('Is event ke liye abhi koi certificates upload nahi kiye gaye hain.');
      }

      // 3. Robust Excel Data Key-Insensitive Matching
      const matchedRow = certsData.find((c: any) => {
        const recordData = c.data || {};
        
        // Normalize keys and user inputs (strip spaces, lowercase)
        const normalize = (str: any) => String(str || '').trim().toLowerCase();
        
        const cleanUserPrimary = normalize(primaryInput);
        const cleanUserSecurity = normalize(securityInput);

        let foundPrimary = false;
        let foundSecurity = false;

        for (const [, val] of Object.entries(recordData)) {
          const valStr = normalize(val);
          if (valStr === cleanUserPrimary) {
            foundPrimary = true;
          }
          if (valStr === cleanUserSecurity) {
            foundSecurity = true;
          }
        }

        // If primary and security are the same field or single field check
        if (currentEvent.primaryAuthField === currentEvent.securityAuthField || !cleanUserSecurity) {
          return foundPrimary;
        }

        return foundPrimary && foundSecurity;
      });

      if (!matchedRow) {
        throw new Error('Aapke daale gaye details se koi certificate match nahi hua. Kripya details check karein.');
      }

      const formattedCert: IssuedCertificate = {
        certificate_no: matchedRow.certificate_no,
        event_id: matchedRow.event_id,
        event_name: matchedRow.event_name,
        batchId: matchedRow.batch_id,
        issue_date: matchedRow.issue_date,
        status: matchedRow.status,
        data: matchedRow.data
      };

      setActiveCert(formattedCert);
      setActiveEvent(currentEvent);
    } catch (err: any) {
      setErrorMsg(err.message || 'Certificate search failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header Ribbon */}
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 rounded-3xl text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building size={20} className="text-amber-400" />
              <h1 className="text-xl font-bold">Sher-e-Kashmir University (SKUAST-K)</h1>
            </div>
            <p className="text-xs text-green-200 mt-1">Official Student & Participant Certification Portal</p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs">
            <ShieldCheck size={16} className="text-amber-400" />
            <span>Tamper-Proof Verification Engine</span>
          </div>
        </div>

        {/* Main Verification Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-1">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black uppercase px-3 py-1 rounded-full">
              Participant Self-Service Portal
            </span>
            <h2 className="text-2xl font-bold text-gray-900 pt-2">Download Your Verified Certificate</h2>
            <p className="text-xs text-gray-500">Apna event select karein aur verification details enter karein</p>
          </div>

          {loadingEvents ? (
            <div className="py-12 text-center text-xs text-gray-500 flex justify-center items-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-800" /> Connecting to University Registry...
            </div>
          ) : (
            <form onSubmit={handleAuthenticate} className="max-w-xl mx-auto space-y-4">
              
              {/* Event Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select University Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setActiveCert(null);
                    setErrorMsg(null);
                  }}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-slate-50 font-medium text-slate-800"
                >
                  {events.map((ev: any) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.certPrefix}) {ev.isDownloadEnabled === false ? '[PAUSED]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Alert if Paused */}
              {!isDownloadsActive && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <PauseCircle size={16} className="text-amber-600 shrink-0" />
                  <span>Is event ke certificates download ko administrator dwara abhi temporary pause kiya gaya hai.</span>
                </div>
              )}

              {/* Primary Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  1. {currentEvent?.primaryAuthField || 'Student Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter your ${currentEvent?.primaryAuthField || 'Student Name'}`}
                  value={primaryInput}
                  onChange={(e) => setPrimaryInput(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {/* Security Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Lock size={12} className="text-amber-500" />
                  2. {currentEvent?.securityAuthField || 'Student Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Confirm your ${currentEvent?.securityAuthField || 'Student Name'}`}
                  value={securityInput}
                  onChange={(e) => setSecurityInput(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={verifying || !isDownloadsActive}
                style={{ backgroundColor: '#0f5132' }}
                className="w-full py-3 text-white text-xs font-bold rounded-xl shadow-lg hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifying ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{verifying ? 'Verifying Identity...' : 'Authenticate & Access Certificate'}</span>
              </button>
            </form>
          )}

          {/* Error Box */}
          {errorMsg && (
            <div className="max-w-xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-rose-700 font-bold text-xs">
                <AlertCircle size={16} /> Certificate Not Found / Access Blocked
              </div>
              <p className="text-[11px] text-rose-600">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Certificate Display & Download Component */}
        {activeCert && activeEvent && (
          <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <FileCheck size={20} className="text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Certificate Identity Authenticated!</h3>
                  <p className="text-xs font-mono text-emerald-800 font-semibold">{activeCert.certificate_no}</p>
                </div>
              </div>
              <span className="text-[11px] bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full font-bold">
                ✓ Verified Candidate Record
              </span>
            </div>

            {/* High-Res Certificate Canvas */}
            <CertificateCanvas
              event={activeEvent}
              cert={activeCert}
              readOnly={true}
            />
          </div>
        )}

      </div>
    </div>
  );
};