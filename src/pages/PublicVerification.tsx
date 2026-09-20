import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { IssuedCertificate } from '../types/certificate';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { 
  XCircle, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft, 
  Search, 
  Camera, 
  Keyboard, 
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

// Privacy Protection: Fields that should NEVER be exposed publicly on QR scan
const SENSITIVE_FIELD_KEYS = [
  'mobile',
  'phone',
  'contact',
  'cell',
  'email',
  'reg',
  'registration',
  'roll',
  'aadhaar',
  'security',
  'password',
  'pin'
];

// HashRouter me ?id= hash ke ANDAR hota hai (#/verify?id=...),
// isliye useSearchParams akela kaam nahi karta — hash fallback zaroori hai.
const getVerifyIdFromLocation = (): string => {
  const fromSearch = new URLSearchParams(window.location.search).get('id');
  if (fromSearch) return fromSearch;
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex >= 0) {
    return new URLSearchParams(hash.slice(qIndex + 1)).get('id') || '';
  }
  return '';
};

// QR scan / copy-paste se aaye text me se saaf cert-no nikalta hai:
// poora QR URL, id=... fragment, %20 encoding, extra spaces — sab handle.
const extractCertId = (raw: string): string => {
  let s = (raw || '').trim();
  if (!s) return '';
  if (s.includes('id=')) {
    s = s.split('id=')[1].split('&')[0].split('#')[0];
  }
  try {
    s = decodeURIComponent(s);
  } catch {
    /* raw rakho */
  }
  return s.trim().replace(/\s+/g, ' ');
};

