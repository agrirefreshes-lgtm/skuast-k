import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Palette, 
  Type, 
  X, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Lock,
  Unlock,
  AlignCenterHorizontal,
  AlignCenterVertical,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2
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
  const imgRef = useRef<HTMLImageElement>(null);

  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Smooth Live Mouse Dragging State
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const getQrVerificationUrl = () => {
    const basePath = window.location.href.split('#')[0].replace(/\/+$/, '');
    return `${basePath}/#/verify?id=${encodeURIComponent(cert.certificate_no)}`;
  };

  // Mouse Drag Logic (Smooth and Pixel-Accurate, No native drag-ghost issues)
  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    // Check lock
    if (key === '__cert_no__' && event.certNoConfig.isLocked) return;
    if (key === '__qr_code__' && event.qrConfig.isLocked) return;
    const field = event.fields.find(f => f.key === key);
    if (field && field.isLocked) return;

    setSelectedElementKey(key);
    setDraggingKey(key);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingKey || !containerRef.current || !onUpdateEvent) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0, Math.min(100, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));

    if (draggingKey === '__cert_no__') {
      onUpdateEvent({
        ...event,
        certNoConfig: { ...event.certNoConfig, x, y }
      });
    } else if (draggingKey === '__qr_code__') {
      onUpdateEvent({
        ...event,
        qrConfig: { ...event.qrConfig, x, y }
      });
    } else {
      const updatedFields = event.fields.map(f =>
        f.key === draggingKey ? { ...f, x, y } : f
      );
      onUpdateEvent({ ...event, fields: updatedFields });
    }
  }, [draggingKey, event, onUpdateEvent]);

  const handleMouseUp = useCallback(() => {
    setDraggingKey(null);
  }, []);

  useEffect(() => {
    if (draggingKey) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingKey, handleMouseMove, handleMouseUp]);

  const selectedField = event.fields.find(f => f.key === selectedElementKey);

  const updateSelectedField = (updates: Partial<DynamicFieldDef>) => {
    if (!onUpdateEvent || !selectedElementKey) return;
    const updatedFields = event.fields.map(f =>
      f.key === selectedElementKey ? { ...f, ...updates } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  // 100% Crisp High-Res Export (Matching Coordinates Exactly)
  const handleDownloadHighRes = async () => {
    if (!imgRef.current) return;
    setIsExporting(true);

    try {
      const naturalWidth = imgRef.current.naturalWidth || 1920;
      const naturalHeight = imgRef.current.naturalHeight || 1080;

      const offscreen = document.createElement('canvas');
      offscreen.width = naturalWidth;
      offscreen.height = naturalHeight;
      const ctx = offscreen.getContext('2d');

      if (!ctx) throw new Error('Failed to create canvas context');

      // 1. Draw Template
      ctx.drawImage(imgRef.current, 0, 0, naturalWidth, naturalHeight);

      // Baseline scale
      const scale = naturalWidth / 1000;

      // 2. Draw Dynamic Text Fields
      event.fields.filter(f => f.visible).forEach((field) => {
        const textValue = cert.data[field.label] || cert.data[field.key] || '';
        if (!textValue) return;

        const fontSizePx = (field.fontSize || 18) * scale;
        const fontStyle = field.isItalic ? 'italic' : 'normal';
        const fontWeight = field.isBold ? 'bold' : 'normal';
        const fontFamily = field.fontFamily || 'Georgia, serif';

        ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
        ctx.fillStyle = field.color || '#111827';
        ctx.textAlign = (field.align as CanvasTextAlign) || 'center';
        ctx.textBaseline = 'middle';

        const posX = (field.x / 100) * naturalWidth;
        const posY = (field.y / 100) * naturalHeight;

        const textOutput = field.isUppercase ? String(textValue).toUpperCase() : String(textValue);
        ctx.fillText(textOutput, posX, posY);
      });

      // 3. Draw Certificate Number
      if (event.certNoConfig.visible) {
        const cConfig = event.certNoConfig;
        const cFontSize = (cConfig.fontSize || 14) * scale;
        ctx.font = `${cConfig.isBold ? 'bold' : 'normal'} ${cFontSize}px monospace`;
        ctx.fillStyle = cConfig.color || '#111827';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const cX = (cConfig.x / 100) * naturalWidth;
        const cY = (cConfig.y / 100) * naturalHeight;
        ctx.fillText(cert.certificate_no, cX, cY);
      }

      // 4. Draw QR Code from SVG
      if (event.qrConfig.visible) {
        const svgElement = document.getElementById('cert-qr-code-svg');
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const URL = window.URL || window.webkitURL || window;
          const blobURL = URL.createObjectURL(svgBlob);

          await new Promise<void>((resolve) => {
            const qrImg = new Image();
            qrImg.onload = () => {
              const qrSize = (event.qrConfig.size || 80) * scale;
              const qrX = (event.qrConfig.x / 100) * naturalWidth - qrSize / 2;
              const qrY = (event.qrConfig.y / 100) * naturalHeight - qrSize / 2;
              ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
              URL.revokeObjectURL(blobURL);
              resolve();
            };
            qrImg.src = blobURL;
          });
        }
      }

      // 5. Download PNG
      const link = document.createElement('a');
      link.download = `${cert.certificate_no.replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_Certificate.png`;
      link.href = offscreen.toDataURL('image/png', 1.0);
      link.click();
    } catch (err: any) {
      alert('Certificate download failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col border border-slate-700/80 rounded-2xl bg-slate-950 shadow-2xl overflow-hidden select-none">
      
      {/* 1. TOP TOOLBAR WITH BIG, CLEAR BUTTONS */}
      {!readOnly && (
        <div className="sticky top-0 z-30 bg-[#0d131f] border-b border-slate-800 shadow-lg">
          
          {/* Layer Selector Bar + Zoom Controls */}
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            
            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
              <span className="text-xs font-black tracking-wider text-amber-400 shrink-0 mr-1">
                LAYERS:
              </span>

              {event.fields.filter(f => f.visible).map((f) => (
                <div key={f.key} className="inline-flex items-center rounded-xl overflow-hidden border border-slate-700 shadow shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey(f.key)}
                    className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      selectedElementKey === f.key
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedFields = event.fields.map(field =>
                        field.key === f.key ? { ...field, isLocked: !field.isLocked } : field
                      );
                      onUpdateEvent?.({ ...event, fields: updatedFields });
                    }}
                    title={f.isLocked ? "Layer Locked" : "Click to Lock"}
                    className={`px-2 py-1.5 text-xs cursor-pointer border-l border-slate-700 ${
                      f.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              ))}

              {event.certNoConfig.visible && (
                <div className="inline-flex items-center rounded-xl overflow-hidden border border-slate-700 shadow shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey('__cert_no__')}
                    className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      selectedElementKey === '__cert_no__'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    Cert No
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({
                      ...event,
                      certNoConfig: { ...event.certNoConfig, isLocked: !event.certNoConfig.isLocked }
                    })}
                    className={`px-2 py-1.5 text-xs cursor-pointer border-l border-slate-700 ${
                      event.certNoConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {event.certNoConfig.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              )}

              {event.qrConfig.visible && (
                <div className="inline-flex items-center rounded-xl overflow-hidden border border-slate-700 shadow shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey('__qr_code__')}
                    className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      selectedElementKey === '__qr_code__'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({
                      ...event,
                      qrConfig: { ...event.qrConfig, isLocked: !event.qrConfig.isLocked }
                    })}
                    className={`px-2 py-1.5 text-xs cursor-pointer border-l border-slate-700 ${
                      event.qrConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {event.qrConfig.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              )}
            </div>

            {/* Zoom Controls & 300DPI Sample Export */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(0.6, Number((prev - 0.1).toFixed(2))))}
                  className="p-1 text-slate-300 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="px-2 font-mono font-bold text-amber-400 text-xs">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
                  className="p-1 text-slate-300 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadHighRes}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>Sample High-Res</span>
              </button>
            </div>

          </div>

          {/* Ribbon Controls For Selected Field */}
          {(selectedField || selectedElementKey === '__cert_no__' || selectedElementKey === '__qr_code__') && (
            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                
                {/* Font Selector (Only for Text Fields) */}
                {selectedField && (
                  <div className="flex items-center bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                    <Type size={15} className="text-emerald-400 mr-1.5" />
                    <select
                      value={selectedField.fontFamily || 'Georgia, serif'}
                      onChange={(e) => updateSelectedField({ fontFamily: e.target.value })}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      {CERT_FONTS.map(f => (
                        <option key={f.value} value={f.value} className="bg-slate-900 text-white">
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Size Steppers (For Text, Cert No, and QR Code) */}
                <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ fontSize: Math.max(9, (selectedField.fontSize || 18) - 1) });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: Math.max(9, (event.certNoConfig.fontSize || 14) - 1) } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, size: Math.max(20, (event.qrConfig.size || 80) - 2) } });
                    }}
                    className="px-3 py-1.5 hover:bg-slate-800 text-white font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="px-2 text-amber-400 font-mono font-black text-xs min-w-[3rem] text-center">
                    {selectedField ? `${selectedField.fontSize || 18}px` : selectedElementKey === '__cert_no__' ? `${event.certNoConfig.fontSize || 14}px` : `${event.qrConfig.size || 80}px`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ fontSize: (selectedField.fontSize || 18) + 1 });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: (event.certNoConfig.fontSize || 14) + 1 } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, size: (event.qrConfig.size || 80) + 2 } });
                    }}
                    className="px-3 py-1.5 hover:bg-slate-800 text-white font-bold text-sm"
                  >
                    +
                  </button>
                </div>

                {/* Center Helpers (For all) */}
                <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ x: 50 });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: 50 } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: 50 } });
                    }}
                    className="px-2.5 py-1 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-amber-400 font-bold text-[11px] flex items-center gap-1"
                  >
                    <AlignCenterHorizontal size={14} /> Center X
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ y: 50 });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, y: 50 } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, y: 50 } });
                    }}
                    className="px-2.5 py-1 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-amber-400 font-bold text-[11px] flex items-center gap-1"
                  >
                    <AlignCenterVertical size={14} /> Center Y
                  </button>
                </div>

                {/* Bold & Italic (Only Text and Cert No) */}
                {(selectedField || selectedElementKey === '__cert_no__') && (
                  <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedField) updateSelectedField({ isBold: !selectedField.isBold });
                        else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, isBold: !event.certNoConfig.isBold } });
                      }}
                      className={`px-3 py-1 rounded-lg font-black ${
                        (selectedField && selectedField.isBold) || (selectedElementKey === '__cert_no__' && event.certNoConfig.isBold)
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300'
                      }`}
                    >
                      <Bold size={14} />
                    </button>
                    {selectedField && (
                      <button
                        type="button"
                        onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                        className={`px-3 py-1 rounded-lg ${selectedField.isItalic ? 'bg-amber-400 text-slate-950' : 'text-slate-300'}`}
                      >
                        <Italic size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Align (Only Text Fields) */}
                {selectedField && (
                  <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ align: 'left' })}
                      className={`p-1.5 rounded-lg ${selectedField.align === 'left' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      <AlignLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ align: 'center' })}
                      className={`p-1.5 rounded-lg ${selectedField.align === 'center' || !selectedField.align ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      <AlignCenter size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ align: 'right' })}
                      className={`p-1.5 rounded-lg ${selectedField.align === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      <AlignRight size={14} />
                    </button>
                  </div>
                )}

                {/* Color (Text and Cert No) */}
                {(selectedField || selectedElementKey === '__cert_no__') && (
                  <label className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 cursor-pointer">
                    <Palette size={15} className="text-amber-400" />
                    <input
                      type="color"
                      value={selectedField ? (selectedField.color || '#111827') : (event.certNoConfig.color || '#111827')}
                      onChange={(e) => {
                        if (selectedField) updateSelectedField({ color: e.target.value });
                        else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, color: e.target.value } });
                      }}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>
                )}

                {/* Nudge D-Pad (For all) */}
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ x: Math.max(0, Number((selectedField.x - 0.2).toFixed(2))) });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.max(0, Number((event.certNoConfig.x - 0.2).toFixed(2))) } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Math.max(0, Number((event.qrConfig.x - 0.2).toFixed(2))) } });
                    }}
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ y: Math.max(0, Number((selectedField.y - 0.2).toFixed(2))) });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.max(0, Number((event.certNoConfig.y - 0.2).toFixed(2))) } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, y: Math.max(0, Number((event.qrConfig.y - 0.2).toFixed(2))) } });
                    }}
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ y: Math.min(100, Number((selectedField.y + 0.2).toFixed(2))) });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.min(100, Number((event.certNoConfig.y + 0.2).toFixed(2))) } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, y: Math.min(100, Number((event.qrConfig.y + 0.2).toFixed(2))) } });
                    }}
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedField) updateSelectedField({ x: Math.min(100, Number((selectedField.x + 0.2).toFixed(2))) });
                      else if (selectedElementKey === '__cert_no__' && onUpdateEvent) onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.min(100, Number((event.certNoConfig.x + 0.2).toFixed(2))) } });
                      else if (selectedElementKey === '__qr_code__' && onUpdateEvent) onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Math.min(100, Number((event.qrConfig.x + 0.2).toFixed(2))) } });
                    }}
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>

              </div>

              <button
                type="button"
                onClick={() => setSelectedElementKey(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
          )}

        </div>
      )}

      {/* 2. THE WORKSPACE - 100% ZERO BLUE BOXES, TRUE TRANSPARENT BACKGROUND */}
      <div className="w-full p-6 md:p-10 bg-[#070b12] flex items-center justify-center overflow-auto min-h-[580px]">
        <div 
          className="transition-transform duration-100 ease-out origin-center flex items-center justify-center shadow-2xl p-1"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <div
            ref={containerRef}
            className="relative w-[950px] aspect-[1.414/1] bg-white shadow-2xl rounded-sm overflow-hidden select-none border border-slate-700 shrink-0"
          >
            {/* Template Image Base */}
            <img 
              ref={imgRef}
              src={event.templateUrl}
              alt="Template"
              crossOrigin="anonymous"
              className="w-full h-full object-fill pointer-events-none block"
            />

            {/* Dynamic Text Fields */}
            {event.fields.filter(f => f.visible).map((field) => {
              const textValue = cert.data[field.label] || cert.data[field.key] || '';
              if (!textValue) return null;
              const isSelected = selectedElementKey === field.key;
              const isDraggable = !readOnly && !field.isLocked;

              return (
                <div
                  key={field.key}
                  onMouseDown={(e) => isDraggable && handleMouseDown(field.key, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!readOnly) setSelectedElementKey(field.key);
                  }}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 leading-normal transition-shadow ${
                    !readOnly
                      ? `${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                          isSelected ? 'ring-2 ring-amber-400 ring-offset-2 rounded px-1.5' : 'hover:ring-1 hover:ring-amber-300/60'
                        }`
                      : ''
                  }`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    fontSize: `${field.fontSize || 18}px`,
                    color: field.color || '#111827',
                    fontFamily: field.fontFamily || 'Georgia, serif',
                    fontWeight: field.isBold ? 'bold' : 'normal',
                    fontStyle: field.isItalic ? 'italic' : 'normal',
                    textTransform: field.isUppercase ? 'uppercase' : 'none',
                    textAlign: (field.align || 'center') as any,
                    backgroundColor: 'transparent', // STRICT NO BLUE BOX
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                  }}
                >
                  {textValue}
                </div>
              );
            })}

            {/* Certificate Number */}
            {event.certNoConfig.visible && (
              <div
                onMouseDown={(e) => !event.certNoConfig.isLocked && handleMouseDown('__cert_no__', e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setSelectedElementKey('__cert_no__');
                }}
                className={`absolute transform -translate-y-1/2 ${
                  !readOnly
                    ? `${!event.certNoConfig.isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                        selectedElementKey === '__cert_no__' ? 'ring-2 ring-amber-400 rounded px-1' : ''
                      }`
                    : ''
                }`}
                style={{
                  left: `${event.certNoConfig.x}%`,
                  top: `${event.certNoConfig.y}%`,
                  fontSize: `${event.certNoConfig.fontSize || 14}px`,
                  color: event.certNoConfig.color || '#111827',
                  fontWeight: event.certNoConfig.isBold ? 'bold' : 'normal',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'transparent'
                }}
              >
                {cert.certificate_no}
              </div>
            )}

            {/* QR Code */}
            {event.qrConfig.visible && (
              <div
                onMouseDown={(e) => !event.qrConfig.isLocked && handleMouseDown('__qr_code__', e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setSelectedElementKey('__qr_code__');
                }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  !readOnly
                    ? `${!event.qrConfig.isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                        selectedElementKey === '__qr_code__' ? 'ring-2 ring-amber-400' : ''
                      }`
                    : ''
                }`}
                style={{
                  left: `${event.qrConfig.x}%`,
                  top: `${event.qrConfig.y}%`,
                  backgroundColor: 'white',
                  padding: '3px',
                  lineHeight: 0
                }}
              >
                <QRCodeSVG
                  id="cert-qr-code-svg"
                  value={getQrVerificationUrl()}
                  size={event.qrConfig.size || 80}
                  level="M"
                  includeMargin={false}
                />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 3. BIG DOWNLOAD BUTTON FOR USER/STUDENT PORTAL */}
      {readOnly && (
        <div className="p-5 bg-[#0d131f] border-t border-slate-800 flex justify-center items-center">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadHighRes}
            style={{ backgroundColor: '#0f5132' }}
            className="text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2.5 shadow-xl hover:bg-emerald-800 transition cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span>{isExporting ? 'Generating Certificate...' : 'Download Official Certificate (300 DPI)'}</span>
          </button>
        </div>
      )}

    </div>
  );
};