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
for (const f of fs.readdirSync(source).filter((f) => /^s\d+\.json$/.test(f)).sort()) {
  for (const [board, c] of Object.entries(read(path.join(source, f)).boards ?? {})) {
    written[id(board)] = { must: c.must ?? [], absent: c.absent ?? [], source: `checks/${f}` };
  }
}
const r2 = path.join(source, 'r2.json');
if (fs.existsSync(r2)) {
  for (const [board, c] of Object.entries(read(r2).redraw ?? {})) {
    const w = written[id(board)];
    if (!w) continue; // r2-only boards keep no json: they still need a real check
    w.must = [...new Set([...w.must, ...(c.must ?? []), ...(c.file_must ?? [])])];
    w.absent = [...new Set([...w.absent, ...(c.absent ?? []), ...(c.file_absent ?? [])])];
  }
}

fs.mkdirSync(out, { recursive: true });
const missing = [];
for (const board of order) {
  const file = path.join(out, `${board}.json`);
  const existing = fs.existsSync(file) ? read(file) : null;
  if (existing?.source === 'written') continue; // hand-written checks are never overwritten
  if (written[board]) fs.writeFileSync(file, JSON.stringify(written[board], null, 2) + '\n');
  else if (!existing) missing.push(board);
}
if (missing.length) {
  console.log(`${missing.length} boards without checks:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`all ${order.length} boards have checks`);
