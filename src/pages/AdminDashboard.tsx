import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { EventItem, IssuedCertificate, UploadedBatch, UploadedColumnDefinition } from '../types/certificate';
import { ExcelUploader } from '../components/ExcelUploader';
import { CertificateCanvas } from '../components/CertificateCanvas';
import { AdminLogin } from '../components/AdminLogin';
import { supabase } from '../lib/supabaseClient';
import { getEventUrl } from '../lib/shareUrl';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { usePrompt } from '../components/PromptDialog';
import {
  getFieldDisplayLabel,
  getFieldReference,
  normalizeFieldReference,
  reconcileDynamicFields
} from '../lib/certificateFields';

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
  UserCheck,
  UserPlus,
  Building,
  Mail,
  KeyRound,
  Users,
  Lock,
  Unlock
} from 'lucide-react';

interface AdminProfile {
  id?: string;
  email: string;
  role: string;
  department: string;
  created_at?: string;
}

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<AdminProfile | null>(null);
  const [adminList, setAdminList] = useState<AdminProfile[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [activeCertIndex, setActiveCertIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // SuperAdmin: Form states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminDept, setNewAdminDept] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();


  const verifyLiveSession = useCallback(async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
      sessionStorage.removeItem('skuastk_admin_auth');
      setIsAuthenticated(false);
      toast.error('Security session expired', 'Please sign in again to continue.');
      return null;
    }
    return session.user.id;
  }, []);

  const loadAdminDirectory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAdminList(data);
    }
    setLoading(false);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data: dbEvents, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && dbEvents && dbEvents.length > 0) {
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
        isDownloadEnabled: e.is_download_enabled ?? true,
        isPublished: e.is_published ?? false,
        publishedAt: e.published_at || undefined,
        created_at: e.created_at
      }));
      setEvents(formatted);
      setSelectedEventId(formatted[0].id);
    } else {
      setEvents([]);
      setSelectedEventId('');
    }
    setLoading(false);
  }, []);

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

  // Load profile + events from a verified session
  const loadProfile = async (session: any) => {
    console.log('loadProfile called, session.user.id:', session.user?.id);
    try {
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('id, email, role, department')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        console.warn('loadProfile: no admin_profiles row found, using defaults. user:', session.user?.email);
      }

      const userEmail = session.user.email?.toLowerCase() || '';
      const isSuper = profile?.role === 'super_admin' || userEmail.includes('superadmin');

      const resolvedProfile: AdminProfile = {
        id: session.user.id,
        email: session.user.email || 'Admin',
        role: isSuper ? 'super_admin' : (profile?.role || 'event_admin'),
        department: isSuper ? 'Central Administration' : (profile?.department || 'Academic Department')
      };

      console.log('loadProfile: resolved profile, role:', resolvedProfile.role);
      setUserProfile(resolvedProfile);

      if (resolvedProfile.role === 'super_admin') {
        await loadAdminDirectory();
      } else {
        await loadEvents();
      }
      console.log('loadProfile: data loaded successfully');
    } catch (err: any) {
      console.error('loadProfile ERROR:', err);
      toast.error('Could not load admin profile', err?.message || 'Please try again.');
    } finally {
      // Always clear loading so the console can render (never leave the UI stuck).
      setLoading(false);
    }
  };

  // On mount: check for existing session (page refresh / back navigation)
  useEffect(() => {
    const checkExistingSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          console.log('checkExistingSession: no active session found');
          sessionStorage.removeItem('skuastk_admin_auth');
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        console.log('checkExistingSession: session found for user:', session.user.email);
        await loadProfile(session);
        
        // Only set isAuthenticated after successful profile load
        setIsAuthenticated(true);
        sessionStorage.setItem('skuastk_admin_auth', 'true');
        console.log('checkExistingSession: auth complete, dashboard ready');
      } catch (err: any) {
        console.error('checkExistingSession ERROR:', err);
        sessionStorage.removeItem('skuastk_admin_auth');
        setIsAuthenticated(false);
        setLoading(false);
        toast.error('Session check failed', (err?.message || String(err)) + ' Please sign in again.');
      }
    };

    checkExistingSession();
  }, []);

  useEffect(() => {
    if (userProfile && userProfile.role !== 'super_admin' && selectedEventId) {
      loadCertificates(selectedEventId);
      setActiveCertIndex(0);
    }
  }, [selectedEventId, loadCertificates, userProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('skuastk_admin_auth');
    setIsAuthenticated(false);
    setUserProfile(null);
    setEvents([]);
    setCertificates([]);
    setAdminList([]);
  };

  const handleLoginSuccess = async (session?: any) => {
    setLoading(true);
    try {
      let sessionToUse = session;

      if (!sessionToUse) {
        const { data: { session: fetchedSession }, error } = await supabase.auth.getSession();
        if (error || !fetchedSession?.user) {
          setLoading(false);
          toast.error('Session verification failed', 'Please try again.');
          return;
        }
        sessionToUse = fetchedSession;
      }

      console.log('handleLoginSuccess: session found, loading profile...');
      
      // Load profile FIRST, then set isAuthenticated
      await loadProfile(sessionToUse);
      
      // Only set isAuthenticated after successful profile load
      setIsAuthenticated(true);
      console.log('handleLoginSuccess: auth complete, dashboard ready for user:', sessionToUse.user?.email);
    } catch (err: any) {
      setLoading(false);
      console.error('LOGIN ERROR:', err);
      toast.error('Sign-in failed', (err?.message || String(err)) + ' Please try again.');
    }
  };

  const saveEventToDb = useCallback(
    (() => {
      let timeoutId: any;
      return (updated: EventItem) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          const { error } = await supabase.from('events').update({
            fields: updated.fields,
            primary_auth_field: updated.primaryAuthField,
            security_auth_field: updated.securityAuthField,
            qr_config: updated.qrConfig,
            cert_no_config: updated.certNoConfig,
          }).eq('id', updated.id);
          // Background auto-save: no toast on success (avoid noise while dragging),
          // but surface failures so layout edits are never silently lost.
          if (error) {
            toast.error('Layout changes could not be saved', error.message);
          }
        }, 500);
      };
    })(),
    []
  );

  // Drag ke dauran me silent UI update: har pixel par Supabase session check NAHI hota.
  // Cloud me save sirf saveEventToDb (500ms debounce) karta hai.
  const handleUpdateEventSilent = useCallback((updated: EventItem) => {
    setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
    saveEventToDb(updated);
  }, [saveEventToDb]);

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onAuthenticated={handleLoginSuccess}
      />
    );
  }

  // Auth ok but profile still resolving -> show a spinner instead of a blank screen
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 p-4 font-sans">
        <Loader2 className="animate-spin text-emerald-800" size={28} />
        <p className="text-xs font-semibold text-slate-600">Loading your admin console…</p>
      </div>
    );
  }

  // Authenticated + profile loaded -> render dashboard
  const handleCreateDepartmentAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);

    try {
      const { error } = await supabase.rpc('create_department_admin', {
        p_email: newAdminEmail.trim().toLowerCase(),
        p_password: newAdminPassword.trim(),
        p_department: newAdminDept.trim()
      });

      if (error) throw error;

      toast.success('Department admin created', `Access granted to ${newAdminEmail}. They can now sign in from the Admin tab.`);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminDept('');
      await loadAdminDirectory();
    } catch (err: any) {
      toast.error('Could not create department admin', err.message || 'Please check the details and try again.');
    } finally {
      setCreatingAdmin(false);
    }
  };

    const handleCreateEvent = async () => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const values = await prompt({
      title: 'Create a new event',
      message: 'Set up a certificate event. You can upload the template and student data next.',
      fields: [
        {
          key: 'name',
          label: 'Event name',
          placeholder: 'e.g. 60th ISAE Annual Convention',
          required: true,
        },
        {
          key: 'prefix',
          label: 'Certificate number prefix',
          placeholder: 'e.g. SKUASTK/ISAE/2026/',
        },
      ],
      confirmText: 'Create event',
    });
    if (!values) return;

    const name = values.name.trim();
    if (!name) return;

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: slugHits } = await supabase.from('events').select('slug').ilike('slug', `${baseSlug}%`);
    let cleanSlug = baseSlug || `event-${Date.now()}`;
    if (slugHits && slugHits.some((r: any) => r.slug === cleanSlug)) {
      let n = 2;
      while (slugHits.some((r: any) => r.slug === `${baseSlug}-${n}`)) n++;
      cleanSlug = `${baseSlug}-${n}`;
    }

    const prefix = (values.prefix || '').trim() || `SKUASTK/${cleanSlug.substring(0, 4).toUpperCase()}/2026/`;

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
      isDownloadEnabled: true,
      isPublished: false,
      publishedAt: undefined
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
      is_download_enabled: true,
      is_published: false,
      published_at: null,
      created_by: userId
    });

    if (error) {
      toast.error('Event could not be created', error.message);
    } else {
      setEvents([newEv, ...events]);
      setSelectedEventId(newEv.id);
      toast.success('Event created', `"${newEv.name}" is ready for template and data setup.`);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const remove = await confirm({
      title: 'Delete this event?',
      message: `"${eventName}" and all of its certificates will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete event',
      danger: true,
    });
    if (!remove) return;

    const { error: certError } = await supabase.from('certificates').delete().eq('event_id', eventId);
    if (certError) {
      toast.error('Certificates could not be removed', certError.message);
      return;
    }
    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      toast.error('Event could not be deleted', error.message);
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
    toast.success('Event deleted', `"${eventName}" and its certificates were removed.`);
  };

  const handleToggleDownloadAccess = async (eventId: string, currentStatus: boolean) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('events')
      .update({ is_download_enabled: newStatus })
      .eq('id', eventId);

    if (error) {
      toast.error('Download access could not be updated', error.message);
      return;
    }

    setEvents(events.map(ev => ev.id === eventId ? { ...ev, isDownloadEnabled: newStatus } : ev));
    toast.success(
      newStatus ? 'Downloads enabled' : 'Downloads paused',
      newStatus ? 'Candidates can now download their certificates.' : 'Candidates will see a paused notice until downloads resume.'
    );
  };

  const handlePublishToggle = async (ev: EventItem) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const willPublish = !(ev.isPublished ?? false);
    if (willPublish) {
      if (certificates.length === 0) {
        toast.warning('No certificates yet', 'Upload the Excel/CSV batch first, then publish the event.');
        return;
      }
      if (!ev.templateUrl || ev.templateUrl.includes('dummyimage')) {
        const noTemplate = await confirm({
          title: 'No template uploaded',
          message: 'Publish without a certificate format? Candidates will see a blank design.',
          confirmText: 'Publish anyway',
        });
        if (!noTemplate) return;
      }
      if (!ev.primaryAuthField || !ev.securityAuthField || ev.primaryAuthField === ev.securityAuthField) {
        toast.warning('Set verification fields first', 'Choose the Name field and a different Security field before publishing.');
        return;
      }
      const goLive = await confirm({
        title: 'Publish this event?',
        message: `"${ev.name}" will go live — candidates can find and download their certificates, and the share link activates.`,
        confirmText: 'Publish event',
      });
      if (!goLive) return;
    } else {
      const goOffline = await confirm({
        title: 'Unpublish this event?',
        message: `"${ev.name}" will go offline — candidates will not be able to download until it is published again.`,
        confirmText: 'Unpublish',
        danger: true,
      });
      if (!goOffline) return;
    }

    const updates = willPublish
      ? {
          is_published: true,
          published_at: new Date().toISOString(),
          is_download_enabled: true,
          primary_auth_field: ev.primaryAuthField,
          security_auth_field: ev.securityAuthField,
        }
      : { is_published: false, is_download_enabled: true };

    const { error } = await supabase.from('events').update(updates).eq('id', ev.id);
    if (error) {
      toast.error('Publish update failed', error.message);
      return;
    }

    setEvents(events.map((row) =>
      row.id === ev.id
        ? {
            ...row,
            isPublished: willPublish,
            publishedAt: willPublish ? (updates as any).published_at : undefined,
            isDownloadEnabled: true,
          }
        : row
    ));
    toast.success(
      willPublish ? 'Event is live' : 'Event unpublished',
      willPublish ? `"${ev.name}" is now visible to candidates — the share link is active.` : `"${ev.name}" is now hidden. Candidates cannot download until it is published again.`
    );
  };

  const handleToggleCanvasLock = async (ev: EventItem) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const anyUnlocked =
      ev.fields.some((f) => !f.isLocked) ||
      !ev.qrConfig.isLocked ||
      !ev.certNoConfig.isLocked;
    const lockAll = anyUnlocked;

    const lockedFields = ev.fields.map((f) => ({ ...f, isLocked: lockAll }));
    const lockedEvent: EventItem = {
      ...ev,
      fields: lockedFields,
      qrConfig: { ...ev.qrConfig, isLocked: lockAll },
      certNoConfig: { ...ev.certNoConfig, isLocked: lockAll },
    };

    try {
      const { error } = await supabase.from('events').update({
        fields: lockedEvent.fields,
        qr_config: lockedEvent.qrConfig,
        cert_no_config: lockedEvent.certNoConfig,
      }).eq('id', ev.id);
      if (error) throw error;
      setEvents(events.map((row) => (row.id === ev.id ? lockedEvent : row)));
      toast.success(
        lockAll ? 'Layout locked' : 'Layout unlocked',
        lockAll ? 'All certificate elements are now locked in position.' : 'Elements can be repositioned and edited again.'
      );
    } catch (err: any) {
      toast.error('Layout lock failed', err?.message || 'Unknown error');
    }
  };

  const handleDeleteSingleCertificate = async (certNo: string) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const remove = await confirm({
      title: 'Delete this certificate?',
      message: `Certificate ${certNo} will be permanently removed. The candidate will no longer be able to download it. This cannot be undone.`,
      confirmText: 'Delete certificate',
      danger: true,
    });
    if (!remove) return;

    const { error } = await supabase.from('certificates').delete().eq('certificate_no', certNo);
    if (error) {
      toast.error('Certificate could not be deleted', error.message);
      return;
    }

    setCertificates(prev => prev.filter(c => c.certificate_no !== certNo));
    toast.success('Certificate deleted', `${certNo} was removed from the records.`);
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const userId = await verifyLiveSession();
    if (!userId || !currentEvent) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentEvent.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Template upload failed', uploadError.message || 'The image could not be uploaded. Please try again.');
      setUploadingImage(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('templates')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase.from('events').update({ template_url: publicUrl }).eq('id', currentEvent.id);

    if (updateError) {
      toast.error('Template link could not be saved', updateError.message);
      setUploadingImage(false);
      return;
    }

    const updated = { ...currentEvent, templateUrl: publicUrl };
    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updated : ev)));
    setUploadingImage(false);
    toast.success('Template uploaded', 'The certificate format is saved to the cloud. Fields can now be positioned on it.');
  };

  const handleUpdateEvent = async (updated: EventItem) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    setEvents(events.map((ev) => (ev.id === updated.id ? updated : ev)));
    saveEventToDb(updated);
  };

  const handleExcelParsed = async (
    records: Record<string, string>[],
    columns: UploadedColumnDefinition[],
    fileName: string,
    replaceExisting: boolean = false  // NEW: Handle replace/merge option
  ) => {
    const userId = await verifyLiveSession();
    if (!userId || !currentEvent) return;

    const batchId = `batch-${Date.now()}`;
    const newBatch: UploadedBatch = {
      batchId,
      fileName,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      count: records.length,
    };

    const updatedFields = reconcileDynamicFields(currentEvent.fields, columns, replaceExisting);

    const dbCertsToInsert: any[] = [];
    const localNewCerts: IssuedCertificate[] = [];

    const { data: existingNosRows } = await supabase
      .from('certificates')
      .select('certificate_no')
      .eq('event_id', currentEvent.id)
      .limit(10000);

    const occupiedNos = new Set<string>([
      ...certificates.map((c) => c.certificate_no),
      ...(((existingNosRows || []) as any[]).map((r) => r.certificate_no)),
    ]);

    // Random 5-digit numeric suffix: constant prefix + har student ka alag random no.
    // Har candidate ka random suffix unique hota hai (local + DB occupancy check),
    // QR me wahi full cert-no jata hai isliye QR ↔ data matching guaranteed.
    const generateCertificateNumber = (): string => {
      const MAX_TRIES = 20000;
      for (let i = 0; i < MAX_TRIES; i++) {
        const rand = Math.floor(10000 + Math.random() * 90000);
        const candidate = `${currentEvent.certPrefix}${String(rand)}`;
        if (!occupiedNos.has(candidate)) {
          occupiedNos.add(candidate);
          return candidate;
        }
      }
      // Bahut rare collision-storm me sequential fallback (kabhi duplicate nahi).
      for (let i = 1; i <= 99999; i++) {
        const candidate = `${currentEvent.certPrefix}${String(i).padStart(5, '0')}`;
        if (!occupiedNos.has(candidate)) {
          occupiedNos.add(candidate);
          return candidate;
        }
      }
      throw new Error('Certificate number space exhausted for this event prefix.');
    };

    records.forEach((row) => {
      const serialNumber = generateCertificateNumber();
      // Cert-No usi row ke data me bhi save (Master Excel column + verify fallback).
      // 'Certificate No' canonical key hai; purane mismatch-proof ke liye
      // normalized variants bhi rakhe hain (verify JSONB fallback inhe pakdega).
      const rowWithCertNo: Record<string, string> = {
        ...row,
        'Certificate No': serialNumber,
        certificate_no: serialNumber,
        Certificate_No: serialNumber,
      };
      const certObj: IssuedCertificate = {
        certificate_no: serialNumber,
        event_id: currentEvent.id,
        event_name: currentEvent.name,
        batchId,
        issue_date: new Date().toISOString().split('T')[0],
        status: 'verified',
        data: rowWithCertNo,
      };

      localNewCerts.push(certObj);
      dbCertsToInsert.push({
        certificate_no: serialNumber,
        event_id: currentEvent.id,
        event_name: currentEvent.name,
        batch_id: batchId,
        issue_date: certObj.issue_date,
        status: 'verified',
        data: rowWithCertNo,
        created_by: userId
      });
    });

    const pField = normalizeFieldReference(updatedFields, currentEvent.primaryAuthField)
      || getFieldReference(updatedFields[0]);
    const sField = normalizeFieldReference(updatedFields, currentEvent.securityAuthField)
      || getFieldReference(updatedFields[1]);

    const updatedEvent: EventItem = {
      ...currentEvent,
      fields: updatedFields,
      primaryAuthField: pField,
      securityAuthField: sField,
      batches: [...currentEvent.batches, newBatch],
      isDownloadEnabled: currentEvent.isDownloadEnabled ?? true,
      isPublished: currentEvent.isPublished ?? false,
    };

    const { data: inserted, error: certError } = await supabase
      .from('certificates')
      .insert(dbCertsToInsert)
      .select('certificate_no');

    if (certError) {
      if ((certError as any)?.code === '23505') {
        toast.error('Duplicate certificate numbers', 'Some numbers already exist. Re-upload to auto-generate fresh unique numbers.');
      } else {
        toast.error('Certificates upload failed', certError.message);
      }
      return;
    }

    const { error: evError } = await supabase.from('events').update({
      fields: updatedFields,
      primary_auth_field: pField,
      security_auth_field: sField,
      batches: updatedEvent.batches,
    }).eq('id', currentEvent.id);

    if (evError) {
      toast.error('Event settings could not be updated', evError.message);
      return;
    }

    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updatedEvent : ev)));
    setCertificates([...certificates, ...localNewCerts]);
    setActiveCertIndex(0);
    setSelectedEventId(currentEvent.id);
    toast.success(
      `${records.length} certificates saved`,
      `Uploaded to the secure cloud. First certificate: ${inserted?.[0]?.certificate_no ?? '—'}`
    );
  };

  const handleDeleteBatch = async (batchId: string) => {
    const userId = await verifyLiveSession();
    if (!userId) return;

    const remove = await confirm({
      title: 'Delete this batch?',
      message: 'All certificates in this batch will be permanently removed from the database. This cannot be undone.',
      confirmText: 'Delete batch',
      danger: true,
    });
    if (!remove) return;

    const { error: certError } = await supabase.from('certificates').delete().eq('batch_id', batchId);
    if (certError) {
      toast.error('Batch certificates could not be removed', certError.message);
      return;
    }
    const { error: evError } = await supabase.from('events').update({ batches: currentEvent.batches.filter((b) => b.batchId !== batchId) }).eq('id', currentEvent.id);
    if (evError) {
      toast.error('Batch list could not be updated', evError.message);
      return;
    }

    const updatedBatches = currentEvent.batches.filter((b) => b.batchId !== batchId);
    const updatedEvent = { ...currentEvent, batches: updatedBatches };
    setEvents(events.map((ev) => (ev.id === currentEvent.id ? updatedEvent : ev)));
    loadCertificates(currentEvent.id);
    toast.success('Batch deleted', 'The batch and its certificates were removed.');
  };

  const handleExportEventExcel = () => {
    if (certificates.length === 0) {
      toast.warning('Nothing to export', 'Upload certificates before exporting the master list.');
      return;
    }
    const exportRows = certificates.map((c) => {
      const { certificate_no: _dup1, Certificate_No: _dup2, ...restData } = (c.data || {}) as Record<string, string>;
      void _dup1; void _dup2;
      return {
        'Certificate No': c.certificate_no,
        Status: c.status,
        'Issue Date': c.issue_date,
        ...restData,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Certificates');
    XLSX.writeFile(wb, `${currentEvent.name.replace(/\s+/g, '_')}_Official_List.xlsx`);
  };

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0];
  const activeCert = certificates[activeCertIndex] || certificates[0];
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isCurrentEventDownloadsActive = currentEvent?.isDownloadEnabled !== false;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top University Ribbon Header */}
        <div style={{ backgroundColor: '#0f5132' }} className="p-6 rounded-2xl text-white shadow-lg flex flex-wrap gap-4 justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Sher-e-Kashmir University (SKUAST-K)</h1>
              <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full shadow-sm ${
                isSuperAdmin ? 'bg-amber-400 text-slate-950' : 'bg-emerald-800 text-emerald-100 border border-emerald-600'
              }`}>
                {isSuperAdmin ? 'Central Super Admin' : userProfile?.department || 'Department Admin'}
              </span>
            </div>
            <p className="text-xs text-green-200 mt-1">
              Logged in as: <span className="font-mono text-white font-semibold">{userProfile?.email || 'Authenticated'}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {!isSuperAdmin && (
              <button 
                onClick={handleCreateEvent} 
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow transition"
              >
                <FolderPlus size={16} /> + Create New Event
              </button>
            )}
            
            <button 
              onClick={handleLogout} 
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer font-semibold shadow transition"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* ---------------- SUPER ADMIN CONSOLE ---------------- */}
        {isSuperAdmin ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Create New Admin Form */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <UserPlus className="text-emerald-700" size={20} />
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Create Department Admin</h2>
                    <p className="text-[11px] text-gray-500">Authorize a new faculty/department incharge</p>
                  </div>
                </div>

                <form onSubmit={handleCreateDepartmentAdmin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Official University Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-3 text-gray-400" />
                      <input 
                        type="email"
                        required
                        placeholder="hod.agronomy@skuastkashmir.ac.in"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Department / Division</label>
                    <div className="relative">
                      <Building size={15} className="absolute left-3 top-3 text-gray-400" />
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Division of Agronomy / Horticulture"
                        value={newAdminDept}
                        onChange={(e) => setNewAdminDept(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Set Temporary Password</label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3 top-3 text-gray-400" />
                      <input 
                        type="password"
                        required
                        placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingAdmin}
                    style={{ backgroundColor: '#0f5132' }}
                    className="w-full py-2.5 mt-2 text-white text-xs font-bold rounded-xl shadow hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {creatingAdmin ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>{creatingAdmin ? 'Authorizing & Creating...' : 'Create Department Admin'}</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Active Department Admins List */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="text-emerald-700" size={20} />
                    <h2 className="text-sm font-bold text-gray-900">Registered Department Administrators</h2>
                  </div>
                  <span className="text-xs bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-700 border">
                    {adminList.length} Active Accounts
                  </span>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-gray-500 flex justify-center items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-emerald-800" /> Loading administrative ledger...
                  </div>
                ) : adminList.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">No department admins created yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-600">
                          <th className="py-2.5 px-3 rounded-l-lg">Admin Official Email</th>
                          <th className="py-2.5 px-3">Assigned Department</th>
                          <th className="py-2.5 px-3">Role Privilege</th>
                          <th className="py-2.5 px-3 rounded-r-lg">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {adminList.map((adm) => (
                          <tr key={adm.id || adm.email} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3 font-mono font-semibold text-slate-800">{adm.email}</td>
                            <td className="py-3 px-3 font-medium text-slate-700">{adm.department || 'Central'}</td>
                            <td className="py-3 px-3">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                adm.role === 'super_admin' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}>
                                {adm.role === 'super_admin' ? 'Super Admin' : 'Event Admin'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                <Check size={13} /> Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (

          /* ---------------- EVENT / DEPARTMENT ADMIN CONSOLE ---------------- */
          <>
            {loading ? (
              <div className="bg-white p-12 rounded-2xl border text-center text-sm font-medium text-gray-500 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading events from Supabase Cloud...
              </div>
            ) : (events.length === 0 || !currentEvent) ? (
              <div className="bg-white p-12 rounded-2xl border text-center space-y-3">
                <p className="text-gray-600 text-sm">You haven't created any events for your department yet.</p>
                <button onClick={handleCreateEvent} className="bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                  + Create Your First Event
                </button>
              </div>
            ) : (
              <>
                {/* Event Selector Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 items-center justify-between">
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

                  {/* Admin Download Access Pause/Active Toggle Button */}
                  {currentEvent && (
                    <button
                      onClick={() => handleToggleDownloadAccess(currentEvent.id, isCurrentEventDownloadsActive)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border shadow-sm shrink-0 transition ${
                        isCurrentEventDownloadsActive
                          ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500 shadow-emerald-500/20'
                          : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      }`}
                      title="Click to toggle public student download access"
                    >
                      {isCurrentEventDownloadsActive ? 'Γ£ô Downloads Live' : 'ΓÅ╕ Downloads Paused'}
                    </button>
                  )}
                </div>

                {/* Event Public Link */}
                <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <LinkIcon size={14} /> Public Download Link (Universal)
                      {currentEvent.isPublished ? (
                        <span className="ml-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
                      ) : (
                        <span className="ml-2 bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">DRAFT</span>
                      )}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-800 mt-1 block select-all">
                      {getEventUrl(currentEvent.slug || currentEvent.id)}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      This link is generated automatically when you create the event. Once published, participants use it to enter their Name and Security details to download their certificate.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const link = getEventUrl(currentEvent.slug || currentEvent.id);
                      navigator.clipboard.writeText(link);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{ backgroundColor: copied ? '#15803d' : '#0f5132' }}
                    className="text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow"
                  >
                    {copied ? <Check size={14} /> : <LinkIcon size={14} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Share Link'}
                  </button>
                </div>

                {/* Publish Controls (Draft -> Live -> Update push) */}
                <div className={`p-5 rounded-2xl border shadow-sm space-y-3 ${currentEvent.isPublished ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className={currentEvent.isPublished ? 'text-emerald-700' : 'text-slate-500'} />
                      <div>
                        <h3 className="text-xs font-bold text-gray-800">
                          {currentEvent.isPublished ? 'Event is live (published)' : 'Event is a draft'}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          Lock the layout first, then fix the Name + Security fields, then press Publish below. To make changes later: Unpublish, edit, and Publish again. Certificate numbers stay fixed per record, and the layout updates automatically because rendering is live.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleToggleCanvasLock(currentEvent)}
                        className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border shadow-sm bg-white text-slate-800 border-gray-300 hover:bg-slate-100 transition"
                        title="Sabhi text layers + QR + cert no ka lock/unlock ek sath."
                      >
                        {currentEvent.fields.some((f) => !f.isLocked) || !currentEvent.qrConfig.isLocked || !currentEvent.certNoConfig.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        {currentEvent.fields.some((f) => !f.isLocked) || !currentEvent.qrConfig.isLocked || !currentEvent.certNoConfig.isLocked ? 'Lock Axis (All)' : 'Unlock Axis (All)'}
                      </button>
                      <button
                        onClick={() => handlePublishToggle(currentEvent)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow transition cursor-pointer flex items-center gap-1.5 ${currentEvent.isPublished ? 'bg-slate-800 hover:bg-slate-700' : 'bg-emerald-700 hover:bg-emerald-600'}`}
                      >
                        {currentEvent.isPublished ? 'Unpublish (Edit ke liye)' : 'Publish (Live for Users)'}
                      </button>
                    </div>
                  </div>
                  {currentEvent.isPublished && currentEvent.publishedAt && (
                    <p className="text-[11px] text-emerald-800 font-semibold">
                      Last published: {new Date(currentEvent.publishedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* 2-Factor Auth Field Mapping */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-amber-500" size={18} />
                    <h3 className="text-xs font-bold text-gray-800">2-Factor Security Authentication for Public Download</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Primary Identifier (Name) *</label>
                      <select
                        value={currentEvent.primaryAuthField}
                        onChange={(e) => handleUpdateEvent({ ...currentEvent, primaryAuthField: e.target.value })}
                        className="block w-fit min-w-[10rem] max-w-full truncate h-auto min-h-9 max-h-12 text-xs p-2 rounded-lg border bg-slate-50"
                        title={getFieldDisplayLabel(currentEvent.fields, currentEvent.primaryAuthField)}
                      >
                        <option value="">-- Select Name Column --</option>
                        {currentEvent.fields.map((f) => (
                          <option key={f.key} value={getFieldReference(f)}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Security Check (Reg No / Mobile) * (must differ from Name)</label>
                      <select
                        value={currentEvent.securityAuthField}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && v === currentEvent.primaryAuthField) {
                            toast.warning('Security field must differ', 'The security check must use a different column than the Name field.');
                            return;
                          }
                          handleUpdateEvent({ ...currentEvent, securityAuthField: v });
                        }}
                        className="block w-fit min-w-[10rem] max-w-full truncate h-auto min-h-9 max-h-12 text-xs p-2 rounded-lg border bg-slate-50"
                        title={getFieldDisplayLabel(currentEvent.fields, currentEvent.securityAuthField)}
                      >
                        <option value="">-- Select Security Column --</option>
                        {currentEvent.fields.map((f) => (
                          <option key={f.key} value={getFieldReference(f)}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Template & Field Visibility */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-2">
                        <ImagePlus size={16} className="text-emerald-700" /> Template Format (Cloud)
                      </h3>
                      <label className="border border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-700 bg-gray-50">
                        <span className="text-[11px] text-gray-600 font-medium">
                          {uploadingImage ? 'Uploading to Supabase...' : 'Upload New Template (PNG/JPG)'}
                        </span>
                        <input type="file" accept="image/*" disabled={uploadingImage} onChange={handleTemplateUpload} className="hidden" />
                      </label>
                    </div>
                    {currentEvent.templateUrl && !currentEvent.templateUrl.includes('dummyimage') && (
                      <button
                        onClick={async () => {
                          const remove = await confirm({
                            title: 'Remove current template format?',
                            message: 'Candidates will see a blank format until a new template is uploaded.',
                            confirmText: 'Remove template',
                            danger: true,
                          });
                          if (!remove) return;
                          const updated = { ...currentEvent, templateUrl: 'https://dummyimage.com/1920x1080/0f5132/ffffff&text=Upload+Template' };
                          const { error } = await supabase.from('events').update({ template_url: updated.templateUrl }).eq('id', currentEvent.id);
                          if (error) {
                            toast.error('Template could not be removed', error.message);
                            return;
                          }
                          setEvents(events.map(ev => ev.id === currentEvent.id ? updated : ev));
                          toast.success('Template removed', 'Candidates will see a blank format until a new template is uploaded.');
                        }}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer shadow-sm"
                      >
                        <Trash2 size={14} /> Remove Current Template
                      </button>
                    )}
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

                {/* Upload Batch & Export & Individual Certificate Delete */}
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

                {/* Single Certificate Record Management / Delete Module */}
                {certificates.length > 0 && activeCert && (
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">Visual Coordinate Designer & Record Management</h3>
                        <p className="text-[11px] text-gray-500">Drag fields to position them, switch records, or delete a single certificate</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteSingleCertificate(activeCert.certificate_no)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="Delete this individual certificate record"
                        >
                          <Trash2 size={14} /> Delete Record ({activeCert.certificate_no})
                        </button>

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
                    </div>

                    <CertificateCanvas
                      event={currentEvent}
                      cert={activeCert}
                      onUpdateEvent={handleUpdateEventSilent}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
};
