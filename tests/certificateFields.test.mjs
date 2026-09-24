import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  createColumnDefinitions,
  getFieldDisplayLabel,
  getFieldWidthPercent,
  isFieldPlaced,
  normalizeFieldReference,
  parseDelimitedText,
  reconcileDynamicFields,
  recordsFromRows,
  resolveFieldReferenceValue,
  toFieldKey,
  resolveFieldValue,
} from '../src/lib/certificateFields.ts';

const legacyField = (overrides = {}) => ({
  key: 'name',
  label: 'Name',
  x: 25,
  y: 30,
  fontSize: 20,
  color: '#111111',
  fontFamily: 'Georgia, serif',
  isBold: true,
  align: 'center',
  maxWidth: 50,
  lineHeight: 24,
  visible: true,
  ...overrides,
});

test('detects arbitrary headers and creates collision-safe source and field keys', () => {
  const columns = createColumnDefinitions([
    'Name', 'Father Name', 'Course / Level', 'Name', '', 'Certificate No', '__proto__'
  ]);
  assert.deepEqual(columns.map((column) => column.label), [
    'Name', 'Father Name', 'Course / Level', 'Name', 'Column 5', 'Certificate No', '__proto__'
  ]);
  assert.equal(new Set(columns.map((column) => column.key)).size, columns.length);
  assert.equal(columns[1].key, 'Father Name');
  assert.notEqual(columns[3].key, columns[0].key);
  assert.equal(columns[2].key, 'Course / Level');
  assert.equal(columns[4].key, 'Column 5');
  assert.equal(columns[5].key, 'uploaded_certificate_no');
  assert.equal(columns[6].key, '__proto__');
});

test('parses quoted CSV values and keeps each duplicate column', () => {
  const { columns, records } = parseDelimitedText(
    'Name,Name,Course,Notes\r\nRahul,Rahul Kumar,"Agriculture, Semester I","Said ""Yes"""\r\nKashmir,,,"Line 1\nLine 2"'
  );
  assert.equal(columns.length, 4);
  assert.equal(records.length, 2);
  assert.equal(records[0][columns[0].key], 'Rahul');
  assert.equal(records[0][columns[1].key], 'Rahul Kumar');
  assert.equal(records[0][columns[2].key], 'Agriculture, Semester I');
  assert.equal(records[0][columns[3].key], 'Said "Yes"');
  assert.equal(records[1][columns[1].key], '');
  assert.equal(records[1][columns[2].key], '');
});

test('CSV delimiter detection supports a quoted newline inside a header', () => {
  const { columns, records } = parseDelimitedText('"Father\nName";Course;District\nRamesh;Agriculture;Jammu');
  assert.deepEqual(columns.map((column) => column.label), ['Father Name', 'Course', 'District']);
  assert.equal(records[0].Course, 'Agriculture');
});

test('parses every positioned column from Excel-style row arrays', () => {
  const { columns, records } = recordsFromRows([
    ['Name', 'District', 'Course', 'Notes'],
    ['Rahul', 'Jammu', 'Agriculture', 'First'],
    ['Kashmir', '', '', 'Second'],
  ]);
  assert.equal(columns.length, 4);
  assert.equal(records[0].District, 'Jammu');
  assert.equal(records[1].District, '');
  assert.equal(records[1].Course, '');
});


test('Excel workbook rows preserve actual headers, duplicate columns, and missing values', () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Name', 'Course / Level', 'District'],
    ['Rahul', 'Rahul Kumar', 'Agriculture', 'Jammu'],
    ['Kashmir', '', '', 'Kashmir'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
  const binary = XLSX.write(workbook, { type: 'binary', bookType: 'xls' });
  const parsedWorkbook = XLSX.read(binary, { type: 'binary', cellDates: false });
  const rows = XLSX.utils.sheet_to_json(parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]], {
    header: 1,
    defval: '',
  });
  const { columns, records } = recordsFromRows(rows);
  assert.deepEqual(columns.map((column) => column.label), ['Name', 'Name', 'Course / Level', 'District']);
  assert.equal(records[0][columns[1].key], 'Rahul Kumar');
  assert.equal(records[1][columns[1].key], '');
  assert.equal(records[1][columns[2].key], '');
});

test('new fields remain source references and resolve independently for every row', () => {
  const columns = createColumnDefinitions(['Name', 'District', 'Course']);
  const fields = reconcileDynamicFields([], columns);
  const row1 = { Name: 'Rahul', District: 'Jammu', Course: 'Agriculture' };
  const row2 = { Name: 'Kashmir', District: 'Kashmir', Course: 'Horticulture' };
  assert.equal(fields[1].label, 'District');
  assert.equal(fields[1].sourceKey, 'District');
  assert.equal(fields[1].isPlaced, false);
  assert.equal(resolveFieldValue(row1, fields[1]), 'Jammu');
  assert.equal(resolveFieldValue(row2, fields[1]), 'Kashmir');
  assert.equal(fields[1].label, 'District');
});

test('legacy fields keep layout and load while gaining the uploaded source reference', () => {
  const existing = [legacyField()];
  const fields = reconcileDynamicFields(existing, createColumnDefinitions(['Name', 'District']));
  assert.equal(fields.length, 2);
  assert.equal(isFieldPlaced(fields[0]), true);
  assert.deepEqual(
    { x: fields[0].x, y: fields[0].y, maxWidth: fields[0].maxWidth, label: fields[0].label },
    { x: 25, y: 30, maxWidth: 50, label: 'Name' }
  );
  assert.equal(existing[0].sourceKey, undefined);
  assert.equal(fields[0].sourceKey, 'Name');
});

test('legacy pixel widths and new percent widths render within content-safe bounds', () => {
  assert.equal(getFieldWidthPercent(60), 60);
  assert.equal(getFieldWidthPercent(750), 36.73);
  assert.equal(getFieldWidthPercent(0), 0);
  assert.equal(getFieldWidthPercent(100), 100);
});

test('reference resolution supports saved field keys, labels, and human-readable display', () => {
  const fields = reconcileDynamicFields([], createColumnDefinitions(['Father Name']));
  const data = { 'Father Name': 'Ramesh' };
  assert.equal(resolveFieldReferenceValue(data, fields, 'Father Name'), 'Ramesh');
  assert.equal(resolveFieldReferenceValue({ father_name: 'Ramesh' }, fields, 'father_name'), 'Ramesh');
  assert.equal(getFieldDisplayLabel(fields, 'Father Name'), 'Father Name');
  assert.equal(getFieldDisplayLabel(fields, 'missing'), 'missing');
  assert.equal(normalizeFieldReference(fields, 'Father Name'), 'Father Name');
});

test('many columns retain order and unique definitions without a fixed maximum', () => {
  const headers = Array.from({ length: 1000 }, (_, index) => `Field ${index + 1}`);
  const columns = createColumnDefinitions(headers);
  assert.equal(columns.length, 1000);
  assert.equal(new Set(columns.map((column) => column.key)).size, 1000);
  assert.equal(columns[999].sourceIndex, 999);
});

test('non-ASCII and symbol-only headers receive stable safe field keys', () => {
  const first = reconcileDynamicFields([], createColumnDefinitions(['अनुभाग']))[0];
  const reordered = reconcileDynamicFields([], createColumnDefinitions(['Roll Number', 'अनुभाग']))[1];
  assert.match(first.key, /^column_[a-z0-9]+$/);
  assert.equal(reordered.key, first.key);
  assert.match(toFieldKey('—'), /^column_[a-z0-9]+$/);
});
