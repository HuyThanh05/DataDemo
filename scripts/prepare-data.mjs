import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'data/raw/diem_thi_2026_da_nang.csv');
const output = path.join(root, 'data/processed/diem_thi_2026_da_nang_long.csv');
// CSV parser supports quoted fields, escaped quotes and CRLF.
function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(value); value = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else if (!(c === '\r' && !quoted)) value += c;
  }
  assert(!quoted, 'Unclosed CSV quote');
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}
const subjects = {
  Toan: 'Toán', NguVan: 'Ngữ văn', VatLy: 'Vật lí', HoaHoc: 'Hóa học',
  SinhHoc: 'Sinh học', LichSu: 'Lịch sử', DiaLy: 'Địa lí',
  KinhTePhapLuat: 'Giáo dục kinh tế và pháp luật', TinHoc: 'Tin học',
  CongNgheCongNghiep: 'Công nghệ công nghiệp',
  CongNgheNongNghiep: 'Công nghệ nông nghiệp', NgoaiNgu: 'Ngoại ngữ',
};
const languages = { N1: 'Tiếng Anh', N2: 'Tiếng Nga', N3: 'Tiếng Pháp',
  N4: 'Tiếng Trung Quốc', N5: 'Tiếng Đức', N6: 'Tiếng Nhật', N7: 'Tiếng Hàn' };
const source = fs.readFileSync(input);
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const [headers, ...rows] = parseCSV(source.toString('utf8').replace(/^\uFEFF/, ''));
for (const key of ['SBD', 'Nam', 'Tinh', 'MaMonNgoaiNgu', ...Object.keys(subjects)])
  assert(headers.includes(key), `Missing column: ${key}`);
const candidates = new Map(), records = new Map(), expected = new Map();
let exactDuplicates = 0, missingScores = 0, zeroScores = 0;
function addStat(map, key, cents) {
  const s = map.get(key) ?? { count: 0, sumCents: 0, zeroCount: 0 };
  s.count++; s.sumCents += cents; s.zeroCount += Number(cents === 0); map.set(key, s);
}
for (const row of rows) {
  assert.equal(row.length, headers.length, 'Invalid CSV row width');
  const r = Object.fromEntries(headers.map((h, i) => [h, row[i].trim()]));
  assert(/^48\d{6}$/.test(r.SBD), `Invalid candidate ID: ${r.SBD}`);
  assert.equal(r.Nam, '26'); assert.equal(r.Tinh, '48');
  if (candidates.has(r.SBD)) {
    assert.equal(candidates.get(r.SBD), JSON.stringify(r), `Conflicting duplicate: ${r.SBD}`);
    exactDuplicates++; continue;
  }
  candidates.set(r.SBD, JSON.stringify(r));
  for (const [column, label] of Object.entries(subjects)) {
    const value = r[column];
    if (value === '') { missingScores++; continue; }
    assert(/^\d+(\.\d{1,2})?$/.test(value), `Invalid score: ${value}`);
    const cents = Math.round(Number(value) * 100);
    assert(cents >= 0 && cents <= 1000, `Score out of range: ${value}`);
    const language = column === 'NgoaiNgu' ? r.MaMonNgoaiNgu : '';
    if (column === 'NgoaiNgu') assert(languages[language], `Unknown language: ${language}`);
    const subject = column === 'NgoaiNgu' ? languages[language] : label;
    const code = column === 'NgoaiNgu' ? `NgoaiNgu_${language}` : column;
    const key = `${r.SBD}|${code}`;
    assert(!records.has(key), `Duplicate candidate/subject: ${key}`);
    records.set(key, [r.SBD, '2026', '48', 'Đà Nẵng', code, subject, language, (cents / 100).toFixed(2)]);
    addStat(expected, code, cents);
    zeroScores += Number(cents === 0);
  }
}
const columns = ['ma_thi_sinh', 'nam', 'ma_tinh', 'tinh_thanh', 'ma_mon', 'mon_hoc', 'ma_ngoai_ngu', 'diem'];
const escape = v => /[",\r\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v;
const sorted = [...records.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[4].localeCompare(b[4]));
const csv = [columns, ...sorted].map(r => r.map(escape).join(',')).join('\n') + '\n';
// Reparse serialized output and compare counts and exact integer score sums.
const [, ...actualRows] = parseCSV(csv);
const actual = new Map(); const actualCandidates = new Set();
for (const r of actualRows) { actualCandidates.add(r[0]); addStat(actual, r[4], Math.round(Number(r[7]) * 100)); }
assert.equal(actualCandidates.size, candidates.size, 'Candidate count changed');
assert.deepEqual([...actual].sort(), [...expected].sort(), 'Score statistics changed');
assert.equal(actualRows.length + missingScores, candidates.size * Object.keys(subjects).length);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'), sourceHash);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, csv, 'utf8');
const report = {
  input: path.relative(root, input), output: path.relative(root, output),
  sourceSha256: sourceHash, outputSha256: crypto.createHash('sha256').update(csv).digest('hex'),
  sourceRows: rows.length, candidates: candidates.size, exactDuplicateRowsRemoved: exactDuplicates,
  scoreRows: actualRows.length, missingSubjectCellsOmitted: missingScores, zeroScoresPreserved: zeroScores,
  checks: { rawFileUnchanged: true, candidateCountMatches: true, perSubjectCountsAndSumsMatch: true },
  subjects: Object.fromEntries([...actual].sort().map(([k, s]) => [k, {
    ...s, average: s.sumCents / 100 / s.count,
  }])),
};
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/data-preparation-2026.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
