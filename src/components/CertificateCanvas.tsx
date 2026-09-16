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
  Maximize2
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
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);

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

    return {
      fontSize: `${currentFontSize}px`,
      lineHeight: field.lineHeight || 1.35,
      color: field.color || '#111827',
      backgroundColor: field.backgroundColor && field.backgroundColor !== 'transparent' ? field.backgroundColor : 'transparent',
      fontFamily: field.fontFamily || 'Georgia, serif',
      fontWeight: field.isBold ? ('bold' as const) : ('normal' as const),
      fontStyle: field.isItalic ? ('italic' as const) : ('normal' as const),
      textTransform: field.isUppercase ? ('uppercase' as const) : ('none' as const),
      textAlign: (field.align || 'center') as any,
      width: `${maxAllowedWidth}px`,
      maxWidth: '96%',
      padding: '2px 8px',
      borderRadius: '4px',
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

  const selectedField = event.fields.find(f => f.key === selectedFieldKey);

  const updateSelectedField = (updates: Partial<DynamicFieldDef>) => {
    if (!onUpdateEvent || !selectedFieldKey) return;
    const updatedFields = event.fields.map(f =>
      f.key === selectedFieldKey ? { ...f, ...updates } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  return (
    <div className="space-y-4">
      {/* Visual Canvas Area */}
      <div
        ref={containerRef}
        id="certificate-print-area"
        className="relative w-full aspect-[1.414/1] bg-white border border-gray-300 shadow-lg rounded-xl overflow-hidden select-none"
        style={{
          backgroundImage: `url(${event.templateUrl})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dynamic Fields */}
        {event.fields.filter(f => f.visible).map((field) => {
          const textValue = cert.data[field.label] || cert.data[field.key] || '';
          if (!textValue) return null;
          const isSelected = selectedFieldKey === field.key;

          return (
            <div
              key={field.key}
              draggable={!readOnly}
              onClick={() => !readOnly && setSelectedFieldKey(field.key)}
              onDragEnd={(e) => handleDragEnd(e, field.key)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                !readOnly
                  ? `cursor-move hover:ring-2 hover:ring-emerald-500 rounded ${
                      isSelected ? 'ring-2 ring-blue-600 shadow-md !bg-blue-50/20' : ''
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

        {/* Certificate Number */}
        {event.certNoConfig.visible && (
          <div
            draggable={!readOnly}
            onDragEnd={handleCertNoDragEnd}
            className={`absolute transform -translate-y-1/2 ${!readOnly ? 'cursor-move hover:ring-2 hover:ring-emerald-500 rounded p-1' : ''}`}
            style={{
              left: `${event.certNoConfig.x}%`,
              top: `${event.certNoConfig.y}%`,
              fontSize: `${event.certNoConfig.fontSize}px`,
              color: event.certNoConfig.color,
              fontWeight: event.certNoConfig.isBold ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
            }}
          >
            {cert.certificate_no}
          </div>
        )}

        {/* QR Code */}
        {event.qrConfig.visible && (
          <div
            draggable={!readOnly}
            onDragEnd={handleQRDragEnd}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${!readOnly ? 'cursor-move hover:ring-2 hover:ring-emerald-500 rounded p-1 bg-white/60' : 'bg-white p-1 rounded-sm'}`}
            style={{
              left: `${event.qrConfig.x}%`,
              top: `${event.qrConfig.y}%`,
            }}
          >
            <QRCodeSVG
              value={`${window.location.origin}/#/verify?id=${cert.certificate_no}`}
              size={event.qrConfig.size}
              level="M"
              includeMargin={false}
            />
          </div>
        )}
      </div>

      {/* Hi-Tech MS Word / Canva Style Inspector Toolbar */}
      {!readOnly && selectedField && (
        <div className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-2xl shadow-2xl space-y-3 animate-in fade-in duration-200">
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                Formatting: {selectedField.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                (X: {selectedField.x.toFixed(1)}%, Y: {selectedField.y.toFixed(1)}%)
              </span>
            </div>
            <button
              onClick={() => setSelectedFieldKey(null)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Controls Ribbon */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            
            {/* Font Family Selector */}
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

            {/* Font Size & Stepper */}
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => updateSelectedField({ fontSize: Math.max(9, (selectedField.fontSize || 18) - 1) })}
                className="px-2.5 py-1.5 hover:bg-slate-700 active:bg-slate-600 transition font-bold"
              >
                -
              </button>
              <span className="px-2 text-emerald-400 font-mono font-bold min-w-[3rem] text-center">
                {selectedField.fontSize || 18}px
              </span>
              <button
                onClick={() => updateSelectedField({ fontSize: (selectedField.fontSize || 18) + 1 })}
                className="px-2.5 py-1.5 hover:bg-slate-700 active:bg-slate-600 transition font-bold"
              >
                +
              </button>
            </div>

            {/* Bold / Italic / Uppercase Toggles */}
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => updateSelectedField({ isBold: !selectedField.isBold })}
                className={`p-1.5 rounded-lg transition ${selectedField.isBold ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                className={`p-1.5 rounded-lg transition ${selectedField.isItalic ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ isUppercase: !selectedField.isUppercase })}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition ${selectedField.isUppercase ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                title="ALL CAPS"
              >
                AA
              </button>
            </div>

            {/* Alignment Options */}
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => updateSelectedField({ align: 'left' })}
                className={`p-1.5 rounded-lg transition ${selectedField.align === 'left' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignLeft size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ align: 'center' })}
                className={`p-1.5 rounded-lg transition ${selectedField.align === 'center' || !selectedField.align ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignCenter size={14} />
              </button>
              <button
                onClick={() => updateSelectedField({ align: 'right' })}
                className={`p-1.5 rounded-lg transition ${selectedField.align === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignRight size={14} />
              </button>
            </div>

            {/* Text Color Picker */}
            <label className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer hover:border-slate-500 transition">
              <Palette size={14} className="text-amber-400" />
              <span className="text-[11px] text-slate-300">Text</span>
              <input
                type="color"
                value={selectedField.color || '#111827'}
                onChange={(e) => updateSelectedField({ color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            {/* Background / Highlight Color Picker */}
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
                  className="text-[10px] text-rose-400 hover:underline ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Max Width & Line Limit */}
            <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Maximize2 size={13} className="text-cyan-400" />
              <span className="text-[11px] text-slate-300">Width:</span>
              <button
                onClick={() => updateSelectedField({ maxWidth: Math.max(250, (selectedField.maxWidth || 760) - 40) })}
                className="hover:text-amber-400 font-bold px-1"
              >
                -
              </button>
              <span className="font-mono text-cyan-400 font-bold">{selectedField.maxWidth || 760}px</span>
              <button
                onClick={() => updateSelectedField({ maxWidth: (selectedField.maxWidth || 760) + 40 })}
                className="hover:text-amber-400 font-bold px-1"
              >
                +
              </button>

              <span className="text-slate-600">|</span>

              <span className="text-[11px] text-slate-300">Lines:</span>
              <button
                onClick={() => updateSelectedField({ maxLines: selectedField.maxLines === 1 ? 2 : selectedField.maxLines === 2 ? 3 : 1 })}
                className="bg-slate-700 text-amber-400 px-2 py-0.5 rounded font-mono font-bold"
                title="Toggle Max Allowed Lines"
              >
                {selectedField.maxLines || 2}L
              </button>
            </div>

            {/* D-Pad Precision Nudge Controls (X & Y Positioning) */}
            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 mr-1 font-bold">NUDGE:</span>
              <button
                onClick={() => updateSelectedField({ x: Math.max(0, Number((selectedField.x - 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition"
                title="Move Left 0.2%"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ y: Math.max(0, Number((selectedField.y - 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition"
                title="Move Up 0.2%"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ y: Math.min(100, Number((selectedField.y + 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition"
                title="Move Down 0.2%"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => updateSelectedField({ x: Math.min(100, Number((selectedField.x + 0.2).toFixed(2))) })}
                className="p-1 hover:bg-slate-700 rounded transition"
                title="Move Right 0.2%"
              >
                <ArrowRight size={13} />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};