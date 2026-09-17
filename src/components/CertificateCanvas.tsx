import React, { useRef, useState } from 'react';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Palette, 
  Highlighter, 
  Type, 
  X, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Maximize2,
  MousePointerClick,
  QrCode,
  Hash,
  Lock,
  Unlock,
  AlignCenterHorizontal,
  AlignCenterVertical
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

  const getQrVerificationUrl = () => {
    const basePath = window.location.href.split('#')[0].replace(/\/+$/, '');
    return `${basePath}/#/verify?id=${encodeURIComponent(cert.certificate_no)}`;
  };

  const calculateDynamicStyle = (field: DynamicFieldDef, text: string) => {
    let currentFontSize = field.fontSize || 18;
    const maxAllowedWidth = field.maxWidth || 760;
    const maxLines = field.maxLines || 2;

    const estCharWidth = currentFontSize * 0.55;
    const totalEstWidth = text.length * estCharWidth;
    const capacity = maxAllowedWidth * (maxLines === 1 ? 1 : maxLines * 0.95);

    if (totalEstWidth > capacity) {
      const scale = capacity / totalEstWidth;
      currentFontSize = Math.max(10, Math.floor(currentFontSize * scale));
    }

    const hasHighlight = field.backgroundColor && field.backgroundColor !== 'transparent' && field.backgroundColor !== '#ffffff';

    return {
      fontSize: `${currentFontSize}px`,
      lineHeight: field.lineHeight || 1.35,
      color: field.color || '#111827',
      backgroundColor: hasHighlight ? field.backgroundColor : 'transparent',
      fontFamily: field.fontFamily || 'Georgia, serif',
      fontWeight: field.isBold ? ('bold' as const) : ('normal' as const),
      fontStyle: field.isItalic ? ('italic' as const) : ('normal' as const),
      textTransform: field.isUppercase ? ('uppercase' as const) : ('none' as const),
      textAlign: (field.align || 'center') as any,
      width: `${maxAllowedWidth}px`,
      maxWidth: '96%',
      padding: hasHighlight ? '2px 8px' : '0px',
      borderRadius: hasHighlight ? '4px' : '0px',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical' as const,
      WebkitLineClamp: maxLines,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      wordBreak: 'break-word' as const,
    };
  };

  const handleDragEnd = (e: React.DragEvent, fieldKey: string) => {
    if (readOnly || !onUpdateEvent || !containerRef.current) return;
    const targetField = event.fields.find(f => f.key === fieldKey);
    if (targetField?.isLocked) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const updatedFields = event.fields.map(f =>
      f.key === fieldKey ? { ...f, x: Math.max(0, Math.min(100, Number(x.toFixed(2)))), y: Math.max(0, Math.min(100, Number(y.toFixed(2)))) } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const handleQRDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current || event.qrConfig.isLocked) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) } });
  };

  const handleCertNoDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current || event.certNoConfig.isLocked) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) } });
  };

  const selectedField = event.fields.find(f => f.key === selectedElementKey);

  const updateSelectedField = (updates: Partial<DynamicFieldDef>) => {
    if (!onUpdateEvent || !selectedElementKey) return;
    const updatedFields = event.fields.map(f =>
      f.key === selectedElementKey ? { ...f, ...updates } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  return (
    <div className="flex flex-col border border-slate-700/80 rounded-2xl bg-slate-900/60 shadow-2xl overflow-hidden">
      
      {/* 1. FIXED TOP MS-WORD STYLE RIBBON TOOLBAR */}
      {!readOnly && (
        <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-700 shadow-md">
          
          {/* Layer Selector Bar */}
          <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-amber-400 shrink-0">
              <MousePointerClick size={14} />
              <span>LAYERS:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
              {event.fields.filter(f => f.visible).map((f) => (
                <div key={f.key} className="inline-flex items-center rounded-lg overflow-hidden border border-slate-700 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey(f.key)}
                    className={`px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      selectedElementKey === f.key
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    className={`px-1.5 py-1 text-[10px] cursor-pointer transition border-l border-slate-700 ${
                      f.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                </div>
              ))}

              {event.certNoConfig.visible && (
                <div className="inline-flex items-center rounded-lg overflow-hidden border border-slate-700 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey('__cert_no__')}
                    className={`px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                      selectedElementKey === '__cert_no__'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Hash size={11} /> Cert No
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({
                      ...event,
                      certNoConfig: { ...event.certNoConfig, isLocked: !event.certNoConfig.isLocked }
                    })}
                    className={`px-1.5 py-1 text-[10px] cursor-pointer transition border-l border-slate-700 ${
                      event.certNoConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {event.certNoConfig.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                </div>
              )}

              {event.qrConfig.visible && (
                <div className="inline-flex items-center rounded-lg overflow-hidden border border-slate-700 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedElementKey('__qr_code__')}
                    className={`px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                      selectedElementKey === '__qr_code__'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <QrCode size={11} /> QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({
                      ...event,
                      qrConfig: { ...event.qrConfig, isLocked: !event.qrConfig.isLocked }
                    })}
                    className={`px-1.5 py-1 text-[10px] cursor-pointer transition border-l border-slate-700 ${
                      event.qrConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {event.qrConfig.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Ribbon Inspector Bar */}
          {selectedField ? (
            <div className="px-3 py-2 bg-slate-950 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Font Selector */}
                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                  <Type size={13} className="text-emerald-400" />
                  <select
                    value={selectedField.fontFamily || 'Georgia, serif'}
                    onChange={(e) => updateSelectedField({ fontFamily: e.target.value })}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                  >
                    {CERT_FONTS.map(f => (
                      <option key={f.value} value={f.value} className="bg-slate-900 text-white">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Size Stepper */}
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ fontSize: Math.max(9, (selectedField.fontSize || 18) - 1) })}
                    className="px-2 py-1 hover:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-1.5 text-emerald-400 font-mono font-bold text-[11px] min-w-[2.5rem] text-center">
                    {selectedField.fontSize || 18}px
                  </span>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ fontSize: (selectedField.fontSize || 18) + 1 })}
                    className="px-2 py-1 hover:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Center Align Tools */}
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ x: 50 })}
                    className="px-1.5 py-1 hover:bg-slate-700 rounded text-slate-300 hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
                    title="Center Horizontally (50%)"
                  >
                    <AlignCenterHorizontal size={13} />
                    <span className="text-[10px] font-bold">X-50%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ y: 50 })}
                    className="px-1.5 py-1 hover:bg-slate-700 rounded text-slate-300 hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
                    title="Center Vertically (50%)"
                  >
                    <AlignCenterVertical size={13} />
                    <span className="text-[10px] font-bold">Y-50%</span>
                  </button>
                </div>

                {/* Format Toggles */}
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ isBold: !selectedField.isBold })}
                    className={`p-1 rounded transition cursor-pointer ${selectedField.isBold ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                    className={`p-1 rounded transition cursor-pointer ${selectedField.isItalic ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ isUppercase: !selectedField.isUppercase })}
                    className={`px-1.5 py-0.5 text-[10px] font-black rounded transition cursor-pointer ${selectedField.isUppercase ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    AA
                  </button>
                </div>

                {/* Align Text */}
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ align: 'left' })}
                    className={`p-1 rounded transition cursor-pointer ${selectedField.align === 'left' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ align: 'center' })}
                    className={`p-1 rounded transition cursor-pointer ${selectedField.align === 'center' || !selectedField.align ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ align: 'right' })}
                    className={`p-1 rounded transition cursor-pointer ${selectedField.align === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <AlignRight size={13} />
                  </button>
                </div>

                {/* Text Color */}
                <label className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer">
                  <Palette size={13} className="text-amber-400" />
                  <input
                    type="color"
                    value={selectedField.color || '#111827'}
                    onChange={(e) => updateSelectedField({ color: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>

                {/* Highlight Color */}
                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                  <Highlighter size={13} className="text-amber-400" />
                  <input
                    type="color"
                    value={selectedField.backgroundColor && selectedField.backgroundColor !== 'transparent' ? selectedField.backgroundColor : '#ffffff'}
                    onChange={(e) => updateSelectedField({ backgroundColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  {selectedField.backgroundColor && selectedField.backgroundColor !== 'transparent' && (
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ backgroundColor: 'transparent' })}
                      className="text-[10px] text-rose-400 hover:underline ml-0.5 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Width Stepper */}
                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                  <Maximize2 size={12} className="text-cyan-400" />
                  <span className="font-mono text-[11px] text-cyan-400 font-bold">{selectedField.maxWidth || 760}px</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ maxWidth: (selectedField.maxWidth || 760) + 40 })}
                    className="text-xs hover:text-amber-400 font-bold px-0.5 cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ maxWidth: Math.max(250, (selectedField.maxWidth || 760) - 40) })}
                    className="text-xs hover:text-amber-400 font-bold px-0.5 cursor-pointer"
                  >
                    -
                  </button>
                </div>

                {/* Nudge D-Pad */}
                <div className="flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded-lg border border-slate-700">
                  <span className="text-[9px] text-slate-400 font-bold mr-1">NUDGE:</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ x: Math.max(0, Number((selectedField.x - 0.2).toFixed(2))) })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    <ArrowLeft size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ y: Math.max(0, Number((selectedField.y - 0.2).toFixed(2))) })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ y: Math.min(100, Number((selectedField.y + 0.2).toFixed(2))) })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    <ArrowDown size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ x: Math.min(100, Number((selectedField.x + 0.2).toFixed(2))) })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    <ArrowRight size={11} />
                  </button>
                </div>

                {/* Inspector Layer Lock Toggle */}
                <button
                  type="button"
                  onClick={() => updateSelectedField({ isLocked: !selectedField.isLocked })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedField.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                  title={selectedField.isLocked ? "Unlock Field" : "Lock Field"}
                >
                  {selectedField.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  <span>{selectedField.isLocked ? 'Locked' : 'Lock'}</span>
                </button>

              </div>

              {/* Close Active Inspector */}
              <button
                type="button"
                onClick={() => setSelectedElementKey(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          ) : selectedElementKey === '__cert_no__' ? (
            <div className="px-3 py-2 bg-slate-950 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400 text-xs">CERT NO:</span>
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: Math.max(8, event.certNoConfig.fontSize - 1) } })}
                    className="px-2 py-1 hover:bg-slate-700 font-bold"
                  >
                    -
                  </button>
                  <span className="px-1.5 text-emerald-400 font-mono text-[11px] font-bold">{event.certNoConfig.fontSize}px</span>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: event.certNoConfig.fontSize + 1 } })}
                    className="px-2 py-1 hover:bg-slate-700 font-bold"
                  >
                    +
                  </button>
                </div>

                <label className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer">
                  <Palette size={13} className="text-amber-400" />
                  <input
                    type="color"
                    value={event.certNoConfig.color}
                    onChange={(e) => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, color: e.target.value } })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, isBold: !event.certNoConfig.isBold } })}
                  className={`px-2 py-1 rounded-lg text-xs font-bold ${event.certNoConfig.isBold ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                >
                  Bold
                </button>

                {/* Nudge */}
                <div className="flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.max(0, Number((event.certNoConfig.x - 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowLeft size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.max(0, Number((event.certNoConfig.y - 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.min(100, Number((event.certNoConfig.y + 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowDown size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.min(100, Number((event.certNoConfig.x + 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowRight size={11} />
                  </button>
                </div>

                {/* Cert No Lock Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdateEvent?.({
                    ...event,
                    certNoConfig: { ...event.certNoConfig, isLocked: !event.certNoConfig.isLocked }
                  })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    event.certNoConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                  title={event.certNoConfig.isLocked ? "Unlock Cert No" : "Lock Cert No"}
                >
                  {event.certNoConfig.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  <span>{event.certNoConfig.isLocked ? 'Locked' : 'Lock'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedElementKey(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={15} />
              </button>
            </div>
          ) : selectedElementKey === '__qr_code__' ? (
            <div className="px-3 py-2 bg-slate-950 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400 text-xs">QR CODE:</span>
                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, size: Math.max(40, event.qrConfig.size - 5) } })}
                    className="px-2 py-1 hover:bg-slate-700 font-bold"
                  >
                    -
                  </button>
                  <span className="px-1.5 text-emerald-400 font-mono text-[11px] font-bold">{event.qrConfig.size}px</span>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, size: event.qrConfig.size + 5 } })}
                    className="px-2 py-1 hover:bg-slate-700 font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Nudge */}
                <div className="flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, x: Math.max(0, Number((event.qrConfig.x - 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowLeft size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, y: Math.max(0, Number((event.qrConfig.y - 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, y: Math.min(100, Number((event.qrConfig.y + 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowDown size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEvent?.({ ...event, qrConfig: { ...event.qrConfig, x: Math.min(100, Number((event.qrConfig.x + 0.2).toFixed(2))) } })}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300"
                  >
                    <ArrowRight size={11} />
                  </button>
                </div>

                {/* QR Lock Toggle */}
                <button
                  type="button"
                  onClick={() => onUpdateEvent?.({
                    ...event,
                    qrConfig: { ...event.qrConfig, isLocked: !event.qrConfig.isLocked }
                  })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    event.qrConfig.isLocked ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                  title={event.qrConfig.isLocked ? "Unlock QR Code" : "Lock QR Code"}
                >
                  {event.qrConfig.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  <span>{event.qrConfig.isLocked ? 'Locked' : 'Lock'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedElementKey(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

        </div>
      )}

      {/* 2. MS-WORD STYLE PAGE VIEWPORT / SLIDING WORKSPACE */}
      <div className="p-4 sm:p-6 md:p-8 bg-slate-950/80 flex items-center justify-center overflow-auto max-h-[78vh]">
        <div
          ref={containerRef}
          id="certificate-print-area"
          className="relative w-full max-w-[1000px] aspect-[1.414/1] bg-white shadow-2xl rounded-lg overflow-hidden select-none border border-slate-700/50 shrink-0"
          style={{
            backgroundImage: `url(${event.templateUrl})`,
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {event.fields.filter(f => f.visible).map((field) => {
            const textValue = cert.data[field.label] || cert.data[field.key] || '';
            if (!textValue) return null;
            const isSelected = selectedElementKey === field.key;
            const isDraggable = !readOnly && !field.isLocked;

            return (
              <div
                key={field.key}
                draggable={isDraggable}
                onClick={() => !readOnly && setSelectedElementKey(field.key)}
                onDragEnd={(e) => handleDragEnd(e, field.key)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                  !readOnly
                    ? `${isDraggable ? 'cursor-move hover:ring-2 hover:ring-emerald-500' : 'cursor-pointer'} rounded ${
                        isSelected ? 'ring-2 ring-blue-500 shadow-lg !bg-blue-50/20' : ''
                      }`
                    : ''
                }`}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  ...calculateDynamicStyle(field, String(textValue)),
                }}
              >
                {textValue}
              </div>
            );
          })}

          {event.certNoConfig.visible && (
            <div
              draggable={!readOnly && !event.certNoConfig.isLocked}
              onClick={() => !readOnly && setSelectedElementKey('__cert_no__')}
              onDragEnd={handleCertNoDragEnd}
              className={`absolute transform -translate-y-1/2 ${
                !readOnly
                  ? `${!event.certNoConfig.isLocked ? 'cursor-move hover:ring-2 hover:ring-emerald-500' : 'cursor-pointer'} rounded p-1 ${
                      selectedElementKey === '__cert_no__' ? 'ring-2 ring-blue-500 bg-blue-50/20 shadow-md' : ''
                    }`
                  : ''
              }`}
              style={{
                left: `${event.certNoConfig.x}%`,
                top: `${event.certNoConfig.y}%`,
                fontSize: `${event.certNoConfig.fontSize}px`,
                color: event.certNoConfig.color,
                fontWeight: event.certNoConfig.isBold ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                backgroundColor: 'transparent',
              }}
            >
              {cert.certificate_no}
            </div>
          )}

          {event.qrConfig.visible && (
            <div
              draggable={!readOnly && !event.qrConfig.isLocked}
              onClick={() => !readOnly && setSelectedElementKey('__qr_code__')}
              onDragEnd={handleQRDragEnd}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                !readOnly
                  ? `${!event.qrConfig.isLocked ? 'cursor-move hover:ring-2 hover:ring-emerald-500' : 'cursor-pointer'} rounded p-1 ${
                      selectedElementKey === '__qr_code__' ? 'ring-2 ring-blue-500 bg-blue-100 shadow-md' : 'bg-white/90'
                    }`
                  : 'bg-white p-1 rounded-sm'
              }`}
              style={{
                left: `${event.qrConfig.x}%`,
                top: `${event.qrConfig.y}%`,
              }}
            >
              <QRCodeSVG
                value={getQrVerificationUrl()}
                size={event.qrConfig.size}
                level="M"
                includeMargin={false}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};