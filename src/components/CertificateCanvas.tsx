import React, { useRef, useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { QRCodeSVG } from 'qrcode.react';
import { getVerifyUrl } from '../lib/shareUrl';
import {
  getFieldWidthPercent, isFieldPlaced, resolveFieldValue
} from '../lib/certificateFields';
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Palette, Type,
  X, Lock, Unlock, ZoomIn, ZoomOut, Download, Loader2, Eye, EyeOff
} from 'lucide-react';

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

export const CertificateCanvas: React.FC<Props> = ({ event, cert, onUpdateEvent, readOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

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

  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    // Locked layer select ho sakta hai (inspector dikhe) par drag nahi hoga.
    setSelectedElementKey(key);
    if (isLockedKey(key)) return;
    setDraggingKey(key);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingKey || !containerRef.current || !onUpdateEvent) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0, Math.min(100, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));
    if (draggingKey === '__cert_no__') {
      onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x, y } });
    } else if (draggingKey === '__qr_code__') {
      onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x, y } });
    } else {
      const updatedFields = event.fields.map(f => f.key === draggingKey ? { ...f, x, y } : f);
      onUpdateEvent({ ...event, fields: updatedFields });
    }
  }, [draggingKey, event, onUpdateEvent]);

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
    const field = event.fields.find((item) => item.key === key);
    if (!field || !containerRef.current || field.isLocked) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Number((((clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0, Math.min(100, Number((((clientY - rect.top) / rect.height) * 100).toFixed(2))));
    updateField(key, { x, y, isPlaced: true });
    setSelectedElementKey(key);
  };

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
    try {
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
      alert('Certificate export fail ho gaya. Please try again.');
    } finally {
      setSelectedElementKey(prevSelected);
      setIsExporting(false);
    }
  };

  return (
    <div className="relative w-full select-none">
      {/* Live Edit Preview — selected layer ka actual text, bara + proper distance par */}
      {!readOnly && selectedElementKey && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">
            Live Preview — {selectedElementKey === '__cert_no__' ? 'Certificate No' : selectedElementKey === '__qr_code__' ? 'QR Code' : (selectedField?.label || selectedElementKey)}
          </p>
          {selectedElementKey === '__qr_code__' ? (
            <div className="inline-block bg-white p-1.5 rounded-lg border border-amber-200">
              <QRCodeSVG value={getQrVerificationUrl()} size={64} level="M" />
            </div>
          ) : (
            <p
              className="break-words"
              style={{
                fontFamily: selectedElementKey === '__cert_no__'
                  ? (event.certNoConfig.fontFamily || 'Georgia, serif')
                  : (selectedField?.fontFamily ?? 'Georgia, serif'),
                fontSize: `${Math.min(34, Math.max(16, selectedElementKey === '__cert_no__' ? event.certNoConfig.fontSize : (selectedField?.fontSize ?? 16)))}px`,
                fontWeight: (selectedElementKey === '__cert_no__' ? event.certNoConfig.isBold : selectedField?.isBold) ? 700 : 400,
                fontStyle: selectedField?.isItalic ? 'italic' : 'normal',
                letterSpacing: `${selectedField?.letterSpacing ?? 0}px`,
                textTransform: selectedField?.isUppercase ? 'uppercase' : 'none',
                textAlign: (selectedField?.align as any) || 'left',
                color: selectedElementKey === '__cert_no__' ? event.certNoConfig.color : (selectedField?.color ?? '#111827'),
                lineHeight: selectedField?.lineHeight ?? 1.4,
              }}
            >
              {selectedElementKey === '__cert_no__'
                ? cert.certificate_no
                : (selectedField ? (getProcessedText(getFieldValue(selectedField), selectedField) || `(${selectedField.label} — is record me khali)`) : '')}
            </p>
          )}
        </div>
      )}

      {/* Zoom + Lock Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-200 p-1">
        <button onClick={handleZoomOut} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><ZoomOut size={15} /></button>
        <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"><ZoomIn size={15} /></button>
      </div>
      {!readOnly && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-200 px-3 py-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${event.fields.every(f => f.isLocked) && event.qrConfig.isLocked && event.certNoConfig.isLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {event.fields.every(f => f.isLocked) && event.qrConfig.isLocked && event.certNoConfig.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
          </span>
          <button onClick={handleLockAxisAll} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer">
            <Lock size={12} /> Lock All
          </button>
          <button onClick={handleUnlockAxisAll} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">
            <Unlock size={12} /> Unlock All
          </button>
        </div>
      )}

      {/* Inspector Ribbon (canvas ke UPAR docked — editing ab proper distance par dikhegi) */}
      {!readOnly && selectedElementKey && (
        <div className="relative z-20 bg-white rounded-2xl shadow border border-gray-200 p-3 mb-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Inspector — {selectedElementKey === '__cert_no__' ? 'Certificate No' : selectedElementKey === '__qr_code__' ? 'QR Code' : (selectedField?.label || selectedElementKey)}
            </span>
            <button onClick={() => setSelectedElementKey(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={14} /></button>
          </div>

          {selectedElementKey !== '__qr_code__' && (
            <div className="flex items-center gap-2">
              <Type size={13} className="text-slate-400 shrink-0" />
              <select
                value={selectedElementKey === '__cert_no__' ? (event.certNoConfig.fontFamily || 'Georgia, serif') : (selectedField?.fontFamily ?? 'Georgia, serif')}
                onChange={(e) => handleFontFamilyChange(selectedElementKey!, e.target.value)}
                className="flex-1 text-[11px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 cursor-pointer"
              >
                {CERT_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          )}

          {selectedElementKey !== '__qr_code__' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-10 shrink-0">Size</span>
              <input
                type="number" min={6} max={120}
                value={selectedElementKey === '__cert_no__' ? event.certNoConfig.fontSize : (selectedField?.fontSize ?? 14)}
                onChange={(e) => handleFontSizeChange(selectedElementKey!, Number(e.target.value))}
                className="w-16 text-[11px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right cursor-pointer"
              />
            </div>
          )}

          {selectedElementKey !== '__qr_code__' && (
            <div className="flex items-center gap-2">
              <Palette size={13} className="text-slate-400 shrink-0" />
              <input
                type="color"
                value={selectedElementKey === '__cert_no__' ? event.certNoConfig.color : (selectedField?.color ?? '#111827')}
                onChange={(e) => handleColorChange(selectedElementKey!, e.target.value)}
                className="w-8 h-7 rounded border border-gray-200 cursor-pointer bg-white p-0.5"
              />
              <span className="text-[11px] font-mono text-slate-600">{selectedElementKey === '__cert_no__' ? event.certNoConfig.color : (selectedField?.color ?? '#111827')}</span>
            </div>
          )}

          {selectedElementKey !== '__qr_code__' && (
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => handleToggleBold(selectedElementKey!)} className={`p-1.5 rounded-lg ${selectedElementKey === '__cert_no__' ? (event.certNoConfig.isBold ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100') : (selectedField?.isBold ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100')} cursor-pointer`}>
                <Bold size={15} />
              </button>
              <button onClick={() => handleToggleItalic(selectedElementKey!)} disabled={selectedElementKey === '__cert_no__'} className={`p-1.5 rounded-lg disabled:opacity-30 ${selectedField?.isItalic ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'} cursor-pointer`}>
                <Italic size={15} />
              </button>
              <button onClick={() => handleToggleUppercase(selectedElementKey!)} disabled={selectedElementKey === '__cert_no__'} className={`p-1.5 rounded-lg disabled:opacity-30 ${selectedField?.isUppercase ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'} cursor-pointer`}>
                <span className="text-[11px] font-bold">AA</span>
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {(['left', 'center', 'right'] as const).map(a => (
                <button key={a} onClick={() => handleAlignChange(selectedElementKey!, a)} disabled={selectedElementKey === '__cert_no__'} className={`p-1.5 rounded-lg disabled:opacity-30 ${selectedField?.align === a ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'} cursor-pointer`} title={a}>
                  {a === 'left' ? <AlignLeft size={15} /> : a === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}
                </button>
              ))}
            </div>
          )}

          {selectedField && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 shrink-0">Width</span>
                <input type="range" min={0} max={100} value={getFieldWidthPercent(selectedField.maxWidth)} onChange={(e) => handleMaxWidthChange(selectedElementKey!, Number(e.target.value))} className="flex-1 cursor-pointer" />
                <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{getFieldWidthPercent(selectedField.maxWidth)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 shrink-0">LHeight</span>
                <input type="range" min={0.8} max={3} step={0.1} value={selectedField.lineHeight} onChange={(e) => handleLineHeightChange(selectedElementKey!, Number(e.target.value))} className="flex-1 cursor-pointer" />
                <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{selectedField.lineHeight.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 shrink-0">MaxLines</span>
                <input type="number" min={1} max={10} value={selectedField.maxLines ?? 1} onChange={(e) => handleMaxLinesChange(selectedElementKey!, Number(e.target.value))} className="w-14 text-[11px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center cursor-pointer" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 shrink-0">Spacing</span>
                <input type="range" min={-5} max={10} step={0.5} value={selectedField.letterSpacing ?? 0} onChange={(e) => handleLetterSpacingChange(selectedElementKey!, Number(e.target.value))} className="flex-1 cursor-pointer" />
                <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{(selectedField.letterSpacing ?? 0).toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 shrink-0">Rotate</span>
                <input type="range" min={-90} max={90} value={selectedField.rotation ?? 0} onChange={(e) => handleRotationChange(selectedElementKey!, Number(e.target.value))} className="flex-1 cursor-pointer" />
                <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{(selectedField.rotation ?? 0).toFixed(0)}°</span>
              </div>
            </div>
          )}

          {/* Lock + Visibility */}
          <div className="border-t border-gray-100 pt-1.5 flex items-center gap-1">
            <button
              onClick={() => handleLockToggle(selectedElementKey!)}
              className={`p-1.5 rounded-lg ${(selectedElementKey === '__cert_no__' ? event.certNoConfig.isLocked : selectedElementKey === '__qr_code__' ? event.qrConfig.isLocked : selectedField?.isLocked) ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'} cursor-pointer`}
              title="Lock / Unlock"
            >
              {(selectedElementKey === '__cert_no__' ? event.certNoConfig.isLocked : selectedElementKey === '__qr_code__' ? event.qrConfig.isLocked : selectedField?.isLocked) ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            <button
              onClick={() => handleVisibilityToggle(selectedElementKey!)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Show / Hide"
            >
              {(selectedElementKey === '__cert_no__' ? event.certNoConfig.visible : selectedElementKey === '__qr_code__' ? event.qrConfig.visible : (selectedField?.visible ?? true)) ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <span className="text-[10px] ml-auto text-slate-400">Drag = move</span>
          </div>
        </div>
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
            }}
            onDrop={(e) => {
              const key = e.dataTransfer.getData('application/x-skuastk-certificate-field');
              if (readOnly || !key) return;
              e.preventDefault();
              e.stopPropagation();
              placeFieldFromDrop(key, e.clientX, e.clientY);
            }}
            className="relative bg-white shadow-lg overflow-hidden"
            style={{ width: '1123px', maxWidth: '100%', aspectRatio: '1.414 / 1' }}
          >
            {event.templateUrl ? (
              <img src={event.templateUrl} alt="Certificate template" className="absolute inset-0 w-full h-full object-fill" draggable={false} crossOrigin="anonymous" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <p className="text-xs text-slate-400">Template upload karein — blank preview</p>
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
                    left: `${field.x}%`, top: `${field.y}%`, width: `${getFieldWidthPercent(field.maxWidth)}%`,
                    transform: `translate(-50%, -50%) rotate(${field.rotation ?? 0}deg)`,
                    textAlign: field.align, color: isEmpty ? '#94a3b8' : field.color, fontFamily: field.fontFamily,
                    fontSize: `${field.fontSize}px`, fontWeight: field.isBold ? 700 : 400,
                    fontStyle: field.isItalic ? 'italic' : 'normal',
                    lineHeight: field.lineHeight, letterSpacing: `${field.letterSpacing ?? 0}px`,
                    wordBreak: 'break-word', overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: field.maxLines ?? 1,
                    WebkitBoxOrient: 'vertical' as const, userSelect: 'none',
                    opacity: isEmpty && readOnly ? 0 : 1,
                  }}
                  title={readOnly ? field.label : locked ? `${field.label} — locked hai (Unlock karo)` : `${field.label} — drag karein`}
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
                title={readOnly ? 'Certificate No' : 'Certificate No — drag karein'}
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
                title={readOnly ? 'QR Code' : 'QR Code — drag karein'}
              >
                <QRCodeSVG value={getQrVerificationUrl()} size={event.qrConfig.size - 8} level="M" />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Dynamic fields detected from the uploaded sheet */}
      {!readOnly && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Dynamic Data Fields</span>
            <span className="text-[10px] text-slate-500">Drag a field onto the certificate</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {event.fields.map((field) => (
              <button
                key={field.key}
                type="button"
                draggable={!field.isLocked}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-skuastk-certificate-field', field.key);
                  e.dataTransfer.setData('text/plain', field.key);
                }}
                onClick={() => setSelectedElementKey(field.key)}
                title={field.isLocked ? `${field.label} — locked hai pehle unlock karein` : `${field.label} — drag karein`}
                className={`max-w-full break-words px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-grab active:cursor-grabbing ${
                  selectedElementKey === field.key
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-white text-slate-600 border-gray-200 hover:border-emerald-300'
                } ${field.isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {field.label}{isFieldPlaced(field) ? ' ↗' : ''}{field.isLocked ? ' 🔒' : ''}
              </button>
            ))}
            {event.fields.length === 0 && (
              <span className="text-[11px] text-slate-500">Upload Excel/CSV to populate dynamic fields.</span>
            )}
          </div>
        </div>
      )}
      {/* Existing layer selector; dynamic palette above keeps uploaded fields separate. */}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedElementKey('__cert_no__')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${selectedElementKey === '__cert_no__' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-gray-200 hover:border-emerald-300'}`}
          >
            Cert-No{event.certNoConfig.isLocked ? ' 🔒' : ''}
          </button>
          <button
            onClick={() => setSelectedElementKey('__qr_code__')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${selectedElementKey === '__qr_code__' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-gray-200 hover:border-emerald-300'}`}
          >
            QR{event.qrConfig.isLocked ? ' 🔒' : ''}
          </button>
        </div>
      )}
      {/* QR Size + Export */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleExportCanvas('png')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PNG
          </button>
          <button
            onClick={() => handleExportCanvas('pdf')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Official PDF
          </button>
        </div>
      </div>
    </div>
  );
};
