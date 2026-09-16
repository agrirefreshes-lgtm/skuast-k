import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import type { EventItem, IssuedCertificate, DynamicFieldDef } from '../types/certificate';
import { Download, Sliders, Eye, EyeOff } from 'lucide-react';

interface Props {
  event: EventItem;
  cert: IssuedCertificate;
  readOnly?: boolean;
  onUpdateEvent?: (updated: EventItem) => void;
}

export const CertificateCanvas: React.FC<Props> = ({ event, cert, readOnly = false, onUpdateEvent }) => {
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>(event.fields[0]?.key || 'cert_no');
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const certNoConf = event.certNoConfig || { x: 8, y: 92, fontSize: 13, color: '#222222', isBold: false, visible: true };

  const getFieldValue = (field: DynamicFieldDef): string => {
    if (!cert || !cert.data) return '';
    if (cert.data[field.label] !== undefined && cert.data[field.label] !== '') return String(cert.data[field.label]);
    if (cert.data[field.key] !== undefined && cert.data[field.key] !== '') return String(cert.data[field.key]);

    const cleanKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [k, val] of Object.entries(cert.data)) {
      const cleanDataKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanDataKey || cleanDataKey.includes(cleanKey) || cleanKey.includes(cleanDataKey)) {
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
    }
    return '';
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    if (!text || !text.trim()) return;
    const words = text.trim().split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isEditing || !containerRef.current || !onUpdateEvent) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    if (selectedFieldKey === 'qr_code') {
      onUpdateEvent({
        ...event,
        qrConfig: { ...event.qrConfig, x, y },
      });
    } else if (selectedFieldKey === 'cert_no') {
      onUpdateEvent({
        ...event,
        certNoConfig: { ...certNoConf, x, y },
      });
    } else {
      const updatedFields = event.fields.map((f) => (f.key === selectedFieldKey ? { ...f, x, y } : f));
      onUpdateEvent({ ...event, fields: updatedFields });
    }
  };

  const updateSelectedField = (updates: Partial<DynamicFieldDef>) => {
    if (!onUpdateEvent) return;
    const updatedFields = event.fields.map((f) => (f.key === selectedFieldKey ? { ...f, ...updates } : f));
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const toggleVisibility = (key: string) => {
    if (!onUpdateEvent) return;
    const updatedFields = event.fields.map((f) => (f.key === key ? { ...f, visible: !f.visible } : f));
    onUpdateEvent({ ...event, fields: updatedFields });
  };

  const handleDownloadPDF = () => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = event.templateUrl;

    img.onload = () => {
      canvas.width = 1920;
      canvas.height = 1080;

      // 1. Draw Template
      ctx.drawImage(img, 0, 0, 1920, 1080);

      // 2. Draw Dynamic Body Fields
      event.fields.forEach((field) => {
        if (!field.visible) return;
        const text = getFieldValue(field);
        if (!text || text.trim() === '') return;

        const xPos = (field.x / 100) * 1920;
        const yPos = (field.y / 100) * 1080;

        ctx.fillStyle = field.color;
        ctx.font = `${field.isBold ? 'bold ' : ''}${field.fontSize * 1.8}px ${field.fontFamily}`;
        ctx.textAlign = field.align;

        wrapText(ctx, text, xPos, yPos, field.maxWidth * 1.8, field.lineHeight * 1.8);
      });

      // 3. Draw Dynamic Configured Certificate Number
      if (certNoConf.visible) {
        const certX = (certNoConf.x / 100) * 1920;
        const certY = (certNoConf.y / 100) * 1080;
        ctx.font = `${certNoConf.isBold ? 'bold ' : ''}${certNoConf.fontSize * 1.8}px monospace, sans-serif`;
        ctx.fillStyle = certNoConf.color;
        ctx.textAlign = 'left';
        ctx.fillText(`Cert No: ${cert.certificate_no}`, certX, certY);
      }

      // 4. Draw QR Code
      if (event.qrConfig.visible) {
        const qrCanvas = qrRef.current?.querySelector('canvas');
        if (qrCanvas) {
          const qrX = (event.qrConfig.x / 100) * 1920;
          const qrY = (event.qrConfig.y / 100) * 1080;
          const qrSize = event.qrConfig.size * 1.8;
          ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        }
      }

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('landscape', 'px', [1920, 1080]);
      pdf.addImage(imgData, 'PNG', 0, 0, 1920, 1080);
      pdf.save(`${cert.certificate_no.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);
    };
  };

  const currentField = event.fields.find((f) => f.key === selectedFieldKey);

  return (
    <div className="space-y-4 font-sans">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <span className="text-sm font-semibold text-gray-700">Certificate: </span>
          <span className="text-sm font-bold text-emerald-800 font-mono">{cert.certificate_no}</span>
          {!readOnly && (
            <span className="text-xs text-gray-500 ml-2">
              ({isEditing ? 'Positioning Mode' : 'Live Data Mode'})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Only render editing controls for Admin */}
          {!readOnly && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                isEditing ? 'bg-amber-500 text-white border-amber-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Sliders size={14} /> {isEditing ? 'Lock Layout' : 'Position Placeholders'}
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            style={{ backgroundColor: '#0f5132', color: '#ffffff' }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow hover:opacity-90 cursor-pointer"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Admin-Only Editing Toolbar */}
      {!readOnly && isEditing && (
        <div className="bg-slate-900 text-white p-4 rounded-xl space-y-4 text-xs">
          <div>
            <span className="font-bold text-amber-400 block mb-2">Select Field to Position on Certificate:</span>
            <div className="flex flex-wrap gap-2">
              {event.fields.map((f) => (
                <div key={f.key} className="flex items-center bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                  <button
                    onClick={() => setSelectedFieldKey(f.key)}
                    className={`px-2.5 py-1 font-medium ${
                      selectedFieldKey === f.key ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                  <button
                    onClick={() => toggleVisibility(f.key)}
                    title={f.visible ? 'Print on Certificate' : 'Hide from Certificate'}
                    className={`p-1.5 ${f.visible ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {f.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>
              ))}

              {/* Certificate Number Position Selector */}
              <button
                onClick={() => setSelectedFieldKey('cert_no')}
                className={`px-2.5 py-1 rounded font-medium border border-slate-700 ${
                  selectedFieldKey === 'cert_no' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                [Certificate No]
              </button>

              {/* QR Code Position Selector */}
              <button
                onClick={() => setSelectedFieldKey('qr_code')}
                className={`px-2.5 py-1 rounded font-medium border border-slate-700 ${
                  selectedFieldKey === 'qr_code' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                [QR Code]
              </button>
            </div>
          </div>

          {/* Dynamic Field Controls */}
          {currentField && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-slate-400 mb-1">Font Size ({currentField.fontSize}px)</label>
                <input
                  type="range"
                  min="12"
                  max="60"
                  value={currentField.fontSize}
                  onChange={(e) => updateSelectedField({ fontSize: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Color</label>
                <input
                  type="color"
                  value={currentField.color}
                  onChange={(e) => updateSelectedField({ color: e.target.value })}
                  className="w-full h-7 rounded cursor-pointer bg-slate-800 border-0"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Wrap Width ({currentField.maxWidth}px)</label>
                <input
                  type="range"
                  min="200"
                  max="1100"
                  value={currentField.maxWidth}
                  onChange={(e) => updateSelectedField({ maxWidth: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Line Height ({currentField.lineHeight}px)</label>
                <input
                  type="range"
                  min="14"
                  max="60"
                  value={currentField.lineHeight}
                  onChange={(e) => updateSelectedField({ lineHeight: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Align</label>
                <select
                  value={currentField.align}
                  onChange={(e) => updateSelectedField({ align: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="boldToggleCanvas"
                  checked={currentField.isBold}
                  onChange={(e) => updateSelectedField({ isBold: e.target.checked })}
                />
                <label htmlFor="boldToggleCanvas" className="text-slate-300">Bold</label>
              </div>
            </div>
          )}

          {/* Certificate No Controls */}
          {selectedFieldKey === 'cert_no' && (
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-slate-400 mb-1">Font Size ({certNoConf.fontSize}px)</label>
                <input
                  type="range"
                  min="10"
                  max="32"
                  value={certNoConf.fontSize}
                  onChange={(e) => onUpdateEvent?.({
                    ...event,
                    certNoConfig: { ...certNoConf, fontSize: Number(e.target.value) }
                  })}
                  className="w-36 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Text Color</label>
                <input
                  type="color"
                  value={certNoConf.color}
                  onChange={(e) => onUpdateEvent?.({
                    ...event,
                    certNoConfig: { ...certNoConf, color: e.target.value }
                  })}
                  className="w-20 h-7 rounded cursor-pointer bg-slate-800 border-0"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="boldCertNo"
                  checked={certNoConf.isBold}
                  onChange={(e) => onUpdateEvent?.({
                    ...event,
                    certNoConfig: { ...certNoConf, isBold: e.target.checked }
                  })}
                />
                <label htmlFor="boldCertNo" className="text-slate-300">Bold Serial</label>
              </div>
            </div>
          )}

          <p className="text-[11px] text-amber-300 italic">
            👉 Template par jahan click karenge, chuna hua element wahan shift ho jayega.
          </p>
        </div>
      )}

      {/* Visual Canvas Display */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow border-2 ${
          !readOnly && isEditing ? 'border-amber-500 cursor-crosshair' : 'border-gray-300'
        }`}
        style={{
          backgroundImage: `url(${event.templateUrl})`,
          backgroundSize: '100% 100%',
        }}
      >
        {/* Render Field Placeholders or Live Data */}
        {event.fields
          .filter((f) => f.visible)
          .map((field) => {
            const val = getFieldValue(field);
            if ((readOnly || !isEditing) && (!val || val.trim() === '')) return null;
            const displayText = !readOnly && isEditing ? `[${field.label}]` : val;

            return (
              <div
                key={field.key}
                onClick={(e) => {
                  if (readOnly) return;
                  e.stopPropagation();
                  setSelectedFieldKey(field.key);
                }}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  maxWidth: `${field.maxWidth * 0.55}px`,
                  transform:
                    field.align === 'center'
                      ? 'translate(-50%, -50%)'
                      : field.align === 'right'
                      ? 'translate(-100%, -50%)'
                      : 'translate(0, -50%)',
                  fontSize: `${field.fontSize * 0.6}px`,
                  color: !readOnly && isEditing ? '#d97706' : field.color,
                  fontFamily: field.fontFamily,
                  fontWeight: field.isBold ? 'bold' : 'normal',
                  textAlign: field.align,
                  lineHeight: `${field.lineHeight * 0.6}px`,
                }}
                className={`absolute select-none p-1 rounded transition ${
                  !readOnly && isEditing
                    ? selectedFieldKey === field.key
                      ? 'ring-2 ring-amber-500 bg-amber-100/90 font-mono shadow'
                      : 'border border-dashed border-amber-400 bg-amber-50/70 font-mono'
                    : ''
                }`}
              >
                {displayText}
              </div>
            );
          })}

        {/* Certificate Number Element */}
        {certNoConf.visible && (
          <div
            onClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              setSelectedFieldKey('cert_no');
            }}
            style={{
              left: `${certNoConf.x}%`,
              top: `${certNoConf.y}%`,
              fontSize: `${certNoConf.fontSize * 0.65}px`,
              color: !readOnly && isEditing ? '#d97706' : certNoConf.color,
              fontWeight: certNoConf.isBold ? 'bold' : 'normal',
            }}
            className={`absolute select-none font-mono p-1 rounded transition ${
              !readOnly && isEditing
                ? selectedFieldKey === 'cert_no'
                  ? 'ring-2 ring-amber-500 bg-amber-100/90 shadow'
                  : 'border border-dashed border-amber-400 bg-amber-50/70'
                : ''
            }`}
          >
            Cert No: {cert.certificate_no}
          </div>
        )}

        {/* QR Code Element */}
        {event.qrConfig.visible && (
          <div
            onClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              setSelectedFieldKey('qr_code');
            }}
            style={{
              left: `${event.qrConfig.x}%`,
              top: `${event.qrConfig.y}%`,
              width: `${event.qrConfig.size * 0.65}px`,
              height: `${event.qrConfig.size * 0.65}px`,
            }}
            className={`absolute p-1 bg-white rounded border select-none ${
              !readOnly && isEditing && selectedFieldKey === 'qr_code' ? 'ring-2 ring-amber-400' : ''
            }`}
          >
            <QRCodeCanvas
              value={`${window.location.origin}/verify?id=${encodeURIComponent(cert.certificate_no)}`}
              size={event.qrConfig.size * 0.55}
              level="M"
            />
          </div>
        )}
      </div>

      {/* Hidden processing canvas */}
      <div className="hidden">
        <canvas ref={hiddenCanvasRef} />
        <div ref={qrRef}>
          <QRCodeCanvas
            value={`${window.location.origin}/verify?id=${encodeURIComponent(cert.certificate_no)}`}
            size={event.qrConfig.size * 2}
            level="H"
          />
        </div>
      </div>
    </div>
  );
};