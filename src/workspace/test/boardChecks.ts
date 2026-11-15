/**
 * Board acceptance check: `src/workspace/__fixtures__/board-checks/<boardId>.json`
 * (`{ must: string[]; absent: string[] }`, ported from the design checks)
 * against the rendered text, with whitespace collapsed on both sides.
 *
 * `staged` lists must strings a later task builds (a board built in stages,
 * as r4 in 1.8 / 6.4): they are skipped here, and each must still be in the
 * board's list, so the later task's full check cannot silently lose one.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface BoardCheck {
  must?: string[];
  absent?: string[];
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function expectBoard(boardId: string, container: HTMLElement, { staged = [] }: { staged?: string[] } = {}): void {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__/board-checks', `${boardId}.json`);
  const check = JSON.parse(readFileSync(file, 'utf8')) as BoardCheck;
  const text = norm(container.textContent ?? '');
  const unknown = staged.filter((s) => !(check.must ?? []).includes(s));
  if (unknown.length) throw new Error(`Board ${boardId}: staged strings not in its must list: ${JSON.stringify(unknown)}`);
  const missing = (check.must ?? []).filter((s) => !staged.includes(s) && !text.includes(norm(s)));
  const present = (check.absent ?? []).filter((s) => text.includes(norm(s)));
  if (missing.length || present.length) {
    throw new Error(
      `Board ${boardId}:` +
        (missing.length ? `\n  missing must: ${JSON.stringify(missing)}` : '') +
        (present.length ? `\n  present absent: ${JSON.stringify(present)}` : ''),
    );
  }
}
