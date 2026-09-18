import React from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud } from 'lucide-react';

interface Props {
  onParsed: (records: Record<string, string>[], columns: string[], fileName: string) => void;
}

export const ExcelUploader: React.FC<Props> = ({ onParsed }) => {
  const normalizeHeaders = (headers: string[]): string[] =>
    headers.map((h) => h.trim().replace(/\s+/g, ' '));

  const parseCSVText = (raw: string): { records: Record<string, string>[]; headers: string[] } => {
    // If file looks like actual CSV (has newlines and commas)
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return { records: [], headers: [] };

    // Try to detect delimiter
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const delimiter = tabCount > commaCount ? '\t' : ',';

    const headers = normalizeHeaders(lines[0].split(delimiter));
    const records: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i], delimiter);
      if (values.length === 0) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] !== undefined ? values[idx].trim() : '';
      });
      records.push(row);
    }

    return { records, headers };
  };

  // Simple CSV line splitter that respects quoted values
  const splitCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

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
        const { records, headers } = parseCSVText(text);
        if (records.length === 0) {
          alert('CSV khali hai ya koi row nahi mili!');
          return;
        }
        onParsed(records, headers, file.name);
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
      const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawData.length === 0) {
        alert('File khali hai ya koi row nahi mili!');
        return;
      }

      const headers = normalizeHeaders(Object.keys(rawData[0]));
      const parsed = rawData.map((row) => {
        const item: Record<string, string> = {};
        headers.forEach((col) => {
          const val = row[col];
          item[col] = val === null || val === undefined ? '' : String(val);
        });
        return item;
      });

      onParsed(parsed, headers, file.name);
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