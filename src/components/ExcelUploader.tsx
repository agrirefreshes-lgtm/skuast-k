import React from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud } from 'lucide-react';
import type { UploadedColumnDefinition } from '../types/certificate';
import { parseDelimitedText, recordsFromRows } from '../lib/certificateFields';

interface Props {
  onParsed: (
    records: Record<string, string>[],
    columns: UploadedColumnDefinition[],
    fileName: string
  ) => void;
}

export const ExcelUploader: React.FC<Props> = ({ onParsed }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text !== 'string') {
          alert('CSV file read error!');
          return;
        }
        const { records, columns } = parseDelimitedText(text);
        if (records.length === 0) {
          alert('CSV khali hai ya koi row nahi mili!');
          return;
        }
        onParsed(records, columns, file.name);
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
        alert('File corrupt hai ya support nahi hai!');
        return;
      }

      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        alert('Koi sheet nahi mili!');
        return;
      }

      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const { records, columns } = recordsFromRows(rawData);

      if (records.length === 0) {
        alert('File khali hai ya koi row nahi mili!');
        return;
      }

      onParsed(records, columns, file.name);
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="border-2 border-dashed border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-700 transition bg-gray-50">
      <UploadCloud className="text-emerald-800 mb-2" size={28} />
      <span className="font-semibold text-gray-700 text-xs">Upload Excel / CSV Sheet (Candidate Batch)</span>
      <span className="text-[11px] text-gray-400 mt-0.5">Excel ya CSV dono support. Columns auto-detect hote hain.</span>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </label>
  );
};