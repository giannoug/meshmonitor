/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { focusAfterDelete, rememberDeleteFocus } from '../deleteFocus';

/** A thread: a role="log" list of keyboard rows (MessageRowD's attributes), with a day divider. */
function thread(label: string, ids: string[]): HTMLElement {
  const log = document.createElement('div');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', label);
  log.append(document.createElement('p'));
  for (const id of ids) {
    const row = document.createElement('div');
    row.dataset.messageId = id;
    row.setAttribute('data-row-target', '');
    row.tabIndex = 0;
    log.append(row);
  }
  document.body.append(log);
  return log;
}
const row = (id: string) => document.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!;
const focusedId = () => (document.activeElement as HTMLElement | null)?.dataset.messageId;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('delete focus hand-off', () => {
  it('focuses the next row once the deleted one is gone', () => {
    thread('a', ['a1', 'a2', 'a3']);
    const pending = rememberDeleteFocus('a2')!;
    row('a2').remove();
    focusAfterDelete(pending);
    expect(focusedId()).toBe('a3');
  });

  it('the last row hands focus back to the one before it, never into another thread', () => {
    thread('a', ['a1', 'a2']);
    thread('b', ['b1', 'b2']);
    const pending = rememberDeleteFocus('a2')!;
    row('a2').remove();
    focusAfterDelete(pending);
    expect(focusedId()).toBe('a1');
  });

  it('a neighbour removed meanwhile falls back to the row now in the deleted one\'s place', () => {
    thread('a', ['a1', 'a2', 'a3', 'a4']);
    const pending = rememberDeleteFocus('a2')!;
    row('a2').remove();
    row('a3').remove();
    focusAfterDelete(pending);
    expect(focusedId()).toBe('a4');
  });

  it('moves nothing while the deleted row is still there (cancel, failed delete)', () => {
    thread('a', ['a1', 'a2', 'a3']);
    const pending = rememberDeleteFocus('a2')!;
    focusAfterDelete(pending);
    expect(focusedId()).toBeUndefined();
  });

  it('remembers nothing for a lone row or an unknown id', () => {
    thread('a', ['a1']);
    expect(rememberDeleteFocus('a1')).toBeNull();
    expect(rememberDeleteFocus('nope')).toBeNull();
  });
});
