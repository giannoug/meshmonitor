/**
 * Where focus goes after a keyboard delete (#6365 follow-ups): the deleted row takes its ⋯ opener with it,
 * so focus would fall to <body>. The rows are MessageRowD's desktop keyboard stops; phone rows have none.
 */
const ROWS = '[data-row-target][data-message-id]';

export interface DeleteFocus {
  id: string;
  neighbour: string;
  /** The deleted row's position, for when the neighbour has gone too. */
  index: number;
  /** Its thread, so focus never lands in another list. */
  list: Element;
}

const rowsIn = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>(ROWS));

/** Before the delete: the row after `id` in its thread, else the one before. Null when there is none. */
export function rememberDeleteFocus(id: string): DeleteFocus | null {
  const row = rowsIn(document).find((r) => r.dataset.messageId === id);
  const list = row?.closest('[role="log"]') ?? row?.parentElement;
  if (!row || !list) return null;
  const rows = rowsIn(list);
  const index = rows.indexOf(row);
  const neighbour = (rows[index + 1] ?? rows[index - 1])?.dataset.messageId;
  return neighbour ? { id, neighbour, index, list } : null;
}

/** After the confirm closes: focus the neighbour, or the row now at the deleted one's place, once the row is gone. */
export function focusAfterDelete(p: DeleteFocus): void {
  const rows = rowsIn(p.list);
  // Cancelled, or the delete failed: the row is still there and the sheet already gave focus back.
  if (rows.some((r) => r.dataset.messageId === p.id)) return;
  (rows.find((r) => r.dataset.messageId === p.neighbour) ?? rows[Math.min(p.index, rows.length - 1)])?.focus();
}
