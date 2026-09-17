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
  Sliders, 
  X, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Maximize2,
  MousePointerClick,
  QrCode,
  Hash
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
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const updatedFields = event.fields.map(f =>
      f.key === fieldKey ? { ...f, x: Math.max(0, Math.min(100, Number(x.toFixed(2)))), y: Math.max(0, Math.min(100, Number(y.toFixed(2)))) } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const handleQRDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) } });
  };

  const handleCertNoDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current) return;
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
    <div className="space-y-4">
      {!readOnly && (
        <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <MousePointerClick size={16} />
            <span>SELECT LAYER TO EDIT:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {event.fields.filter(f => f.visible).map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedElementKey(f.key)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedElementKey === f.key
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}

            {event.certNoConfig.visible && (
              <button
                onClick={() => setSelectedElementKey('__cert_no__')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  selectedElementKey === '__cert_no__'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                }`}
              >
                <Hash size={12} /> Cert No
              </button>
            )}

            {event.qrConfig.visible && (
              <button
                onClick={() => setSelectedElementKey('__qr_code__')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  selectedElementKey === '__qr_code__'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                }`}
              >
                <QrCode size={12} /> QR Code
              </button>
            )}
          </div>
        </div>
      )}

      {/* Visual Canvas Area */}
      <div
        ref={containerRef}
        id="certificate-print-area"
        className="relative w-full aspect-[1.414/1] bg-white border border-gray-300 shadow-xl rounded-xl overflow-hidden select-none"
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

          return (
            <div
              key={field.key}
              draggable={!readOnly}
              onClick={() => !readOnly && setSelectedElementKey(field.key)}
              onDragEnd={(e) => handleDragEnd(e, field.key)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                !readOnly
                  ? `cursor-move hover:ring-2 hover:ring-emerald-500 rounded ${
                      isSelected ? 'ring-2 ring-blue-500 shadow-lg !bg-blue-50/25' : ''
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
            draggable={!readOnly}
            onClick={() => !readOnly && setSelectedElementKey('__cert_no__')}
            onDragEnd={handleCertNoDragEnd}
            className={`absolute transform -translate-y-1/2 ${
              !readOnly
                ? `cursor-move hover:ring-2 hover:ring-emerald-500 rounded p-1 ${
                    selectedElementKey === '__cert_no__' ? 'ring-2 ring-blue-500 bg-blue-50/25 shadow-md' : ''
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
            draggable={!readOnly}
            onClick={() => !readOnly && setSelectedElementKey('__qr_code__')}
            onDragEnd={handleQRDragEnd}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              !readOnly
                ? `cursor-move hover:ring-2 hover:ring-emerald-500 rounded p-1 ${
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

      {!readOnly && selectedField && (
        <div className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-2xl shadow-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                Formatting Field: {selectedField.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                (Position: X={selectedField.x.toFixed(1)}%, Y={selectedField.y.toFixed(1)}%)
              </span>
            </div>
            <button
              onClick={() => setSelectedElementKey(null)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Type size={14} className="text-emerald-400" />
              <select
                value={selectedField.fontFamily || 'Georgia, serif'}
                onChange={(e) => updateSelectedField({ fontFamily: e.target.value })}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-2"
              >
                {CERT_FONTS.map(f => (
                  <option key={f.value} value={f.value} className="bg-slate-900 text-white">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => updateSelectedField({ fontSize: Math.max(9, (selectedField.fontSize || 18) - 1) })}
                className="px-2.5 py-1.5 hover:bg-slate-700 active:bg-slate-600 transition font-bold cursor-pointer"
              >
                -
              </button>
              <span className="px-2 text-emerald-400 font-mono font-bold min-w-[3rem] text-center">
                {selectedField.fontSize || 18}px
              </span>
              <button
                onClick={() => updateSelectedField({ fontSize: (selectedField.fontSize || 18) + 1 })}
                className="px-2.5 py-1.5 hover:bg-slate-700 active:bg-slate-600 transition font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => updateSelectedField({ isBold: !selectedField.isBold })}
                className={`p-1.5 rounded-lg transition cursor-pointer ${selectedField.isBold ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                className={`p-1.5 rounded-lg transition cursor-pointer ${selectedField.isItalic ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ isUppercase: !selectedField.isUppercase })}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${selectedField.isUppercase ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                title="ALL CAPS"
              >
                AA
              </button>
            </div>

            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => updateSelectedField({ align: 'left' })}
                className={`p-1.5 rounded-lg transition cursor-pointer ${selectedField.align === 'left' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignLeft size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ align: 'center' })}
                className={`p-1.5 rounded-lg transition cursor-pointer ${selectedField.align === 'center' || !selectedField.align ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignCenter size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ align: 'right' })}
                className={`p-1.5 rounded-lg transition cursor-pointer ${selectedField.align === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignRight size={14} />
              </button>
            </div>

            <label className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer hover:border-slate-500 transition">
              <Palette size={14} className="text-amber-400" />
              <span className="text-[11px] text-slate-300">Color</span>
              <input
                type="color"
                value={selectedField.color || '#111827'}
                onChange={(e) => updateSelectedField({ color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Highlighter size={14} className="text-amber-400" />
              <span className="text-[11px] text-slate-300">Highlight</span>
              <input
                type="color"
                value={selectedField.backgroundColor && selectedField.backgroundColor !== 'transparent' ? selectedField.backgroundColor : '#ffffff'}
                onChange={(e) => updateSelectedField({ backgroundColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              {selectedField.backgroundColor && selectedField.backgroundColor !== 'transparent' && (
                <button
                  onClick={() => updateSelectedField({ backgroundColor: 'transparent' })}
                  className="text-[10px] text-rose-400 hover:underline ml-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Maximize2 size={13} className="text-cyan-400" />
              <span className="text-[11px] text-slate-300">Width:</span>
              <button
                onClick={() => updateSelectedField({ maxWidth: Math.max(250, (selectedField.maxWidth || 760) - 40) })}
                className="hover:text-amber-400 font-bold px-1 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono text-cyan-400 font-bold">{selectedField.maxWidth || 760}px</span>
              <button
                onClick={() => updateSelectedField({ maxWidth: (selectedField.maxWidth || 760) + 40 })}
                className="hover:text-amber-400 font-bold px-1 cursor-pointer"
              >
                +
              </button>

              <span className="text-slate-600">|</span>

              <span className="text-[11px] text-slate-300">Lines:</span>
              <button
                onClick={() => updateSelectedField({ maxLines: selectedField.maxLines === 1 ? 2 : selectedField.maxLines === 2 ? 3 : 1 })}
                className="bg-slate-700 text-amber-400 px-2 py-0.5 rounded font-mono font-bold cursor-pointer"
              >
                {selectedField.maxLines || 2}L
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 mr-1 font-bold">NUDGE:</span>
              <button
                onClick={() => updateSelectedField({ x: Math.max(0, Number((selectedField.x - 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ y: Math.max(0, Number((selectedField.y - 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ y: Math.min(100, Number((selectedField.y + 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ x: Math.min(100, Number((selectedField.x + 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
              >
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!readOnly && selectedElementKey === '__cert_no__' && onUpdateEvent && (
        <div className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-amber-400" />
            <span className="font-bold text-amber-400 uppercase">Formatting: Certificate Number</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: Math.max(8, event.certNoConfig.fontSize - 1) } })}
                className="px-2.5 py-1.5 hover:bg-slate-700 font-bold cursor-pointer"
              >
                -
              </button>
              <span className="px-2 text-emerald-400 font-mono font-bold">{event.certNoConfig.fontSize}px</span>
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, fontSize: event.certNoConfig.fontSize + 1 } })}
                className="px-2.5 py-1.5 hover:bg-slate-700 font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <label className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer">
              <Palette size={14} className="text-amber-400" />
              <span>Color</span>
              <input
                type="color"
                value={event.certNoConfig.color}
                onChange={(e) => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, color: e.target.value } })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            <button
              onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, isBold: !event.certNoConfig.isBold } })}
              className={`px-3 py-1.5 rounded-xl border border-slate-700 font-bold cursor-pointer ${event.certNoConfig.isBold ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'}`}
            >
              Bold
            </button>

            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.max(0, Number((event.certNoConfig.x - 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.max(0, Number((event.certNoConfig.y - 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, y: Math.min(100, Number((event.certNoConfig.y + 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.min(100, Number((event.certNoConfig.x + 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowRight size={13} />
              </button>
            </div>

            <button onClick={() => setSelectedElementKey(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {!readOnly && selectedElementKey === '__qr_code__' && onUpdateEvent && (
        <div className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-amber-400" />
            <span className="font-bold text-amber-400 uppercase">Formatting: QR Verification Code</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, size: Math.max(40, event.qrConfig.size - 5) } })}
                className="px-2.5 py-1.5 hover:bg-slate-700 font-bold cursor-pointer"
              >
                -
              </button>
              <span className="px-2 text-emerald-400 font-mono font-bold">{event.qrConfig.size}px</span>
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, size: event.qrConfig.size + 5 } })}
                className="px-2.5 py-1.5 hover:bg-slate-700 font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Math.max(0, Number((event.qrConfig.x - 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, y: Math.max(0, Number((event.qrConfig.y - 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, y: Math.min(100, Number((event.qrConfig.y + 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Math.min(100, Number((event.qrConfig.x + 0.2).toFixed(2))) } })}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ArrowRight size={13} />
              </button>
            </div>

            <button onClick={() => setSelectedElementKey(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};