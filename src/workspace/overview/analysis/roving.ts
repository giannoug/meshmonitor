import type { KeyboardEvent } from 'react';

/**
 * Arrow / Home / End between the radios of one group (the pattern of
 * `patterns/RowMenu`): wraps at both ends. Focus only moves, unless `select`
 * is set, which also picks the radio it lands on (a radiogroup's own arrows).
 */
export function rovingKeyDown(e: KeyboardEvent<HTMLElement>, role: string, select = false): void {
  const list = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(`[role="${role}"]`) ?? []);
  const at = list.indexOf(e.currentTarget);
  const to = { ArrowDown: at + 1, ArrowRight: at + 1, ArrowUp: at - 1, ArrowLeft: at - 1, Home: 0, End: list.length - 1 }[e.key];
  if (to === undefined || at < 0) return;
  e.preventDefault();
  const target = list[(to + list.length) % list.length];
  target.focus();
  if (select) target.click();
}
