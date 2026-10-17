import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { QRCodeSVG } from 'qrcode.react';
import { getVerifyUrl } from '../lib/shareUrl';
import {
  getFieldWidthPercent, isFieldPlaced, resolveFieldValue
} from '../lib/certificateFields';
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Palette, Type,
  X, Lock, Unlock, ZoomIn, ZoomOut, Download, Loader2, Eye, EyeOff,
  Undo2, Redo2, Copy, Grid3x3, Save, CheckCircle2, Trash2, Search,
  CaseUpper, Baseline, RotateCw, Ruler, MousePointer2, Layers,
  Minus, Plus, FileText
} from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  event: EventItem;
  cert: IssuedCertificate;
  onUpdateEvent?: (ev: EventItem) => void;
  readOnly?: boolean;
}

const CERT_FONTS = [
  { label: 'Georgia Serif', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Cinzel Formal', value: 'Cinzel, Georgia, serif' },
  { label: 'Inter / Modern Sans', value: 'Inter, system-ui, sans-serif' },
  { label: 'Montserrat Bold', value: 'Montserrat, sans-serif' },
  { label: 'Courier Monospace', value: '"Courier New", Courier, monospace' },
];

// Undo/Redo history management
interface HistoryState {
  event: EventItem;
  timestamp: number;
}

export const CertificateCanvas: React.FC<Props> = ({ event, cert, onUpdateEvent, readOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  
  // NEW: Undo/Redo state
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // NEW: Alignment guides state
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);

  // Word-style ribbon: active tab (Home / Insert / View)
  const [activeTab, setActiveTab] = useState<'Home' | 'Insert' | 'View'>('Home');
  // Fields-tray search + drag-over highlight + ruler toggle
  const [traySearch, setTraySearch] = useState<string>('');
  const [dropHover, setDropHover] = useState<boolean>(false);
  const [showRulers, setShowRulers] = useState<boolean>(false);
  
  // NEW: Save indicator state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const toast = useToast();


  const getQrVerificationUrl = () => getVerifyUrl(cert.certificate_no);
  const selectedField = selectedElementKey ? (event.fields.find(f => f.key === selectedElementKey) || null) : null;

  // Values resolve only for the current row; the stored field remains a source reference.
  const getFieldValue = (field: DynamicFieldDef): string =>
    resolveFieldValue(cert.data || {}, field);

  const isLockedKey = (key: string): boolean => {
    if (key === '__cert_no__') return !!event.certNoConfig.isLocked;
    if (key === '__qr_code__') return !!event.qrConfig.isLocked;
    return !!event.fields.find(f => f.key === key)?.isLocked;
  };

  // ---------------- UNDO/REDO HELPERS ----------------
  const pushToHistory = useCallback((ev: EventItem) => {
    const newState: HistoryState = { event: ev, timestamp: Date.now() };
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const newHistory = [...trimmed, newState].slice(-50);
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
    setSaveStatus('unsaved');
    setTimeout(() => setSaveStatus('saved'), 600);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !onUpdateEvent) return;
    const prevIndex = historyIndex - 1;
    const prevState = history[prevIndex];
    if (prevState) {
      setHistoryIndex(prevIndex);
      onUpdateEvent(prevState.event);
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 400);
    }
  }, [historyIndex, history, onUpdateEvent]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !onUpdateEvent) return;
    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    if (nextState) {
      setHistoryIndex(nextIndex);
      onUpdateEvent(nextState.event);
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 400);
    }
  }, [historyIndex, history, onUpdateEvent]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ event, timestamp: Date.now() }]);
      setHistoryIndex(0);
    }
  }, []);

  // Track changes
  useEffect(() => {
    const lastState = history[historyIndex];
    if (lastState && lastState.event !== event && !readOnly) {
      pushToHistory(event);
    }
  }, [event, historyIndex, history, readOnly, pushToHistory]);

  // ---------------- FIELD MOVEMENT ----------------
  const moveSelectedElement = (dx: number, dy: number) => {
    if (!selectedElementKey || !onUpdateEvent || isLockedKey(selectedElementKey)) return;
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v.toFixed(2))));
    
    if (selectedElementKey === '__cert_no__') {
      onUpdateEvent({
        ...event,
        certNoConfig: { ...event.certNoConfig, x: clamp(event.certNoConfig.x + dx), y: clamp(event.certNoConfig.y + dy) }
      });
    } else if (selectedElementKey === '__qr_code__') {
      onUpdateEvent({
        ...event,
        qrConfig: { ...event.qrConfig, x: clamp(event.qrConfig.x + dx), y: clamp(event.qrConfig.y + dy) }
      });
    } else {
      const updatedFields = event.fields.map(f =>
        f.key === selectedElementKey ? { ...f, x: clamp(f.x + dx), y: clamp(f.y + dy) } : f
      );
      onUpdateEvent({ ...event, fields: updatedFields });
    }
  };

  // ---------------- FIELD DUPLICATION ----------------
  const handleDuplicateField = () => {
    if (!selectedElementKey || !onUpdateEvent) return;
    if (selectedElementKey === '__cert_no__' || selectedElementKey === '__qr_code__') return;

    const sourceField = event.fields.find(f => f.key === selectedElementKey);
    if (!sourceField) return;

    const newKey = `${sourceField.key}_copy_${Date.now()}`;
    const duplicatedField: DynamicFieldDef = {
      ...sourceField,
      key: newKey,
      label: `${sourceField.label} (Copy)`,
      x: Math.min(100, sourceField.x + 5),
      y: Math.min(100, sourceField.y + 5),
      isLocked: false
    };

    onUpdateEvent({ ...event, fields: [...event.fields, duplicatedField] });
    setSelectedElementKey(newKey);
  };

  // ---------------- FIELD DELETION ----------------
  const handleDeleteField = () => {
    if (!selectedElementKey || !onUpdateEvent) return;
    if (selectedElementKey === '__cert_no__' || selectedElementKey === '__qr_code__') return;

    const fieldToDelete = event.fields.find(f => f.key === selectedElementKey);
    if (!fieldToDelete || fieldToDelete.isLocked) return;

    onUpdateEvent({ ...event, fields: event.fields.filter(f => f.key !== selectedElementKey) });
    setSelectedElementKey(null);
  };

  // ---------------- KEYBOARD SHORTCUTS ----------------
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (!selectedElementKey || !onUpdateEvent) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); handleDuplicateField(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedElementKey !== '__cert_no__' && selectedElementKey !== '__qr_code__') handleDeleteField();
        return;
      }

      const step = e.shiftKey ? 0.1 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      e.preventDefault();
      moveSelectedElement(dx, dy);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementKey, onUpdateEvent, event, handleUndo, handleRedo]);

  // ---------------- GRID SNAP ----------------
  const snapToGridValue = (value: number, gridSize: number = 5): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    if (readOnly) return;
    // Don't prevent default for text selection - only for drag
    // This allows admin to select text in the inspector/preview
    e.stopPropagation();
    setSelectedElementKey(key);
    if (isLockedKey(key)) return;
    // Only prevent default when starting drag (not on plain click)
    e.preventDefault();
    setDraggingKey(key);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingKey || !containerRef.current || !onUpdateEvent) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(100, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    let y = Math.max(0, Math.min(100, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));
    
    // Apply grid snapping
    x = snapToGridValue(x);
    y = snapToGridValue(y);

    if (draggingKey === '__cert_no__') {
      onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x, y } });
    } else if (draggingKey === '__qr_code__') {
      onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x, y } });
    } else {
      const updatedFields = event.fields.map(f => f.key === draggingKey ? { ...f, x, y } : f);
      onUpdateEvent({ ...event, fields: updatedFields });
    }
  }, [draggingKey, event, onUpdateEvent, snapToGrid]);

  const handleMouseUp = useCallback(() => { setDraggingKey(null); }, []);

  useEffect(() => {
    if (!draggingKey) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingKey, handleMouseMove, handleMouseUp]);

  // ---------------- FIELD UPDATE HELPERS ----------------
  const updateField = (key: string, patch: Partial<DynamicFieldDef>) => {
    if (!onUpdateEvent) return;
    const updatedFields = event.fields.map(f => f.key === key ? { ...f, ...patch } : f);
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const placeFieldFromDrop = (key: string, clientX: number, clientY: number) => {
    if (!onUpdateEvent || !containerRef.current) return;
    if (isLockedKey(key)) {
      toast.warning('Layer is locked', 'Unlock it from the Layers list first.');
      return;
    }
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v.toFixed(2))));
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let x = clamp(((clientX - rect.left) / rect.width) * 100);
    let y = clamp(((clientY - rect.top) / rect.height) * 100);
    if (snapToGrid) {
      x = clamp(Math.round(x / 5) * 5);
      y = clamp(Math.round(y / 5) * 5);
    }
    // History auto-captures via the event-change effect above — no manual push.
    if (key === '__cert_no__') {
      onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x, y } });
      setSelectedElementKey(key);
      return;
    }
    if (key === '__qr_code__') {
      onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x, y } });
      setSelectedElementKey(key);
      return;
    }
    const field = event.fields.find((item) => item.key === key);
    if (!field) return;
    updateField(key, { x, y, isPlaced: true });
    setSelectedElementKey(key);
  };

  // ---------------- WORD-STYLE TRAY HELPERS ----------------
  // Canvas drop MIME must match the existing onDragOver/onDrop contract.
  const startFieldDrag = (e: React.DragEvent, key: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-skuastk-certificate-field', key);
    e.dataTransfer.setData('text/plain', key);
  };

  // Tray me ↑/↓ se select, Enter se place (mouse-free keyboard flow)
  const handleTrayKeyNav = (e: React.KeyboardEvent, keys: string[]) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    e.preventDefault();
    const idx = keys.indexOf(selectedElementKey || '');
    if (e.key === 'Enter') {
      if (!selectedElementKey) return;
      if (selectedElementKey === '__cert_no__' || selectedElementKey === '__qr_code__') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) placeFieldFromDrop(selectedElementKey, rect.left + rect.width / 2, rect.top + rect.height / 2);
        return;
      }
      handleAddField(selectedElementKey);
      return;
    }
    const next = e.key === 'ArrowDown'
      ? keys[Math.min(keys.length - 1, (idx < 0 ? -1 : idx) + 1)]
      : keys[Math.max(0, (idx < 0 ? keys.length : idx) - 1)];
    if (next) setSelectedElementKey(next);
  };

  // One-click place: unplaced field ko canvas ke center me lao (drag bhi chalta hai)
  const handleAddField = (key: string) => {
    const field = event.fields.find((item) => item.key === key);
    if (!field) return;
    if (field.isLocked) {
      setSelectedElementKey(key);
      toast.warning('Layer is locked', 'Unlock it before moving.');
      return;
    }
    if (!isFieldPlaced(field) && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      placeFieldFromDrop(key, rect.left + rect.width / 2, rect.top + rect.height / 2);
      return;
    }
    setSelectedElementKey(key);
  };

  const handleZoomReset = () => setZoomLevel(1);

  const handleFontFamilyChange = (key: string, fontFamily: string) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, fontFamily } }); return; }
    updateField(key, { fontFamily });
  };

  const handleFontSizeChange = (key: string, fontSize: number) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, fontSize } }); return; }
    updateField(key, { fontSize });
  };

  const handleColorChange = (key: string, color: string) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, color } }); return; }
    updateField(key, { color });
  };

  const handleToggleBold = (key: string) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, isBold: !event.certNoConfig.isBold } }); return; }
    const f = event.fields.find(x => x.key === key);
    if (f) updateField(key, { isBold: !f.isBold });
  };

  const handleToggleItalic = (key: string) => {
    const f = event.fields.find(x => x.key === key);
    if (f) updateField(key, { isItalic: !f.isItalic });
  };

  const handleToggleUppercase = (key: string) => {
    const f = event.fields.find(x => x.key === key);
    if (f) updateField(key, { isUppercase: !f.isUppercase });
  };

  const handleAlignChange = (key: string, align: 'left' | 'center' | 'right') => updateField(key, { align });
  const handleMaxWidthChange = (key: string, maxWidth: number) => updateField(key, { maxWidth });
  const handleLineHeightChange = (key: string, lineHeight: number) => updateField(key, { lineHeight });
  const handleMaxLinesChange = (key: string, maxLines: number) => updateField(key, { maxLines });
  const handleLetterSpacingChange = (key: string, letterSpacing: number) => updateField(key, { letterSpacing });
  const handleRotationChange = (key: string, rotation: number) => updateField(key, { rotation });

  const handleVisibilityToggle = (key: string) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, visible: !event.certNoConfig.visible } }); return; }
    if (key === '__qr_code__') { onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, visible: !event.qrConfig.visible } }); return; }
    const f = event.fields.find(x => x.key === key);
    if (f) updateField(key, { visible: !f.visible });
  };

  const handleLockToggle = (key: string) => {
    if (key === '__cert_no__') { onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, isLocked: !event.certNoConfig.isLocked } }); return; }
    if (key === '__qr_code__') { onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, isLocked: !event.qrConfig.isLocked } }); return; }
    const f = event.fields.find(x => x.key === key);
    if (f) updateField(key, { isLocked: !f.isLocked });
  };

  const handleLockAxisAll = () => {
    if (!onUpdateEvent) return;
    onUpdateEvent({
      ...event,
      fields: event.fields.map(f => ({ ...f, isLocked: true })),
      qrConfig: { ...event.qrConfig, isLocked: true },
      certNoConfig: { ...event.certNoConfig, isLocked: true },
    });
  };

  const handleUnlockAxisAll = () => {
    if (!onUpdateEvent) return;
    onUpdateEvent({
      ...event,
      fields: event.fields.map(f => ({ ...f, isLocked: false })),
      qrConfig: { ...event.qrConfig, isLocked: false },
      certNoConfig: { ...event.certNoConfig, isLocked: false },
    });
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.25, z - 0.25));

  const getProcessedText = (text: string, field: DynamicFieldDef): string => {
    let result = text ?? '';
    if (field.isUppercase) result = result.toUpperCase();
    return result;
  };

  // ---------------- EXPORT (PNG + PDF) ----------------
  // Export se pehle selection ring/placeholder hatate hain taaki
  // official PDF/PNG me sirf asli data (positions match) jaye.
  const handleExportCanvas = async (format: 'pdf' | 'png') => {
    if (!containerRef.current || isExporting) return;
    setIsExporting(true);
    const prevSelected = selectedElementKey;
    setSelectedElementKey(null);
    // html2canvas baseline measure karne ke liye ek hidden <img> ko
    // document.body me append karta hai. Tailwind preflight ka
    // `img { display: block }` us metrics-img ko block bana deta hai, jisse
    // baseline calculation bigad jaati hai aur canvas me saara text neeche
    // shift ho kar overflow:hidden fields ke bottom par cut ho jaata hai
    // (preview sahi dikhta tha, downloaded file me text crop hota tha).
    // Export ke dauran us metrics-container ke img ko wapas inline-block par
    // force karte hain; selector sirf body ke direct id-less div (html2canvas
    // ka metrics container) ke imgs par apply hota hai — app ke root/layout
    // imgs untouched rehte hain.
    const fontMetricsFix = document.createElement('style');
    fontMetricsFix.setAttribute('data-h2c-fontmetrics-fix', '');
    fontMetricsFix.textContent = 'body > div:not([id]) > img { display: inline-block !important; }';
    document.head.appendChild(fontMetricsFix);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 60));
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');
      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${event.slug || event.name}-certificate-${cert.certificate_no}.pdf`);
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${event.slug || event.name}-certificate-${cert.certificate_no}.png`;
        link.click();
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Certificate export failed', 'Could not generate the file. Please check the template image and try again.');
    } finally {
      fontMetricsFix.remove();
      setSelectedElementKey(prevSelected);
      setIsExporting(false);
    }
  };

  // ---------------- WORD-STYLE RENDER HELPERS ----------------
  const selIsCertNo = selectedElementKey === '__cert_no__';
  const selIsQr = selectedElementKey === '__qr_code__';
  const selIsField = !!selectedField && !selIsCertNo && !selIsQr;
  const selLabel = selIsCertNo ? 'Certificate No' : selIsQr ? 'QR Code' : (selectedField?.label || selectedElementKey || '');
  const allLocked = event.fields.length > 0
    && event.fields.every(f => f.isLocked) && event.qrConfig.isLocked && event.certNoConfig.isLocked;
  const trayFields = event.fields.filter(f =>
    !traySearch.trim() || f.label.toLowerCase().includes(traySearch.trim().toLowerCase())
  );
  const trayNavKeys = [...trayFields.map(f => f.key), '__cert_no__', '__qr_code__'];

  const ribbonBtn = 'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed min-w-[3rem]';
  const ribbonBtnActive = 'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-emerald-800 text-white cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed min-w-[3rem]';
  const ribbonLabel = 'text-[9px] font-semibold leading-none whitespace-nowrap';
  const ribbonGroup = 'flex items-stretch gap-0.5 px-2 border-r border-slate-200 last:border-r-0';
  const ribbonGroupTitle = 'text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center leading-none mt-0.5';

  return (
    <div className="relative w-full">  {/* Removed select-none - only canvas has it */}
      {/* ═══════════ WORD-STYLE TITLE BAR ═══════════ */}
      {!readOnly && (
        <div className="flex items-center gap-2 bg-[#0f5132] text-white px-3 py-1.5 rounded-t-2xl">
          <FileText size={14} className="text-amber-300 shrink-0" />
          <span className="text-xs font-bold truncate">{event.name || 'Untitled certificate'} — Designer</span>
          <span className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            saveStatus === 'saved' ? 'bg-emerald-400/20 text-emerald-100'
            : saveStatus === 'saving' ? 'bg-amber-400/20 text-amber-100' : 'bg-sky-400/20 text-sky-100'
          }`}>
            {saveStatus === 'saved' ? <><CheckCircle2 size={11} /> Saved</>
              : saveStatus === 'saving' ? <><Save size={11} className="animate-pulse" /> Saving…</>
              : <><Save size={11} /> Unsaved</>}
          </span>
          <span className="text-[10px] font-mono text-emerald-200/80">{historyIndex + 1}/{history.length}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => handleExportCanvas('png')}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PNG
            </button>
            <button
              onClick={() => handleExportCanvas('pdf')}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Official PDF
            </button>
          </div>
        </div>
      )}
      {readOnly && (
        <div className="flex items-center gap-1.5 bg-[#0f5132] px-3 py-1.5 rounded-t-2xl">
          <FileText size={14} className="text-amber-300 shrink-0" />
          <span className="text-xs font-bold truncate">{event.name || 'Certificate'}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => handleExportCanvas('png')}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PNG
            </button>
            <button
              onClick={() => handleExportCanvas('pdf')}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Official PDF
            </button>
          </div>
        </div>
      )}


      {/* ═══════════ TAB STRIP (Home / Insert / View) ═══════════ */}
      {!readOnly && (
        <div className="flex items-center gap-1 bg-white border-b border-slate-200 px-2 pt-1">
          {(['Home', 'Insert', 'View'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-t-lg text-xs font-bold transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-slate-100 text-emerald-900 shadow-[inset_0_2px_0_#0f5132]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-0.5 pb-1">
            <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer transition">
              <Undo2 size={15} />
            </button>
            <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer transition">
              <Redo2 size={15} />
            </button>
          </div>
        </div>
      )}
      {/* ═══════════ RIBBON — HOME ═══════════ */}
      {!readOnly && activeTab === 'Home' && (
        <div className="bg-slate-100/80 border-b border-slate-200 px-2 py-1.5">
          <div className="flex flex-wrap items-stretch gap-y-1">
            {/* Clipboard */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={handleDuplicateField} disabled={!selIsField} title="Duplicate field (Ctrl+D)" className={ribbonBtn}>
                    <Copy size={16} /><span className={ribbonLabel}>Duplicate</span>
                  </button>
                  <button onClick={handleDeleteField} disabled={!selectedElementKey} title="Delete field (Del)" className={ribbonBtn}>
                    <Trash2 size={16} /><span className={ribbonLabel}>Delete</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Clipboard</span>
              </div>
            </div>
            {/* Font */}
            <div className={ribbonGroup}>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <Type size={13} className="text-slate-400 shrink-0" />
                  <select
                    value={selIsCertNo ? (event.certNoConfig.fontFamily || 'Georgia, serif') : (selectedField?.fontFamily ?? 'Georgia, serif')}
                    onChange={(e) => selectedElementKey && !selIsQr && handleFontFamilyChange(selectedElementKey, e.target.value)}
                    disabled={!selectedElementKey || selIsQr}
                    title="Font family"
                    className="max-w-[9.5rem] text-[11px] rounded-lg border border-slate-300 bg-white px-1.5 py-1 cursor-pointer disabled:opacity-40"
                  >
                    {CERT_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <input
                    type="number" min={6} max={120}
                    value={selIsCertNo ? event.certNoConfig.fontSize : (selectedField?.fontSize ?? 14)}
                    onChange={(e) => selectedElementKey && !selIsQr && handleFontSizeChange(selectedElementKey, Number(e.target.value) || 14)}
                    disabled={!selectedElementKey || selIsQr}
                    title="Font size"
                    className="w-14 text-[11px] rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-right disabled:opacity-40"
                  />
                  <Palette size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="color"
                    value={selIsCertNo ? event.certNoConfig.color : (selectedField?.color ?? '#111827')}
                    onChange={(e) => selectedElementKey && !selIsQr && handleColorChange(selectedElementKey, e.target.value)}
                    disabled={!selectedElementKey || selIsQr}
                    title="Text colour"
                    className="w-8 h-7 rounded border border-slate-300 cursor-pointer bg-white p-0.5 disabled:opacity-40"
                  />
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <button onClick={() => selectedElementKey && handleToggleBold(selectedElementKey)} title="Bold"
                    disabled={!selectedElementKey || selIsQr}
                    className={`p-1.5 rounded-md cursor-pointer ${((selIsCertNo && event.certNoConfig.isBold) || selectedField?.isBold) ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-white'} disabled:opacity-30`}>
                    <Bold size={14} />
                  </button>
                  <button onClick={() => selectedElementKey && handleToggleItalic(selectedElementKey)} title="Italic"
                    disabled={!selIsField}
                    className={`p-1.5 rounded-md cursor-pointer ${selectedField?.isItalic ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-white'} disabled:opacity-30`}>
                    <Italic size={14} />
                  </button>
                  <button onClick={() => selectedElementKey && handleToggleUppercase(selectedElementKey)} title="UPPERCASE"
                    disabled={!selIsField}
                    className={`p-1.5 rounded-md cursor-pointer ${selectedField?.isUppercase ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-white'} disabled:opacity-30`}>
                    <CaseUpper size={14} />
                  </button>
                  <div className="w-px h-5 bg-slate-300 mx-0.5" />
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button key={a} onClick={() => selectedElementKey && handleAlignChange(selectedElementKey, a)} title={`Align ${a}`}
                      disabled={!selIsField}
                      className={`p-1.5 rounded-md cursor-pointer ${selectedField?.align === a ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-white'} disabled:opacity-30`}>
                      {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                    </button>
                  ))}
                </div>
                <span className={ribbonGroupTitle}>Font</span>
              </div>
            </div>
            {/* Spacing */}
            <div className={ribbonGroup}>
              <div className="flex flex-col justify-center gap-1 px-1 min-w-[10rem]">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Text width (wrap)">
                  <Baseline size={11} className="shrink-0" />
                  <input type="range" min={10} max={100} value={selIsField ? getFieldWidthPercent(selectedField!.maxWidth) : 60}
                    onChange={(e) => selectedElementKey && selIsField && handleMaxWidthChange(selectedElementKey, Number(e.target.value))}
                    disabled={!selIsField} className="flex-1 h-1 cursor-pointer disabled:opacity-40" />
                  <span className="font-mono w-7 text-right">{selIsField ? getFieldWidthPercent(selectedField!.maxWidth) : '—'}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Line height">
                  <span className="w-[11px] text-center font-bold">≡</span>
                  <input type="range" min={0.8} max={3} step={0.1} value={selIsField ? selectedField!.lineHeight : 1.2}
                    onChange={(e) => selectedElementKey && selIsField && handleLineHeightChange(selectedElementKey, Number(e.target.value))}
                    disabled={!selIsField} className="flex-1 h-1 cursor-pointer disabled:opacity-40" />
                  <span className="font-mono w-7 text-right">{selIsField ? selectedField!.lineHeight.toFixed(1) : '—'}</span>
                </label>
                <span className={ribbonGroupTitle}>Spacing</span>
              </div>
            </div>
            {/* Layout — max lines, letter spacing, rotation (dynamic fields) */}
            <div className={ribbonGroup}>
              <div className="flex flex-col justify-center gap-1 px-1 min-w-[10rem]">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Max lines (wrap limit)">
                  <span className="w-[11px] text-center font-bold">¶</span>
                  <input type="number" min={1} max={10} value={selIsField ? (selectedField!.maxLines ?? 1) : 1}
                    onChange={(e) => selectedElementKey && selIsField && handleMaxLinesChange(selectedElementKey, Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    disabled={!selIsField} className="w-9 text-[10px] rounded border border-slate-300 bg-white px-1 py-0.5 text-center cursor-pointer disabled:opacity-40" />
                  <span className="font-mono w-7 text-right">{selIsField ? (selectedField!.maxLines ?? 1) : '—'}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Letter spacing (px)">
                  <span className="w-[11px] text-center font-bold tracking-tighter">Aa</span>
                  <input type="range" min={-5} max={10} step={0.5} value={selIsField ? (selectedField!.letterSpacing ?? 0) : 0}
                    onChange={(e) => selectedElementKey && selIsField && handleLetterSpacingChange(selectedElementKey, Number(e.target.value))}
                    disabled={!selIsField} className="flex-1 h-1 cursor-pointer disabled:opacity-40" />
                  <span className="font-mono w-7 text-right">{selIsField ? (selectedField!.letterSpacing ?? 0).toFixed(1) : '—'}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Rotation (degrees)">
                  <RotateCw size={11} className="shrink-0" />
                  <input type="range" min={-90} max={90} value={selIsField ? (selectedField!.rotation ?? 0) : 0}
                    onChange={(e) => selectedElementKey && selIsField && handleRotationChange(selectedElementKey, Number(e.target.value))}
                    disabled={!selIsField} className="flex-1 h-1 cursor-pointer disabled:opacity-40" />
                  <span className="font-mono w-7 text-right">{selIsField ? `${(selectedField!.rotation ?? 0).toFixed(0)}°` : '—'}</span>
                </label>
                <span className={ribbonGroupTitle}>Layout</span>
              </div>
            </div>
            {/* Arrange */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => selectedElementKey && handleLockToggle(selectedElementKey)} disabled={!selectedElementKey}
                    title="Lock / Unlock selected layer" className={ribbonBtn}>
                    {(selIsCertNo ? event.certNoConfig.isLocked : selIsQr ? event.qrConfig.isLocked : selectedField?.isLocked)
                      ? <Lock size={16} /> : <Unlock size={16} />}
                    <span className={ribbonLabel}>Lock</span>
                  </button>
                  <button onClick={() => selectedElementKey && handleVisibilityToggle(selectedElementKey)} disabled={!selectedElementKey}
                    title="Show / Hide selected layer" className={ribbonBtn}>
                    {(selIsCertNo ? event.certNoConfig.visible : selIsQr ? event.qrConfig.visible : (selectedField?.visible ?? true))
                      ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span className={ribbonLabel}>Show</span>
                  </button>
                  <button onClick={() => setSelectedElementKey(null)} disabled={!selectedElementKey} title="Deselect (Esc)" className={ribbonBtn}>
                    <X size={16} /><span className={ribbonLabel}>Clear</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Arrange</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ RIBBON — INSERT ═══════════ */}
      {!readOnly && activeTab === 'Insert' && (
        <div className="bg-slate-100/80 border-b border-slate-200 px-2 py-1.5">
          <div className="flex flex-wrap items-stretch gap-y-1">
            {/* Find field */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={traySearch}
                    onChange={(e) => setTraySearch(e.target.value)}
                    placeholder="Search Excel columns…"
                    className="w-44 text-[11px] rounded-lg border border-slate-300 bg-white pl-7 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <span className={ribbonGroupTitle}>Find field</span>
              </div>
            </div>
            {/* Excel field chips — click to place, drag onto the page */}
            <div className={ribbonGroup}>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 max-w-[26rem] overflow-x-auto pb-0.5">
                  {trayFields.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      draggable={!f.isLocked}
                      onDragStart={(e) => startFieldDrag(e, f.key)}
                      onClick={() => handleAddField(f.key)}
                      onKeyDown={(e) => handleTrayKeyNav(e, trayNavKeys)}
                      title={f.isLocked ? `${f.label} — locked, unlock it in the tray first` : `${f.label} — click to place, or drag onto the certificate`}
                      className={`shrink-0 max-w-[8rem] truncate px-2 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                        selectedElementKey === f.key
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : f.isLocked
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : isFieldPlaced(f)
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-emerald-500 cursor-grab'
                          : 'bg-white text-slate-600 border-slate-300 border-dashed hover:border-emerald-400 cursor-grab'
                      }`}
                    >
                      {f.label}{isFieldPlaced(f) ? ' ↗' : ' +'}
                    </button>
                  ))}
                  {trayFields.length === 0 && (
                    <span className="text-[11px] text-slate-500 px-1">
                      {event.fields.length === 0 ? 'Upload Excel/CSV to populate fields…' : `No match for “${traySearch}”.`}
                    </span>
                  )}
                </div>
                <span className={ribbonGroupTitle}>Excel fields — click to place · drag onto page</span>
              </div>
            </div>
            {/* Special layers */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => startFieldDrag(e, '__cert_no__')}
                    onClick={() => setSelectedElementKey('__cert_no__')}
                    title="Certificate No — click to select, drag onto the page"
                    className={ribbonBtn}
                  >
                    <Layers size={16} /><span className={ribbonLabel}>Cert-No</span>
                  </button>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => startFieldDrag(e, '__qr_code__')}
                    onClick={() => setSelectedElementKey('__qr_code__')}
                    title="QR Code — click to select, drag onto the page"
                    className={ribbonBtn}
                  >
                    <Grid3x3 size={16} /><span className={ribbonLabel}>QR Code</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Special</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ RIBBON — VIEW ═══════════ */}
      {!readOnly && activeTab === 'View' && (
        <div className="bg-slate-100/80 border-b border-slate-200 px-2 py-1.5">
          <div className="flex flex-wrap items-stretch gap-y-1">
            {/* Zoom */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={handleZoomOut} title="Zoom out" className={ribbonBtn}>
                    <ZoomOut size={16} /><span className={ribbonLabel}>Out</span>
                  </button>
                  <button onClick={handleZoomReset} title="Reset zoom to 100%"
                    className="text-[11px] font-mono font-bold text-slate-700 w-12 text-center hover:text-emerald-800 cursor-pointer rounded-md hover:bg-white">
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button onClick={handleZoomIn} title="Zoom in" className={ribbonBtn}>
                    <ZoomIn size={16} /><span className={ribbonLabel}>In</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Zoom</span>
              </div>
            </div>
            {/* Guides */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setShowGrid(!showGrid)} title="Show alignment grid + centre guides"
                    className={showGrid ? ribbonBtnActive : ribbonBtn}>
                    <Grid3x3 size={16} /><span className={ribbonLabel}>Grid</span>
                  </button>
                  <button onClick={() => setSnapToGrid(!snapToGrid)} title="Snap to grid (5% steps) — while dragging and dropping"
                    className={snapToGrid ? ribbonBtnActive : ribbonBtn}>
                    <MousePointer2 size={16} /><span className={ribbonLabel}>Snap</span>
                  </button>
                  <button onClick={() => setShowRulers((v) => !v)} title="Toggle rulers on the page edges"
                    className={showRulers ? ribbonBtnActive : ribbonBtn}>
                    <Ruler size={16} /><span className={ribbonLabel}>Ruler</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Guides</span>
              </div>
            </div>
            {/* Layers lock-all */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 px-1">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${allLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {allLocked ? '🔒 All locked' : '🔓 Editable'}
                  </span>
                  <button onClick={handleLockAxisAll} title="Lock every layer" className={ribbonBtn}>
                    <Lock size={16} /><span className={ribbonLabel}>Lock all</span>
                  </button>
                  <button onClick={handleUnlockAxisAll} title="Unlock every layer" className={ribbonBtn}>
                    <Unlock size={16} /><span className={ribbonLabel}>Unlock</span>
                  </button>
                </div>
                <span className={ribbonGroupTitle}>Layers</span>
              </div>
            </div>
            {/* Keyboard help */}
            <div className={ribbonGroup}>
              <div className="flex flex-col items-center">
                <div className="group relative">
                  <button className="flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-500 hover:bg-slate-50 cursor-pointer text-xs font-bold" title="Keyboard shortcuts">
                    ?
                  </button>
                  <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 text-white text-[11px] rounded-xl p-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <p className="font-bold mb-2 text-amber-400">Keyboard Shortcuts</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span>Undo / Redo</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">Ctrl+Z / Shift+Z</kbd></div>
                      <div className="flex justify-between"><span>Duplicate field</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">Ctrl+D</kbd></div>
                      <div className="flex justify-between"><span>Delete field</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">Del</kbd></div>
                      <div className="flex justify-between"><span>Move (1%)</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">↑↓←→</kbd></div>
                      <div className="flex justify-between"><span>Move (0.1%)</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">Shift+↑↓</kbd></div>
                      <div className="flex justify-between"><span>Tray navigation</span><kbd className="bg-slate-700 px-2 py-0.5 rounded font-mono">↑↓ + Enter</kbd></div>
                    </div>
                  </div>
                </div>
                <span className={ribbonGroupTitle}>Help</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ SELECTION BAR (contextual — Word style) ═══════════ */}
      {!readOnly && selectedElementKey && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white border-b border-slate-200 px-3 py-1.5">
          <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
            <Layers size={11} /> {selLabel}
          </span>
          {selIsQr ? (
            <span className="inline-block bg-white p-1 rounded-md border border-slate-200">
              <QRCodeSVG value={getQrVerificationUrl()} size={40} level="M" />
            </span>
          ) : (
            <span
              className="min-w-0 flex-1 truncate text-sm text-slate-700"
              style={{
                fontFamily: selIsCertNo ? (event.certNoConfig.fontFamily || 'Georgia, serif') : (selectedField?.fontFamily ?? 'Georgia, serif'),
                fontWeight: (selIsCertNo ? event.certNoConfig.isBold : selectedField?.isBold) ? 700 : 400,
                fontStyle: selectedField?.isItalic ? 'italic' : 'normal',
                letterSpacing: `${selectedField?.letterSpacing ?? 0}px`,
                textTransform: selectedField?.isUppercase ? 'uppercase' : 'none',
                color: selIsCertNo ? event.certNoConfig.color : (selectedField?.color ?? '#111827'),
              }}
            >
              {selIsCertNo
                ? cert.certificate_no
                : (selectedField ? (getProcessedText(getFieldValue(selectedField), selectedField) || `(${selectedField.label} — empty in this record)`) : '')}
            </span>
          )}
          <button onClick={() => setSelectedElementKey(null)} className="ml-auto text-slate-400 hover:text-slate-700 cursor-pointer" title="Deselect">
            <X size={14} />
          </button>
        </div>
      )}
      {/* ═══════════ WORD BODY: left tray + page ═══════════ */}
      <div className={`flex items-stretch gap-2 ${readOnly ? '' : 'p-2'}`}>
        {/* LEFT TRAY — Excel fields (click to place / drag onto the page) */}
        {!readOnly && (
          <aside className="hidden md:flex w-44 shrink-0 flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-2.5 pt-2 pb-1.5 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Excel Fields</p>
              <div className="relative mt-1.5">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={traySearch}
                  onChange={(e) => setTraySearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full text-[11px] rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-[32rem]"
              onKeyDown={(e) => handleTrayKeyNav(e, trayNavKeys)}
              role="listbox"
              aria-label="Excel fields"
            >
              {trayFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="option"
                  aria-selected={selectedElementKey === f.key}
                  draggable={!f.isLocked}
                  onDragStart={(e) => startFieldDrag(e, f.key)}
                  onClick={() => handleAddField(f.key)}
                  title={f.isLocked ? `${f.label} — locked` : `${f.label} — click to place, drag onto page`}
                  className={`w-full text-left truncate px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                    selectedElementKey === f.key
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : f.isLocked
                      ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                      : isFieldPlaced(f)
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400 cursor-grab'
                      : 'bg-white text-slate-600 border-dashed border-slate-300 hover:border-emerald-400 cursor-grab'
                  }`}
                >
                  {f.label}{isFieldPlaced(f) ? ' ↗' : ' +'}{f.isLocked ? ' 🔒' : ''}
                </button>
              ))}
              {trayFields.length === 0 && (
                <p className="text-[11px] text-slate-400 px-1 py-2">
                  {event.fields.length === 0 ? 'Upload Excel/CSV to populate fields.' : `No match for “${traySearch}”.`}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 p-1.5 grid grid-cols-2 gap-1">
              <button
                type="button"
                draggable
                onDragStart={(e) => startFieldDrag(e, '__cert_no__')}
                onClick={() => setSelectedElementKey('__cert_no__')}
                title="Cert-No — drag onto the page"
                className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-grab ${selIsCertNo ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
              >
                № Cert-No
              </button>
              <button
                type="button"
                draggable
                onDragStart={(e) => startFieldDrag(e, '__qr_code__')}
                onClick={() => setSelectedElementKey('__qr_code__')}
                title="QR — drag onto the page"
                className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-grab ${selIsQr ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
              >
                ▦ QR
              </button>
            </div>
          </aside>
        )}
        {/* PAGE COLUMN: rulers + certificate surface */}
        <div className={`relative ${dropHover && !readOnly ? 'ring-2 ring-emerald-400 rounded-xl' : ''} ${readOnly ? 'w-full' : 'flex-1 min-w-0'}`}>
          {/* Quick zoom pill (canvas par, dono modes me) */}
          <div className="absolute top-2 right-2 z-30 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-lg shadow border border-slate-200 p-0.5">
            <button onClick={handleZoomOut} className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer" title="Zoom out"><Minus size={13} /></button>
            <button onClick={handleZoomReset} className="text-[10px] font-mono font-bold text-slate-700 w-9 text-center hover:text-emerald-800 cursor-pointer" title="Reset zoom to 100%">{Math.round(zoomLevel * 100)}%</button>
            <button onClick={handleZoomIn} className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer" title="Zoom in"><Plus size={13} /></button>
          </div>
          <div className="flex gap-1 items-start">
            {showRulers && !readOnly && (
              <div
                className="w-4 self-stretch min-h-[12rem] rounded bg-white border border-slate-200 shrink-0"
                style={{ backgroundImage: 'repeating-linear-gradient(to bottom, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 10%)' }}
                aria-hidden="true"
              />
            )}
            <div className="flex-1 min-w-0">
              {showRulers && !readOnly && (
                <div
                  className="h-4 mb-1 rounded bg-white border border-slate-200"
                  style={{ backgroundImage: 'repeating-linear-gradient(to right, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 5%)' }}
                  aria-hidden="true"
                />
              )}
              {/* Certificate Surface */}
              <div className="w-full overflow-auto rounded-2xl border border-gray-200 bg-slate-100 p-3">
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }} className="mx-auto w-fit transition-transform">
                  <div
                    ref={containerRef}
                    onClick={() => { if (!readOnly) setSelectedElementKey(null); }}
                    onDragOver={(e) => {
                      const isFieldDrag = Array.from(e.dataTransfer.types).includes('application/x-skuastk-certificate-field');
                      if (readOnly || !isFieldDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropHover(true);
                    }}
                    onDragLeave={(e) => {
                      if (readOnly) return;
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropHover(false);
                    }}
                    onDrop={(e) => {
                      const key = e.dataTransfer.getData('application/x-skuastk-certificate-field');
                      setDropHover(false);
                      if (readOnly || !key) return;
                      e.preventDefault();
                      e.stopPropagation();
                      placeFieldFromDrop(key, e.clientX, e.clientY);
                    }}
                    className="relative bg-white shadow-lg overflow-hidden select-none"
                    style={{ width: '1123px', maxWidth: '100%', aspectRatio: '1.414 / 1' }}
                  >
                    {/* Added select-none only to canvas - inspector panel allows text selection */}
                    {/* NEW: Grid Overlay for alignment */}
                    {showGrid && !readOnly && (
                      <div className="absolute inset-0 z-10 pointer-events-none" style={{
                        backgroundImage: `
                          linear-gradient(to right, rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: '5% 5%'
                      }} />
                    )}
                    {/* NEW: Center alignment guides */}
                    {showGrid && !readOnly && (
                      <>
                        <div className="absolute inset-y-0 left-1/2 w-px bg-rose-400/50 z-10 pointer-events-none" />
                        <div className="absolute inset-x-0 top-1/2 h-px bg-rose-400/50 z-10 pointer-events-none" />
                      </>
                    )}
                    {event.templateUrl ? (
                      <img src={event.templateUrl} alt="Certificate template" className="absolute inset-0 w-full h-full object-fill" draggable={false} crossOrigin="anonymous" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                        <p className="text-xs text-slate-400">Upload a template to preview the design</p>
                      </div>
                    )}
                    {event.fields.filter(f => f.visible && isFieldPlaced(f)).map(field => {
                      // Resolve the stored source reference against the active row only while rendering.
                      const raw = getFieldValue(field);
                      // Khali value par admin ko layer dikhe (placeholder), taaki select/edit ho sake.
                      // Export/PDF me placeholder nahi jayega — waha raw empty = render skip (neeche).
                      const isEmpty = !raw;
                      const text = isEmpty ? `[${field.label}]` : getProcessedText(raw, field);
                      const isSel = selectedElementKey === field.key;
                      const locked = !!field.isLocked;
                      return (
                        <div
                          key={field.key}
                          onMouseDown={(e) => handleMouseDown(field.key, e)}
                          className={`absolute ${readOnly ? '' : locked ? 'cursor-not-allowed' : 'cursor-move'} ${isSel && !readOnly ? 'ring-2 ring-amber-400 rounded' : ''} ${isEmpty && !readOnly ? 'outline outline-1 outline-dashed outline-slate-300 rounded' : ''}`}
                          style={{
                            left: `${field.x}%`, top: `${field.y}%`,
                            // Tight hit-box: box text ke content jitna hi ho (maxWidth cap ke saath),
                            // taaki click karne par poora 60% chauda invisible box select na ho.
                            // inline-block + maxWidth se chhota text = chhota selectable area.
                            // Khali placeholder par min-width taaki khaali field bhi pakdi ja sake.
                            display: (field.maxLines ?? 1) > 1 ? '-webkit-box' : 'inline-block',
                            width: (field.maxLines ?? 1) > 1 ? `${getFieldWidthPercent(field.maxWidth)}%` : 'fit-content',
                            maxWidth: `${getFieldWidthPercent(field.maxWidth)}%`,
                            minWidth: isEmpty && !readOnly ? '3rem' : undefined,
                            transform: `translate(-50%, -50%) rotate(${field.rotation ?? 0}deg)`,
                            textAlign: field.align, color: isEmpty ? '#94a3b8' : field.color, fontFamily: field.fontFamily,
                            fontSize: `${field.fontSize}px`, fontWeight: field.isBold ? 700 : 400,
                            fontStyle: field.isItalic ? 'italic' : 'normal',
                            // Single-line fields hug the text tightly (no extra leading that would
                            // make the selection box taller than the glyphs); multi-line fields keep
                            // their configured line spacing. Applied in every mode so editor == export.
                            lineHeight: (field.maxLines ?? 1) > 1 ? field.lineHeight : 1.2,
                            letterSpacing: `${field.letterSpacing ?? 0}px`,
                            wordBreak: 'break-word', overflow: 'hidden',
                            WebkitLineClamp: field.maxLines ?? 1,
                            WebkitBoxOrient: 'vertical' as const, userSelect: 'none',
                            opacity: isEmpty && readOnly ? 0 : 1,
                          }}
                          title={readOnly ? field.label : locked ? `${field.label} — locked (unlock to edit)` : `${field.label} — drag to position`}
                        >
                          {!isEmpty ? text : ''}
                        </div>
                      );
                    })}
                    {event.certNoConfig.visible && (
                      <div
                        onMouseDown={(e) => handleMouseDown('__cert_no__', e)}
                        className={`absolute ${readOnly ? '' : 'cursor-move'} ${selectedElementKey === '__cert_no__' && !readOnly ? 'ring-2 ring-amber-400 rounded' : ''}`}
                        style={{
                          left: `${event.certNoConfig.x}%`, top: `${event.certNoConfig.y}%`,
                          transform: 'translate(-50%, -50%)', color: event.certNoConfig.color,
                          fontFamily: event.certNoConfig.fontFamily || 'Georgia, serif',
                          fontSize: `${event.certNoConfig.fontSize}px`,
                          fontWeight: event.certNoConfig.isBold ? 700 : 400, userSelect: 'none',
                        }}
                        title={readOnly ? 'Certificate No' : 'Certificate No — drag to position'}
                      >
                        {cert.certificate_no}
                      </div>
                    )}
                    {event.qrConfig.visible && (
                      <div
                        onMouseDown={(e) => handleMouseDown('__qr_code__', e)}
                        className={`absolute ${readOnly ? '' : 'cursor-move'} ${selectedElementKey === '__qr_code__' && !readOnly ? 'ring-2 ring-amber-400 rounded' : ''}`}
                        style={{
                          left: `${event.qrConfig.x}%`, top: `${event.qrConfig.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${event.qrConfig.size}px`, height: `${event.qrConfig.size}px`,
                          background: '#fff', padding: '4px', userSelect: 'none',
                        }}
                        title={readOnly ? 'QR Code' : 'QR Code — drag to position'}
                      >
                        <QRCodeSVG value={getQrVerificationUrl()} size={event.qrConfig.size - 8} level="M" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
            {/* QR Size */}
            {!readOnly && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-bold text-slate-500">QR Size</span>
                <input
                  type="range" min={40} max={220} value={event.qrConfig.size}
                  onChange={(e) => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, size: Number(e.target.value) } })}
                  className="w-24 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-600">{event.qrConfig.size}px</span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
