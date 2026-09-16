import React, { useRef, useState } from 'react';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { QRCodeSVG } from 'qrcode.react';
import { Sliders, X } from 'lucide-react';

interface Props {
  event: EventItem;
  cert: IssuedCertificate;
  onUpdateEvent?: (ev: EventItem) => void;
  readOnly?: boolean;
}

export const CertificateCanvas: React.FC<Props> = ({ event, cert, onUpdateEvent, readOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);

  // Dynamic 2-Line calculation with auto-scaling
  const calculateTwoLineStyle = (field: DynamicFieldDef, text: string) => {
    let currentFontSize = field.fontSize || 18;
    const maxAllowedWidth = field.maxWidth || 760; // Standard printable width
    
    // Character width is approximately 0.55 of font size
    const estCharWidth = currentFontSize * 0.55;
    const totalEstWidth = text.length * estCharWidth;
    
    // Capacity of 2 lines = 2 * maxAllowedWidth
    const twoLineCapacity = maxAllowedWidth * 1.95;

    // If text exceeds 2 lines at current size, scale down smoothly to guarantee max 2 lines
    if (totalEstWidth > twoLineCapacity) {
      const scale = twoLineCapacity / totalEstWidth;
      currentFontSize = Math.max(11, Math.floor(currentFontSize * scale));
    }

    return {
      fontSize: `${currentFontSize}px`,
      lineHeight: 1.35, // Proper professional spacing between 2 lines
      color: field.color || '#222222',
      fontFamily: field.fontFamily || 'Georgia, serif',
      fontWeight: field.isBold ? 'bold' : 'normal',
      textAlign: (field.align as any) || 'center',
      width: `${maxAllowedWidth}px`,
      maxWidth: '92%',
      padding: '2px 8px',
      // Multi-line Clamp to exactly 2 lines
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical' as const,
      WebkitLineClamp: 2,
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
      f.key === fieldKey ? { ...f, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : f
    );
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const handleQRDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateEvent({ ...event, qrConfig: { ...event.qrConfig, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } });
  };

  const handleCertNoDragEnd = (e: React.DragEvent) => {
    if (readOnly || !onUpdateEvent || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateEvent({ ...event, certNoConfig: { ...event.certNoConfig, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } });
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
    <div className="space-y-3">
      {/* Canvas Area */}
      <div 
        ref={containerRef}
        id="certificate-print-area"
        className="relative w-full aspect-[1.414/1] bg-white border border-gray-300 shadow-sm overflow-hidden select-none"
        style={{
          backgroundImage: `url(${event.templateUrl})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
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
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-shadow ${
                !readOnly 
                  ? `cursor-move hover:ring-1 hover:ring-emerald-500 rounded ${
                      isSelected ? 'ring-2 ring-emerald-600 bg-emerald-50/30' : ''
                    }` 
                  : ''
              }`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                ...calculateTwoLineStyle(field, String(textValue))
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
            className={`absolute transform -translate-y-1/2 ${!readOnly ? 'cursor-move hover:ring-1 hover:ring-emerald-500 rounded p-1' : ''}`}
            style={{
              left: `${event.certNoConfig.x}%`,
              top: `${event.certNoConfig.y}%`,
              fontSize: `${event.certNoConfig.fontSize}px`,
              color: event.certNoConfig.color,
              fontWeight: event.certNoConfig.isBold ? 'bold' : 'normal',
              whiteSpace: 'nowrap'
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
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${!readOnly ? 'cursor-move hover:ring-1 hover:ring-emerald-500 rounded p-1 bg-white/60' : 'bg-white p-1 rounded-sm'}`}
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

      {/* Admin Quick Alignment & Fine-Tuning Bar */}
      {!readOnly && selectedField && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-amber-400" />
            <span className="font-bold text-amber-400">{selectedField.label}</span>
            <span className="text-slate-400 text-[10px] hidden sm:inline">(Click & Drag or use controls)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Y Position (Up / Down) */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg">
              <span className="text-slate-400 text-[11px]">Y (Vertical):</span>
              <button
                onClick={() => updateSelectedField({ y: Math.max(0, selectedField.y - 0.5) })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                ▲
              </button>
              <span className="w-9 text-center font-mono font-bold text-emerald-400">
                {selectedField.y.toFixed(1)}%
              </span>
              <button
                onClick={() => updateSelectedField({ y: Math.min(100, selectedField.y + 0.5) })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                ▼
              </button>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg">
              <span className="text-slate-400 text-[11px]">Size:</span>
              <button
                onClick={() => updateSelectedField({ fontSize: Math.max(10, selectedField.fontSize - 1) })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                -
              </button>
              <span className="w-8 text-center font-mono font-bold text-emerald-400">
                {selectedField.fontSize}px
              </span>
              <button
                onClick={() => updateSelectedField({ fontSize: selectedField.fontSize + 1 })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Width Constraint */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg">
              <span className="text-slate-400 text-[11px]">Width:</span>
              <button
                onClick={() => updateSelectedField({ maxWidth: Math.max(300, (selectedField.maxWidth || 760) - 20) })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                -
              </button>
              <span className="w-12 text-center font-mono font-bold text-emerald-400">
                {selectedField.maxWidth || 760}px
              </span>
              <button
                onClick={() => updateSelectedField({ maxWidth: (selectedField.maxWidth || 760) + 20 })}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <button
              onClick={() => setSelectedFieldKey(null)}
              className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
              title="Close Fine Tune"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};