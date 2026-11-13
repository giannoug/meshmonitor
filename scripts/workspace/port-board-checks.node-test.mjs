import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.join(import.meta.dirname, 'port-board-checks.mjs');

test('ports s*.json boards, merges r2, lists boards without checks', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pbc-'));
  fs.mkdirSync(path.join(d, 'checks'));
  const w = (f, o) => fs.writeFileSync(path.join(d, f), JSON.stringify(o));
  w('checks/s99.json', { boards: {
    'x1.dc.html': { must: ['A'], absent: ['B'] },
    'x2.dc.html': { must: ['C'], absent: [] },
  } });
  w('checks/r2.json', { redraw: { 'x1.dc.html': { must: [], file_must: ['D'], file_absent: ['E'] } } });
  w('canvas.json', { order: ['x1.dc.html', 'x2.dc.html', 'x3.dc.html', 'a-chat-A-desktop.dc.html'] });
  const r = spawnSync('node', [script, '--source', path.join(d, 'checks'), '--canvas', path.join(d, 'canvas.json'), '--out', path.join(d, 'out')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /x3/);
  assert.doesNotMatch(r.stdout, /a-chat-A/);
  const x1 = JSON.parse(fs.readFileSync(path.join(d, 'out/x1.json'), 'utf8'));
  assert.deepEqual(x1, { must: ['A', 'D'], absent: ['B', 'E'], source: 'checks/s99.json' });
  assert.ok(fs.existsSync(path.join(d, 'out/x2.json')));
  assert.ok(!fs.existsSync(path.join(d, 'out/x3.json')));
});
