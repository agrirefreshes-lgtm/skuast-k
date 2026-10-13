import React from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import type { UploadedColumnDefinition } from '../types/certificate';
import { parseDelimitedText, recordsFromRows } from '../lib/certificateFields';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

interface Props {
  onParsed: (
    records: Record<string, string>[],
    columns: UploadedColumnDefinition[],
    fileName: string,
    replaceExisting: boolean  // Whether to replace or merge fields
  ) => void;
}

export const ExcelUploader: React.FC<Props> = ({ onParsed }) => {
  const toast = useToast();
  const confirm = useConfirm();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Ask the coordinator how new columns should combine with any existing
    // fields already placed on the canvas: fresh replace, or additive merge.
    const replaceExisting = await confirm({
      title: 'How should these columns be applied?',
      message:
        'Each event can have its own certificate layout. Choose whether the new ' +
        'spreadsheet columns should replace the existing placeholders, or be ' +
        'merged alongside them.',
      confirmText: 'Replace existing',
      cancelText: 'Merge (keep + add)',
    });

    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text !== 'string') {
          toast.error('Could not read file', 'The CSV file could not be read. Please try again.');
          e.target.value = '';
          return;
        }
        const { records, columns } = parseDelimitedText(text);
        if (records.length === 0) {
          toast.warning('No data found', 'The CSV appears to be empty or has no valid rows.');
          e.target.value = '';
          return;
        }
        toast.success('File parsed', `${records.length} row(s) detected across ${columns.length} column(s).`);
        onParsed(records, columns, file.name, replaceExisting);
        e.target.value = '';
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }

    // Excel (.xlsx / .xls)
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      let wb;
      try {
        wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
      } catch {
        toast.error('Unsupported file', 'This file appears to be corrupt or is not a supported spreadsheet format.');
        e.target.value = '';
        return;
      }

      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        toast.error('No worksheet found', 'The workbook does not contain any readable sheet.');
        e.target.value = '';
        return;
      }

      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const { records, columns } = recordsFromRows(rawData);

      if (records.length === 0) {
        toast.warning('No data found', 'The spreadsheet is empty or has no valid rows.');
        e.target.value = '';
        return;
      }

      toast.success('File parsed', `${records.length} row(s) detected across ${columns.length} column(s).`);
      onParsed(records, columns, file.name, replaceExisting);
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="group border-2 border-dashed border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition bg-slate-50/60">
      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
        <UploadCloud size={24} />
      </div>
      <span className="font-bold text-slate-800 text-xs">Upload Candidate Batch (Excel / CSV)</span>
      <span className="text-[11px] text-slate-400 mt-1 text-center leading-relaxed">
        Supports <span className="font-semibold text-slate-500">.xlsx</span>,{' '}
        <span className="font-semibold text-slate-500">.xls</span> and{' '}
        <span className="font-semibold text-slate-500">.csv</span> — columns are auto-detected from the header row.
      </span>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-700 font-semibold">
        <FileSpreadsheet size={12} /> Click to browse
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </label>
  );
};