export const PublicVerification: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const routerId = searchParams.get('id') || '';
  const [hashId, setHashId] = useState<string>(() => getVerifyIdFromLocation());
  const certIdFromUrl = routerId || hashId;

  const [inputCertNo, setInputCertNo] = useState(certIdFromUrl);
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [loading, setLoading] = useState(false);
  const [cert, setCert] = useState<IssuedCertificate | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  const executeVerification = async (targetId: string) => {
    const cleanTarget = extractCertId(targetId);
    if (!cleanTarget) return;
    setInputCertNo(cleanTarget);
    setLoading(true);
    setHasSearched(true);
    setCert(null);
    setErrorMsg('');

    // 1) Exact match (PK column) — limit(2): maybeSingle nahi, taaki
    //    duplicate-row par PGRST116 crash ki jagah pehli row le lein.
    // 2) Nahi mila to case-insensitive exact (ilike, wildcard-escaped).
    // 3) Uske baad row ke data JSONB ke andar 'Certificate No' column fallback
    //    (naye uploads me cert-no row-data me bhi store hota hai).
    const escaped = cleanTarget.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    let certData: any = null;
    let lastErr: any = null;

    const exactRes = await supabase
      .from('certificates')
      .select('*')
      .eq('certificate_no', cleanTarget)
      .limit(2);
    if (!exactRes.error && exactRes.data && exactRes.data.length > 0) {
      certData = exactRes.data[0];
    } else {
      if (exactRes.error) lastErr = exactRes.error;
      const ciRes = await supabase
        .from('certificates')
        .select('*')
        .ilike('certificate_no', escaped)
        .limit(2);
      if (!ciRes.error && ciRes.data && ciRes.data.length > 0) {
        certData = ciRes.data[0];
      } else {
        if (ciRes.error) lastErr = ciRes.error;
        // JSONB fallback: data->>'Certificate No' exact
        const jsonRes = await supabase
          .from('certificates')
          .select('*')
          .eq('data->>Certificate No', cleanTarget)
          .limit(2);
        if (!jsonRes.error && jsonRes.data && jsonRes.data.length > 0) {
          certData = jsonRes.data[0];
        } else if (jsonRes.error) {
          lastErr = jsonRes.error;
        }
      }
    }

    if (!certData && lastErr) {
      const code = lastErr?.code ? `[${lastErr.code}] ` : '';
      setErrorMsg(`${code}${lastErr?.message || String(lastErr)}`);
    }

    if (certData) {
      setCert({
        certificate_no: certData.certificate_no,
        event_id: certData.event_id,
        event_name: certData.event_name,
        issue_date: certData.issue_date,
        status: certData.status,
        data: certData.data || {},
      });
    }
    setLoading(false);
  };

  const executeVerificationRef = useRef(executeVerification);
  executeVerificationRef.current = executeVerification;

  const verifyFromUrl = certIdFromUrl;

  useEffect(() => {
    if (verifyFromUrl) {
      const clean = extractCertId(verifyFromUrl);
      setInputCertNo(clean);
      executeVerificationRef.current(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyFromUrl]);

  // Hash change (QR link khulne / back-nav) par bhi id pakdo.
  useEffect(() => {
    const onHashChange = () => setHashId(getVerifyIdFromLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Camera QR Scanner Lifecycle
  useEffect(() => {
    if (scanMode !== 'camera') return;

    setCameraError('');
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;
    let stopped = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
      if (stopped) return;
      if (result) {
        const scannedId = extractCertId(result.getText());
        if (scannedId) {
          stopped = true;
          setInputCertNo(scannedId);
          setSearchParams({ id: scannedId });
          setHashId(scannedId);
          setScanMode('manual');
          executeVerificationRef.current(scannedId);
        }
      }
      if (err && (err as any)?.name !== 'NotFoundException') {
        console.debug(err);
      }
    }).catch((e) => {
      if (!stopped) {
        setCameraError('Camera access denied or unavailable. Please use manual entry.');
        console.error(e);
      }
    });

    return () => {
      stopped = true;
      try {
        const anyReader = codeReaderRef.current as any;
        if (anyReader?.reset) anyReader.reset();
        if (anyReader?.stopContinuousDecode) anyReader.stopContinuousDecode();
      } catch {
        // ignore cleanup errors
      }
      const stream = videoRef.current?.srcObject as MediaStream | null | undefined;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      codeReaderRef.current = null;
    };
  }, [scanMode, setSearchParams]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCertNo.trim()) return;
    setSearchParams({ id: inputCertNo.trim() });
    executeVerification(inputCertNo.trim());
  };

  // Filter out any sensitive numbers/credentials for public view
  const publicDisplayEntries = Object.entries(cert?.data || {}).filter(([key]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !SENSITIVE_FIELD_KEYS.some(sensitive => normalizedKey.includes(sensitive));
  });

  return (
    <div className="min-h-[calc(100vh-140px)] py-8 px-4 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 space-y-6">
        
        {/* Top Header */}
        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
            <ShieldCheck size={13} /> Official Credential Verification
          </span>
          <h2 className="text-xl font-bold text-gray-900 font-serif pt-2">Validate SKUAST-K Certificate</h2>
          <p className="text-xs text-gray-500">Scan physical/digital QR code or enter certificate number directly</p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-gray-200">
          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'manual' ? 'bg-white text-slate-900 shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Keyboard size={14} /> Type Certificate No
          </button>
          <button
            type="button"
            onClick={() => setScanMode('camera')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'camera' ? 'bg-white text-slate-900 shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Camera size={14} /> Open Camera Scanner
          </button>
        </div>

        {/* Tab 1: Camera Scanner View */}
        {scanMode === 'camera' && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-dashed border-emerald-600">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-amber-400 rounded-2xl animate-pulse"></div>
              </div>
            </div>
            {cameraError ? (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border text-center">{cameraError}</p>
            ) : (
              <p className="text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
                <RefreshCw size={12} className="animate-spin text-emerald-700" /> Point camera directly at certificate QR code
              </p>
            )}
          </div>
        )}

        {/* Tab 2: Manual Form View */}
        {scanMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. SKUASTK/ISAE/2026/0001"
              value={inputCertNo}
              onChange={(e) => setInputCertNo(e.target.value)}
              className="flex-1 text-xs px-4 py-3 rounded-xl border border-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-[#0f5132] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              <span>Verify</span>
            </button>
          </form>
        )}

        {/* Verification Results Panel */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-800" size={28} />
            <p className="text-xs text-gray-500">Checking central tamper-proof records...</p>
          </div>
        ) : cert ? (
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
              <CheckCircle2 size={36} className="text-emerald-700 shrink-0" />
              <div>
                <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  ✓ Verified Authentic
                </span>
                <h3 className="text-sm font-bold text-emerald-950 mt-1">Official University Credential</h3>
                <p className="text-[11px] text-emerald-800 font-medium">Record validated on SKUAST-K Cloud</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-gray-500">Certificate No:</span>
                <span className="font-mono font-bold text-gray-900">{cert.certificate_no}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-gray-500">Event Name:</span>
                <span className="font-bold text-emerald-900 text-right">{cert.event_name}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-gray-500">Issue Date:</span>
                <span className="text-gray-800 font-medium">{cert.issue_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Validation Status:</span>
                <span className="font-bold text-emerald-700 uppercase">{cert.status}</span>
              </div>
            </div>

            {publicDisplayEntries.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm text-xs space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide border-b pb-1">
                  Verified Academic Credentials
                </p>
                {publicDisplayEntries.map(([k, val]) => (
                  <div key={k} className="flex justify-between py-0.5">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="font-bold text-gray-800 text-right">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : hasSearched ? (
          <div className="text-center py-6 space-y-2 border-t">
            <XCircle size={36} className="text-rose-600 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900">Data Not Matched</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              No official record found for certificate "{inputCertNo}". Please verify and re-scan.
            </p>
            {errorMsg && (
              <p className="text-[11px] text-rose-500 font-mono mt-1">DB: {errorMsg}</p>
            )}
          </div>
        ) : null}

        <div className="text-center pt-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-800 font-semibold transition">
            <ArrowLeft size={13} /> Return to Event Directory & Portal
          </Link>
        </div>

      </div>
    </div>
  );
};