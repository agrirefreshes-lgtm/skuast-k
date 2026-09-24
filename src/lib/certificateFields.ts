import type { DynamicFieldDef, UploadedColumnDefinition } from '../types/certificate';

const collapseWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const normalizeUploadedHeader = (value: unknown, index: number): string => {
  const normalized = collapseWhitespace(String(value ?? '').replace(/^\uFEFF/, ''));
  return normalized || `Column ${index + 1}`;
};

export const toFieldKey = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized) return normalized;

  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return `column_${(hash >>> 0).toString(36)}`;
};

const RESERVED_CERTIFICATE_DATA_KEYS = new Set(['Certificate No', 'certificate_no', 'Certificate_No']);

const makeUnique = (value: string, used: Set<string>): string => {
  const base = value || 'column';
  let key = base;
  let suffix = 2;
  while (used.has(key)) key = `${base}_${suffix++}`;
  used.add(key);
  return key;
};

const makeSourceKey = (label: string, used: Set<string>): string => {
  if (!RESERVED_CERTIFICATE_DATA_KEYS.has(label) && !used.has(label)) {
    used.add(label);
    return label;
  }
  const safeBase = RESERVED_CERTIFICATE_DATA_KEYS.has(label)
    ? `uploaded_${toFieldKey(label)}`
    : toFieldKey(label);
  return makeUnique(safeBase, used);
};

export const createColumnDefinitions = (headers: unknown[]): UploadedColumnDefinition[] => {
  const usedKeys = new Set<string>();
  return headers.map((header, sourceIndex) => {
    const label = normalizeUploadedHeader(header, sourceIndex);
    return {
      key: makeSourceKey(label, usedKeys),
      label,
      sourceIndex,
    };
  });
};

export const recordsFromRows = (rows: unknown[][]): {
  records: Record<string, string>[];
  columns: UploadedColumnDefinition[];
} => {
  const columnCount = rows.reduce((count, row) => Math.max(count, row.length), 0);
  const columns = createColumnDefinitions(Array.from({ length: columnCount }, (_, index) => rows[0]?.[index]));
  const records = rows.slice(1)
    .filter((row) => row.some((value) => String(value ?? '').trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = Object.create(null) as Record<string, string>;
      columns.forEach((column, index) => {
        record[column.key] = String(row[index] ?? '').trim();
      });
      return record;
    });
  return { records, columns };
};

const splitDelimitedText = (raw: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < raw.length; index++) {
    const character = raw[index];
    if (character === '"') {
      if (quoted && raw[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && raw[index + 1] === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
};

const getFirstRecord = (raw: string): string => {
  let quoted = false;
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] === '"') {
      if (quoted && raw[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if ((raw[index] === '\n' || raw[index] === '\r') && !quoted) {
      return raw.slice(0, index);
    }
  }
  return raw;
};

export const parseDelimitedText = (raw: string): {
  records: Record<string, string>[];
  columns: UploadedColumnDefinition[];
} => {
  const firstRecord = getFirstRecord(raw);
  const delimiter = [',', '\t', ';', '|']
    .reduce((best, candidate) => countDelimiter(firstRecord, candidate) > countDelimiter(firstRecord, best) ? candidate : best, ',');
  return recordsFromRows(splitDelimitedText(raw, delimiter));
};

export const isFieldPlaced = (field: DynamicFieldDef): boolean => field.isPlaced !== false;

export const getFieldWidthPercent = (maxWidth: number): number => {
  if (!Number.isFinite(maxWidth) || maxWidth < 0) return 60;
  // Older layouts stored pixels; the previous canvas used maxWidth * 0.55px.
  const percent = maxWidth > 100 ? (maxWidth * 0.55 / 1123) * 100 : maxWidth;
  return Math.min(100, Math.max(0, Number(percent.toFixed(2))));
};

const countDelimiter = (line: string, delimiter: string): number => {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (line[index] === delimiter && !quoted) count++;
  }
  return count;
};

export const resolveFieldValue = (
  data: Record<string, string>,
  field: Pick<DynamicFieldDef, 'key' | 'label' | 'sourceKey'>
): string => {
  const normalizedLabel = toFieldKey(field.label);
  const candidates = [field.sourceKey, field.key, field.label, normalizedLabel, toFieldKey(field.key)];
  for (const candidate of candidates) {
    if (candidate && Object.prototype.hasOwnProperty.call(data, candidate)) {
      return String(data[candidate] ?? '');
    }
  }
  return '';
};

export const findFieldByReference = (
  fields: DynamicFieldDef[],
  reference: string
): DynamicFieldDef | undefined => fields.find((field) =>
  field.sourceKey === reference || field.key === reference || field.label === reference
);

export const resolveFieldReferenceValue = (
  data: Record<string, string>,
  fields: DynamicFieldDef[],
  reference: string
): string => {
  const field = findFieldByReference(fields, reference);
  if (field) return resolveFieldValue(data, field);
  return Object.prototype.hasOwnProperty.call(data, reference) ? String(data[reference] ?? '') : '';
};

export const getFieldReference = (field?: DynamicFieldDef): string =>
  field?.sourceKey || field?.label || field?.key || '';

export const normalizeFieldReference = (fields: DynamicFieldDef[], reference: string): string =>
  getFieldReference(findFieldByReference(fields, reference)) || reference;

export const getFieldDisplayLabel = (fields: DynamicFieldDef[], reference: string): string =>
  findFieldByReference(fields, reference)?.label || reference;

const createDynamicField = (
  column: UploadedColumnDefinition,
  index: number,
  usedKeys: Set<string>
): DynamicFieldDef => ({
  key: makeUnique(toFieldKey(column.label), usedKeys),
  label: column.label,
  sourceKey: column.key,
  sourceIndex: column.sourceIndex,
  x: 50,
  y: 40 + (index % 8) * 8,
  fontSize: index === 0 ? 28 : 16,
  color: index === 0 ? '#0f5132' : '#222222',
  fontFamily: index === 0 ? 'Georgia, serif' : 'sans-serif',
  isBold: index === 0,
  align: 'center',
  maxWidth: 60,
  lineHeight: 24,
  visible: true,
  isPlaced: false,
});

export const reconcileDynamicFields = (
  existingFields: DynamicFieldDef[],
  columns: UploadedColumnDefinition[]
): DynamicFieldDef[] => {
  const fields = existingFields.map((field) => ({ ...field }));
  const originalFields = [...fields];
  const usedKeys = new Set(fields.map((field) => field.key));
  const matched = new Set<DynamicFieldDef>();

  columns.forEach((column, index) => {
    const existing = fields.find((field) => originalFields.includes(field) && !matched.has(field) && (
      field.sourceKey === column.key || field.label === column.label
    ));
    if (existing) {
      matched.add(existing);
      existing.sourceKey = column.key;
      existing.sourceIndex = column.sourceIndex;
      return;
    }
    fields.push(createDynamicField(column, index, usedKeys));
  });

  return fields;
};
