import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { EventItem, IssuedCertificate } from '../types/certificate';
import { CertificateCanvas } from '../components/CertificateCanvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Award, 
  Calendar, 
  ChevronRight, 
  FolderCheck, 
  ShieldCheck, 
  Download, 
  Loader2, 
  ArrowLeft, 
  Lock, 
  UserCheck,
  Search
} from 'lucide-react';

interface GroupedEvents {
  [year: string]: {
    [month: string]: EventItem[];
  };
}

export const UserPortal: React.FC = () => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  // 2-Factor Form inputs
  const [primaryVal, setPrimaryVal] = useState('');
  const [securityVal, setSecurityVal] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Authenticated Participant Certificate
  const [matchedCert, setMatchedCert] = useState<IssuedCertificate | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: EventItem[] = data.map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          certPrefix: e.cert_prefix,
          templateUrl: e.template_url,
          fields: e.fields || [],
          batches: e.batches || [],
          primaryAuthField: e.primary_auth_field || '',
          securityAuthField: e.security_auth_field || '',
          qrConfig: e.qr_config || { x: 80, y: 74, size: 75, visible: true },
          certNoConfig: e.cert_no_config || { x: 8, y: 92, fontSize: 13, color: '#222222', isBold: false, visible: true },
        }));
        setEvents(formatted);
      }
      setLoading(false);
    };

    fetchEvents();
  }, []);

  const groupedEvents = useMemo(() => {
    const filtered = events.filter((ev) => 
      ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.certPrefix.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped: GroupedEvents = {};
    filtered.forEach((item) => {
      const year = '2026';
      const month = 'Conferences & Conventions';

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(item);
    });

    return grouped;
  }, [events, searchQuery]);

  const handleSelectEvent = (event: EventItem) => {
    setSelectedEvent(event);
    setMatchedCert(null);
    setPrimaryVal('');
    setSecurityVal('');
    setAuthError('');
  };

  const handle2FactorVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !primaryVal.trim() || !securityVal.trim()) return;

    setAuthenticating(true);
    setAuthError('');

    const pKey = selectedEvent.primaryAuthField;
    const sKey = selectedEvent.securityAuthField;

    const { data: certList, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('event_id', selectedEvent.id);

    setAuthenticating(false);

    if (error || !certList || certList.length === 0) {
      setAuthError('No certificates uploaded yet for this event.');
      return;
    }

    const cleanInput = (s: string) => s.toLowerCase().trim();

    const match = certList.find((c: any) => {
      const data = c.data || {};
      const pMatch = cleanInput(String(data[pKey] || '')) === cleanInput(primaryVal);
      const sMatch = cleanInput(String(data[sKey] || '')) === cleanInput(securityVal);
      return pMatch && sMatch;
    });

    if (match) {
      setMatchedCert({
        certificate_no: match.certificate_no,
        event_id: match.event_id,
        event_name: match.event_name,
        issue_date: match.issue_date,
        status: match.status,
        data: match.data,
      });
    } else {
      setAuthError(`Credentials match nahi hua. Please verify "${pKey}" & "${sKey}".`);
    }
  };

  // Convert external image to Base64 to defeat CORS issues completely
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDownloadPDF = async () => {
    const printArea = document.getElementById('certificate-print-area');
    if (!printArea || !matchedCert || !selectedEvent) {
      alert('Certificate render area not found.');
      return;
    }

    setDownloading(true);
    const originalBg = printArea.style.backgroundImage;

    try {
      // 1. Convert template background to local base64 on-the-fly
      if (selectedEvent.templateUrl) {
        try {
          const base64Bg = await getBase64ImageFromUrl(selectedEvent.templateUrl);
          printArea.style.backgroundImage = `url("${base64Bg}")`;
        } catch (e) {
          console.warn('Direct fetch failed, falling back to html2canvas proxy', e);
        }
      }

      await document.fonts.ready;

      // 2. Render canvas securely
      const canvas = await html2canvas(printArea, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // 3. Reset background back to normal
      printArea.style.backgroundImage = originalBg;

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const fileName = `${matchedCert.certificate_no.replace(/[^a-zA-Z0-9_-]/g, '_')}_Official.pdf`;
      pdf.save(fileName);
    } catch (err: any) {
      printArea.style.backgroundImage = originalBg;
      console.error('Download Error:', err);
      alert('Download failed: ' + (err?.message || 'CORS Security error'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] py-10 px-4 md:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* University Hero Header */}
        <div className="bg-gradient-to-r from-[#0f5132] to-emerald-900 rounded-3xl p-6 md:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-[11px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-3 py-1 rounded-full inline-block shadow-sm">
              Official University Certification Registry
            </span>
            <h1 className="text-2xl md:text-3xl font-black font-serif">
              Download Your Academic & Event Certificate
            </h1>
            <p className="text-xs md:text-sm text-emerald-200 max-w-xl font-medium">
              If you participated in any official SKUAST-Kashmir conference, symposium, workshop, or convention, select your event below to securely download your verified credential.
            </p>
          </div>
          <div className="h-20 w-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
            <Award size={46} />
          </div>
        </div>

        {!selectedEvent ? (
          /* Event Directory */
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FolderCheck className="text-emerald-700" size={20} /> Select University Event
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Explore scheduled conferences and workshops categorized by Year and Month</p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter event name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center items-center gap-2 text-gray-500 text-xs">
                <Loader2 size={20} className="animate-spin text-emerald-700" /> Loading events...
              </div>
            ) : Object.keys(groupedEvents).length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                No events matched your search query.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a)).map((year) => (
                  <div key={year} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                      <Calendar size={16} className="text-amber-500" />
                      <h3 className="text-sm font-black text-gray-800 font-mono">Academic Year {year}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.keys(groupedEvents[year]).map((month) => (
                        <div key={month} className="space-y-2">
                          <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                            {month}
                          </span>
                          <div className="space-y-2">
                            {groupedEvents[year][month].map((ev) => (
                              <button
                                key={ev.id}
                                onClick={() => handleSelectEvent(ev)}
                                className="w-full text-left bg-slate-50 hover:bg-emerald-50/50 p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 transition group flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <h4 className="text-xs font-bold text-gray-900 group-hover:text-emerald-900 transition">
                                    {ev.name}
                                  </h4>
                                  <span className="text-[10px] font-mono text-gray-400 mt-0.5 block">
                                    Prefix: {ev.certPrefix}
                                  </span>
                                </div>
                                <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-700 transition group-hover:translate-x-1" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 2-Factor Authentication Card */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedEvent(null)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Event Directory
            </button>

            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
              <div className="border-b pb-4">
                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-800" />
                  2-Factor Security Authentication
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-1 font-serif">{selectedEvent.name}</h2>
                <p className="text-xs text-gray-500">
                  Please authenticate with the exact credentials registered during participation.
                </p>
              </div>

              {!matchedCert ? (
                <form onSubmit={handle2FactorVerify} className="max-w-md space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {selectedEvent.primaryAuthField || 'Candidate Name'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`Enter your ${selectedEvent.primaryAuthField || 'Name'}`}
                      value={primaryVal}
                      onChange={(e) => setPrimaryVal(e.target.value)}
                      className="w-full text-xs px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {selectedEvent.securityAuthField || 'Registration No / Mobile'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`Enter your ${selectedEvent.securityAuthField || 'Reg No / Mobile'}`}
                      value={securityVal}
                      onChange={(e) => setSecurityVal(e.target.value)}
                      className="w-full text-xs px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-mono"
                    />
                  </div>

                  {authError && (
                    <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                      {authError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authenticating}
                    className="w-full py-3 bg-[#0f5132] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60"
                  >
                    {authenticating ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
                    <span>Verify & Generate Certificate</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserCheck size={28} className="text-emerald-700" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950">
                          Credential Verified: {matchedCert.certificate_no}
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          Live certificate generated from official SKUAST-K ledger.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition disabled:opacity-60"
                    >
                      {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>{downloading ? 'Preparing High-Res PDF...' : 'Download Official PDF'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 p-3 md:p-6 rounded-2xl border border-gray-200">
                    <CertificateCanvas
                      event={selectedEvent}
                      cert={matchedCert}
                      readOnly={true}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};