import React from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud } from 'lucide-react';

interface Props {
  onParsed: (records: Record<string, string>[], columns: string[], fileName: string) => void;
}

export const ExcelUploader: React.FC<Props> = ({ onParsed }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData: any[] = XLSX.utils.sheet_to_json(ws);

      if (rawData.length === 0) {
        alert('File khali hai ya koi row nahi mili!');
        return;
      }

      // 1. Auto capture all columns from Excel
      const headers = Object.keys(rawData[0]).map((h) => h.trim());

      // 2. Parse candidate rows
      const parsed = rawData.map((row) => {
        const item: Record<string, string> = {};
        headers.forEach((col) => {
          item[col] = String(row[col] ?? '');
        });
        return item;
      });

      onParsed(parsed, headers, file.name);
      e.target.value = ''; // Reset input to allow re-uploading same file name if needed
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="border-2 border-dashed border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-700 transition bg-gray-50">
      <UploadCloud className="text-emerald-800 mb-2" size={28} />
      <span className="font-semibold text-gray-700 text-xs">Upload Excel Sheet / Candidate Batch</span>
      <span className="text-[11px] text-gray-400 mt-0.5">Columns auto-detected. Multiple sheets supported.</span>
      <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
    </label>
  );
};