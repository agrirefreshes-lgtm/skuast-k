import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { EventItem, IssuedCertificate, DynamicFieldDef, UploadedBatch } from '../types/certificate';
import { ExcelUploader } from '../components/ExcelUploader';
import { CertificateCanvas } from '../components/CertificateCanvas';
import { AdminLogin } from '../components/AdminLogin';
import { supabase } from '../lib/supabaseClient';
import { 
  FolderPlus, 
  Download, 
  FileSpreadsheet, 
  ImagePlus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Link as LinkIcon, 
  Check, 
  ShieldCheck, 
  LogOut, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck 
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('skuastk_admin_auth') === 'true';
  });

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [activeCertIndex, setActiveCertIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Security Verification Guard
  const verifyAdminIntegrity = useCallback((): boolean => {
    const isAuthed = sessionStorage.getItem('skuastk_admin_auth') === 'true';
    if (!isAuthed) {
      setIsAuthenticated(false);
      alert('Security violation: Unauthorized access attempt detected.');
      return false;
    }
    return true;
  }, []);

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0];

  // 1. Fetch Events from Supabase
  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data: dbEvents, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
    } else if (dbEvents && dbEvents.length > 0) {
      const formatted: EventItem[] = dbEvents.map((e: any) => ({
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
      setSelectedEventId(formatted[0].id);
    } else {
      setEvents([]);
      setSelectedEventId('');
    }
    setLoading(false);
  }, []);

  // 2. Fetch Certificates for Current Event
  const loadCertificates = useCallback(async (eventId: string) => {
    if (!eventId) {
      setCertificates([]);
      return;
    }
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const mapped: IssuedCertificate[] = data.map((c: any) => ({
        certificate_no: c.certificate_no,
        event_id: c.event_id,
        event_name: c.event_name,
        batchId: c.batch_id,
        issue_date: c.issue_date,
        status: c.status,
        data: c.data,
      }));
      setCertificates(mapped);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, loadEvents]);

  useEffect(() => {
    if (selectedEventId) {
      loadCertificates(selectedEventId);
      setActiveCertIndex(0);
    }
  }, [selectedEventId, loadCertificates]);

  if (!isAuthenticated) {
    return <AdminLogin onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('skuastk_admin_auth');
    setIsAuthenticated(false);
  };

  // Helper to generate exact GitHub Pages compatible URL
  const getPublicEventUrl = (event: EventItem) => {
    const baseUrl = window.location.href.split('#')[0].replace(/\/+$/, '');
    return `${baseUrl}/#/event/${event.slug || event.id}`;
  };

  // Create Event in Supabase with Auth Guard
  const handleCreateEvent = async () => {
    if (!verifyAdminIntegrity()) return;

    const name = prompt('Event Name (e.g. 60th ISAE Annual Convention):');
    if (!name || !name.trim()) return;
    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const prefix = prompt('Certificate Number Prefix:', `SKUASTK/${cleanSlug.substring(0, 4).toUpperCase()}/2026/`) || 'SKUASTK/CERT/2026/';

    const newEv: EventItem = {
      id: `event-${Date.now()}`,
      name: name.trim(),
      slug: cleanSlug,
      certPrefix: prefix.trim(),
      templateUrl: 'https://dummyimage.com/1920x1080/0f5132/ffffff&text=Upload+Template',
      batches: [],
      fields: [],
      primaryAuthField: '',
      securityAuthField: '',
      qrConfig: { x: 80, y: 75, size: 75, visible: true },
      certNoConfig: { x: 8, y: 92, fontSize: 13, color: '#222222', isBold: false, visible: true },
    };

    const { error } = await supabase.from('events').insert({
      id: newEv.id,
      name: newEv.name,
      slug: newEv.slug,
      cert_prefix: newEv.certPrefix,
      template_url: newEv.templateUrl,
      fields: newEv.fields,
      batches: newEv.batches,
      primary_auth_field: newEv.primaryAuthField,
      security_auth_field: newEv.securityAuthField,
      qr_config: newEv.qrConfig,
      cert_no_config: newEv.certNoConfig,
    });

    if (error) {
      alert('Event creation failed: ' + error.message);
    } else {
      setEvents([newEv, ...events]);
      setSelectedEventId(newEv.id);
    }
  };

  // Delete Entire Event with Auth Guard
  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    if (!verifyAdminIntegrity()) return;

    const confirmDelete = confirm(`Kya aap sach me "${eventName}" event ko delete karna chahte hain?\nIs event ke saare certificates aur uploaded data permanent delete ho jayenge!`);
    if (!confirmDelete) return;

    // 1. Delete associated certificates from Supabase
    await supabase.from('certificates').delete().eq('event_id', eventId);

    // 2. Delete event record
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
      alert('Event delete failed: ' + error.message);
      return;
    }

    const remaining = events.filter((e) => e.id !== eventId);
    setEvents(remaining);
    if (remaining.length > 0) {
      setSelectedEventId(remaining[0].id);
    } else {
      setSelectedEventId('');
      setCertificates([]);
    }
    alert(`Event "${eventName}" successfully delete ho gaya!`);
  };

  // Upload Template Image with Auth Guard
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyAdminIntegrity()) return;

    const file = e.target.files?.[0];
    if (!file || !currentEvent) return;

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentEvent.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert('Image upload failed: ' + uploadError.message);
      setUploadingImage(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('templates')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    await supabase.from('events').update({ template_url: publicUrl }).eq('id', currentEvent.id);

    const updated = { ...currentEvent, templateUrl: publicUrl };
    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updated : ev)));
    setUploadingImage(false);
  };

  // Sync Layout Changes to Supabase with Auth Guard
  const handleUpdateEvent = async (updated: EventItem) => {
    if (!verifyAdminIntegrity()) return;

    setEvents(events.map((ev) => (ev.id === updated.id ? updated : ev)));
    await supabase.from('events').update({
      fields: updated.fields,
      primary_auth_field: updated.primaryAuthField,
      security_auth_field: updated.securityAuthField,
      qr_config: updated.qrConfig,
      cert_no_config: updated.certNoConfig,
    }).eq('id', updated.id);
  };

  // Upload Excel Batch with Auth Guard
  const handleExcelParsed = async (records: Record<string, string>[], columns: string[], fileName: string) => {
    if (!verifyAdminIntegrity() || !currentEvent) return;

    const batchId = `batch-${Date.now()}`;
    const newBatch: UploadedBatch = {
      batchId,
      fileName,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      count: records.length,
    };

    let updatedFields: DynamicFieldDef[] = [...currentEvent.fields];
    if (updatedFields.length === 0) {
      updatedFields = columns.map((col, idx) => ({
        key: col.toLowerCase().replace(/\s+/g, '_'),
        label: col,
        x: 50,
        y: 40 + idx * 8,
        fontSize: idx === 0 ? 28 : 16,
        color: idx === 0 ? '#0f5132' : '#222222',
        fontFamily: idx === 0 ? 'Georgia, serif' : 'sans-serif',
        isBold: idx === 0,
        align: 'center',
        maxWidth: 750,
        lineHeight: 24,
        visible: true,
      }));
    }

    const startSerial = certificates.length + 1;
    const dbCertsToInsert: any[] = [];
    const localNewCerts: IssuedCertificate[] = [];

    records.forEach((row, idx) => {
      const serialNumber = `${currentEvent.certPrefix}${String(startSerial + idx).padStart(4, '0')}`;
      const certObj: IssuedCertificate = {
        certificate_no: serialNumber,
        event_id: currentEvent.id,
        event_name: currentEvent.name,
        batchId,
        issue_date: new Date().toISOString().split('T')[0],
        status: 'verified',
        data: row,
      };

      localNewCerts.push(certObj);
      dbCertsToInsert.push({
        certificate_no: serialNumber,
        event_id: currentEvent.id,
        event_name: currentEvent.name,
        batch_id: batchId,
        issue_date: certObj.issue_date,
        status: 'verified',
        data: row,
      });
    });

    const pField = currentEvent.primaryAuthField || updatedFields[0]?.label || '';
    const sField = currentEvent.securityAuthField || updatedFields[1]?.label || '';

    const updatedEvent: EventItem = {
      ...currentEvent,
      fields: updatedFields,
      primaryAuthField: pField,
      securityAuthField: sField,
      batches: [...currentEvent.batches, newBatch],
    };

    const { error: certError } = await supabase.from('certificates').insert(dbCertsToInsert);
    if (certError) {
      alert('Certificates upload error: ' + certError.message);
      return;
    }

    await supabase.from('events').update({
      fields: updatedFields,
      primary_auth_field: pField,
      security_auth_field: sField,
      batches: updatedEvent.batches,
    }).eq('id', currentEvent.id);

    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updatedEvent : ev)));
    setCertificates([...certificates, ...localNewCerts]);
    setActiveCertIndex(0);
    alert(`${records.length} Certificates Supabase Cloud me successfully save ho gaye!`);
  };

  // Delete Batch from Database with Auth Guard
  const handleDeleteBatch = async (batchId: string) => {
    if (!verifyAdminIntegrity()) return;
    if (!confirm('Batch delete karein? Supabase se bhi saara data remove ho jayega.')) return;

    await supabase.from('certificates').delete().eq('batch_id', batchId);

    const updatedBatches = currentEvent.batches.filter((b) => b.batchId !== batchId);
    await supabase.from('events').update({ batches: updatedBatches }).eq('id', currentEvent.id);

    const updatedEvent = { ...currentEvent, batches: updatedBatches };
    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updatedEvent : ev)));
    loadCertificates(currentEvent.id);
  };

  const handleExportEventExcel = () => {
    if (!verifyAdminIntegrity()) return;
    if (certificates.length === 0) return alert('Records khali hain!');
    const exportRows = certificates.map((c) => ({
      'Certificate No': c.certificate_no,
      Status: c.status,
      'Issue Date': c.issue_date,
      ...c.data,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Certificates');
    XLSX.writeFile(wb, `${currentEvent.name.replace(/\s+/g, '_')}_Official_List.xlsx`);
  };

  const copyShareLink = () => {
    if (!currentEvent) return;
    const link = getPublicEventUrl(currentEvent);
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCert = certificates[activeCertIndex] || certificates[0];

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 rounded-2xl text-white shadow-lg flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Sher-e-Kashmir University (SKUAST-K)</h1>
            <p className="text-xs text-green-200 mt-1">Cloud Digital Certification Engine • Shalimar Campus</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateEvent} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer">
              <FolderPlus size={16} /> + Create New Event
            </button>
            <button onClick={handleLogout} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer font-semibold">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border text-center text-sm font-medium text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading events from Supabase Cloud...
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border text-center space-y-3">
            <p className="text-gray-600 text-sm">Abhi tak koi event nahi bana hai.</p>
            <button onClick={handleCreateEvent} className="bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl">
              + Pehla Event Banayein
            </button>
          </div>
        ) : (
          <>
            {/* Event Tabs with Delete Button */}
            <div className="flex gap-2 overflow-x-auto pb-1 items-center">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`flex items-center rounded-xl text-xs font-bold transition whitespace-nowrap shadow-sm border ${
                    selectedEventId === ev.id 
                      ? 'bg-slate-900 text-white border-slate-900' 
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => setSelectedEventId(ev.id)}
                    className="px-3.5 py-2 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{ev.name}</span>
                    <span className="text-[10px] opacity-70">({ev.certPrefix})</span>
                  </button>
                  
                  {/* Event Delete Icon */}
                  <button
                    title={`Delete Event ${ev.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(ev.id, ev.name);
                    }}
                    className={`px-2 py-2 hover:text-rose-500 transition cursor-pointer border-l ${
                      selectedEventId === ev.id ? 'border-slate-800 text-slate-400' : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Public Link Card */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <LinkIcon size={14} /> Public Download Link (Universal)
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 mt-1 block select-all">
                  {getPublicEventUrl(currentEvent)}
                </span>
              </div>
              <button
                onClick={copyShareLink}
                style={{ backgroundColor: copied ? '#15803d' : '#0f5132' }}
                className="text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow"
              >
                {copied ? <Check size={14} /> : <LinkIcon size={14} />}
                {copied ? 'Copied to Clipboard!' : 'Copy Share Link'}
              </button>
            </div>

            {/* 2-Factor Configuration */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-amber-500" size={18} />
                <h3 className="text-xs font-bold text-gray-800">2-Factor Security Authentication for Public Download</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Primary Identifier (Name)</label>
                  <select
                    value={currentEvent.primaryAuthField}
                    onChange={(e) => handleUpdateEvent({ ...currentEvent, primaryAuthField: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border bg-slate-50"
                  >
                    {currentEvent.fields.map((f) => (
                      <option key={f.key} value={f.label}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Security Check (Reg No / Mobile)</label>
                  <select
                    value={currentEvent.securityAuthField}
                    onChange={(e) => handleUpdateEvent({ ...currentEvent, securityAuthField: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border bg-slate-50"
                  >
                    {currentEvent.fields.map((f) => (
                      <option key={f.key} value={f.label}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Template & Field Visibility */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <ImagePlus size={16} className="text-emerald-700" /> Template Image (Cloud)
                </h3>
                <label className="border border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-700 bg-gray-50">
                  <span className="text-[11px] text-gray-600 font-medium">
                    {uploadingImage ? 'Uploading to Supabase...' : 'Upload Template (PNG/JPG)'}
                  </span>
                  <input type="file" accept="image/*" disabled={uploadingImage} onChange={handleTemplateUpload} className="hidden" />
                </label>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2 md:col-span-2">
                <h3 className="text-xs font-bold text-gray-800">Print Visibility on Certificate</h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentEvent.fields.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        const updatedFields = currentEvent.fields.map((field) =>
                          field.key === f.key ? { ...field, visible: !field.visible } : field
                        );
                        handleUpdateEvent({ ...currentEvent, fields: updatedFields });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                        f.visible ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-100 border-gray-200 text-gray-400 line-through'
                      }`}
                    >
                      {f.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Upload Batch & Export */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-2">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-700" size={16} /> Upload Candidate Batch (Excel)
                </h3>
                <ExcelUploader onParsed={handleExcelParsed} />
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-800">Uploaded Cloud Batches</h3>
                  <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
                    {currentEvent.batches.map((b) => (
                      <div key={b.batchId} className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg text-xs border border-gray-200">
                        <div>
                          <span className="font-semibold text-slate-800">{b.fileName}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({b.count} records)</span>
                        </div>
                        <button onClick={() => handleDeleteBatch(b.batchId)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleExportEventExcel}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Download size={14} /> Export Master Excel (With Assigned Cert Nos)
                </button>
              </div>
            </div>

            {/* Visual Canvas Preview + Participant Data Scroller */}
            {certificates.length > 0 && activeCert && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Visual Coordinate Designer</h3>
                    <p className="text-[11px] text-gray-500">Coordinate drag karein ya record switch karke template check karein</p>
                  </div>

                  {/* Participant Record Scroller / Navigator */}
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <UserCheck size={15} className="text-emerald-700" />
                    <span className="text-xs font-semibold text-slate-700 font-mono">
                      {activeCert.certificate_no}
                    </span>
                    <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-md border font-medium">
                      {activeCertIndex + 1} of {certificates.length}
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => setActiveCertIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeCertIndex === 0}
                        className="p-1 rounded bg-white hover:bg-slate-200 disabled:opacity-30 cursor-pointer text-slate-700 transition"
                        title="Previous Candidate"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setActiveCertIndex((prev) => Math.min(certificates.length - 1, prev + 1))}
                        disabled={activeCertIndex === certificates.length - 1}
                        className="p-1 rounded bg-white hover:bg-slate-200 disabled:opacity-30 cursor-pointer text-slate-700 transition"
                        title="Next Candidate"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <CertificateCanvas
                  event={currentEvent}
                  cert={activeCert}
                  onUpdateEvent={handleUpdateEvent}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};