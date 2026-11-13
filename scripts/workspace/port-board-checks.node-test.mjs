import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.join(import.meta.dirname, 'port-board-checks.mjs');

function run(setup) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pbc-'));
  fs.mkdirSync(path.join(d, 'checks'));
  fs.mkdirSync(path.join(d, 'out'));
  const w = (f, o) => fs.writeFileSync(path.join(d, f), JSON.stringify(o));
  setup(w, d);
  const r = spawnSync('node', [script, '--source', path.join(d, 'checks'), '--canvas', path.join(d, 'canvas.json'), '--out', path.join(d, 'out')], { encoding: 'utf8' });
  return { r, read: (b) => JSON.parse(fs.readFileSync(path.join(d, 'out', `${b}.json`), 'utf8')), d };
}

test('redraw, sidebar_must and r2-only boards are ported as partial', () => {
  const { r, read } = run((w) => {
    w('checks/s99.json', {
      boards: { 'x1.dc.html': { must: ['A'], absent: [] } },
      redraw: { 'x1.dc.html': { sidebar_must: ['S'], absent: ['N'] }, 'x2.dc.html': { must: ['R'], sidebar_must: ['T'] } },
    });
    w('checks/r2.json', { redraw: { 'x3.dc.html': { must: [], file_must: ['F'], file_absent: ['G'] } } });
    w('canvas.json', { order: ['x1.dc.html', 'x2.dc.html', 'x3.dc.html', 'x4.dc.html'] });
  });
  assert.deepEqual(read('x1'), { must: ['A', 'S'], absent: ['N'], source: 'checks/s99.json' });
  assert.deepEqual(read('x2'), { must: ['R', 'T'], absent: [], source: 'checks/s99.json', partial: true });
  assert.deepEqual(read('x3'), { must: ['F'], absent: ['G'], source: 'checks/r2.json', partial: true });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /x4/);
});

test('a written json is never overwritten nor listed as missing', () => {
  const { r, d } = run((w, d) => {
    w('checks/s99.json', { boards: { 'x1.dc.html': { must: ['A'], absent: [] } } });
    w('canvas.json', { order: ['x1.dc.html', 'x2.dc.html'] });
    fs.writeFileSync(path.join(d, 'out/x1.json'), '{"must":["Z"],"absent":[],"source":"written"}');
    fs.writeFileSync(path.join(d, 'out/x2.json'), '{"must":["Y"],"absent":[],"source":"written"}');
  });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'out/x1.json'), 'utf8')).must[0], 'Z');
});

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
