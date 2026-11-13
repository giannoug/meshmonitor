// usage: node scripts/workspace/contact-sheet.mjs <phase> [--out dir] [--spec file] [--canvas file]
// Writes <out>/contact-<phase>.html: each board's design PNG (design-scratch/png3) beside the
// built screenshot (test-results/workspace-boards), both inlined as data URIs.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const phase = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!phase) { console.error('usage: contact-sheet.mjs <phase> [--out dir]'); process.exit(2); }
const out = arg('out', '/tmp/claude-0/-home-user-meshmonitor/697fcf85-bdab-47c7-b33d-4f155d7bd718/scratchpad');
const spec = arg('spec', 'docs/superpowers/specs/2026-11-13-workspace-redesign-design.md');
const canvas = arg('canvas', 'design-scratch/out3/project/canvas.json');

const order = JSON.parse(fs.readFileSync(canvas, 'utf8')).order.map((f) => f.replace(/\.dc\.html$/, ''));
const key = (b) => b.match(/^(\d+)-(\d+)/)?.slice(1).map(Number);
const find = (t) => order.find((b) => b === t || b.startsWith(`${t}-`));

function expand(line) {
  // a board a later phase lists only as a frame ("counted in P1") is not repeated here
  const counted = /counted in (P\d)/.exec(line)?.[1];
  const skip = new Set();
  const list = line.replace(/\([^)]*\)/g, '').replace(/\bexcept\s+(\d+-\d+(?:\s+and\s+\d+-\d+)*)/g, (_, e) => { e.match(/\d+-\d+/g).forEach((x) => skip.add(x)); return ''; });
  const ids = [];
  for (const raw of list.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [a, z] = raw.split('…');
    if (z === undefined) { const b = find(a); if (b) ids.push(b); continue; }
    const ka = key(a), kz = key(z);
    if (ka && kz) ids.push(...order.filter((b) => { const k = key(b); return k && k[0] === ka[0] && k[1] >= ka[1] && k[1] <= kz[1]; }));
    else {
      const start = order.indexOf(find(a));
      const end = order.indexOf(find(z) ?? find(a.replace(/[a-z]?\d+$/, '') + z));
      ids.push(...order.slice(start, end + 1));
    }
  }
  return ids.filter((b) => !skip.has(b.match(/^\d+-\d+/)?.[0]) && !(counted && counted !== phase && b.startsWith('a-chat-D-')));
}

const m = fs.readFileSync(spec, 'utf8').match(new RegExp(`^- \\*\\*${phase} \\(\\d+\\):\\*\\* (.*)$`, 'm'));
if (!m) { console.error(`no phase ${phase} in Appendix A`); process.exit(2); }
const boards = [...new Set(expand(m[1]))];

const img = (p) => fs.existsSync(p) ? `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}">` : '<div class="none">no screenshot</div>';
const cells = boards.map((b) => `<section><h2>${b}</h2><div class="row"><figure>${img(`test-results/workspace-boards/${b}.png`)}<figcaption>built</figcaption></figure><figure>${img(`design-scratch/png3/${b}.png`)}<figcaption>design</figcaption></figure></div></section>`).join('\n');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `contact-${phase}.html`);
fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${phase} contact sheet</title><style>body{font:14px sans-serif;background:#222;color:#eee}.row{display:flex;gap:12px}figure{margin:0;flex:1;min-width:0}img{max-width:100%}.none{padding:40px;border:1px dashed #888;text-align:center}</style><h1>${phase} (${boards.length} boards)</h1>\n${cells}`);
console.log(`${file} (${boards.length} boards)`);
