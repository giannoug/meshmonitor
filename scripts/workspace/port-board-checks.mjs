// Ports design-scratch/checks/{s*,r2}.json into one <board>.json per board.
// usage: node scripts/workspace/port-board-checks.mjs [--source dir] [--canvas canvas.json] [--out dir]
// Exits 1 (listing them) while any board in the canvas order has no json.
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const source = arg('source', 'design-scratch/checks');
const canvas = arg('canvas', 'design-scratch/out3/project/canvas.json');
const out = arg('out', 'src/workspace/__fixtures__/board-checks');
const SKIP = /^a-chat-[ABC]-/;
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const id = (f) => f.replace(/\.dc\.html$/, '');

const order = read(canvas).order.map(id).filter((b) => !SKIP.test(b));
const written = {};
// boards entries are full data; redraw / sidebar blocks add strings and, when they are a board's
// only data, make a "partial" json for the check-writer to extend.
const add = (board, c, file, full) => {
  const w = (written[id(board)] ??= { must: [], absent: [], source: `checks/${file}`, partial: true });
  if (full) { w.partial = false; w.source = `checks/${file}`; }
  const u = (a, b) => [...new Set([...a, ...(b ?? [])])];
  w.must = u(w.must, [...(c.must ?? []), ...(c.file_must ?? []), ...(c.sidebar_must ?? [])]);
  w.absent = u(w.absent, [...(c.absent ?? []), ...(c.file_absent ?? [])]);
};
const files = fs.readdirSync(source).filter((f) => /^(s\d+|r2)\.json$/.test(f)).sort();
for (const f of files) {
  const d = read(path.join(source, f));
  for (const [b, c] of Object.entries(d.boards ?? {})) add(b, c, f, true);
}
for (const f of files) {
  const d = read(path.join(source, f));
  for (const [b, c] of Object.entries(d.redraw ?? {})) add(b, c, f, false);
}
for (const w of Object.values(written)) if (!w.partial) delete w.partial;

fs.mkdirSync(out, { recursive: true });
const missing = [];
const partial = [];
for (const board of order) {
  const file = path.join(out, `${board}.json`);
  const existing = fs.existsSync(file) ? read(file) : null;
  if (existing?.source === 'written') continue; // hand-written checks are never overwritten
  if (written[board]?.partial) partial.push(board);
  if (written[board]) fs.writeFileSync(file, JSON.stringify(written[board], null, 2) + '\n');
  else if (!existing) missing.push(board);
}
if (partial.length) console.log(`${partial.length} partial (extend):\n${partial.join('\n')}`);
if (missing.length) {
  console.log(`${missing.length} boards without checks:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`all ${order.length} boards have checks`);
