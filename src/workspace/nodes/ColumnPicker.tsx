/**
 * Columns (board f3-nodes): a popover listing the table's optional columns,
 * the visible ones first in their order. A check shows or hides a column;
 * dragging a row, or Alt+Up / Alt+Down on its checkbox, moves it. Every change
 * is saved at once (`useNodeColumns`).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NODE_COLUMNS } from './nodeColumns';
import styles from './NodesTable.module.css';

export interface ColumnPickerProps {
  columns: string[];
  onChange(next: string[]): void;
}

export default function ColumnPicker({ columns, onChange }: ColumnPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const order = [...columns, ...NODE_COLUMNS.map((c) => c.id).filter((id) => !columns.includes(id))];
  const label = (id: string) => t(NODE_COLUMNS.find((c) => c.id === id)!.label);

  // Close on a press outside or Escape, as today's Export menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const save = (list: string[], visible: Set<string>) => onChange(list.filter((id) => visible.has(id)));
  const toggle = (id: string, on: boolean) => {
    const visible = new Set(columns);
    if (on) visible.add(id);
    else visible.delete(id);
    save(order, visible);
  };
  const move = (id: string, to: number) => {
    if (to < 0 || to >= order.length) return;
    const list = order.filter((x) => x !== id);
    list.splice(to, 0, id);
    save(list, new Set(columns));
  };
  const onKeyDown = (id: string) => (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    move(id, order.indexOf(id) + (e.key === 'ArrowUp' ? -1 : 1));
  };

  return (
    <div className={styles.pickerWrap} ref={ref}>
      <button type="button" className={styles.chip} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <UiIcon name="list" size={16} />
        {t('workspace.nodes.columns')}
      </button>
      {open && (
        <div className={styles.picker} role="group" aria-labelledby="node-columns-title">
          <p id="node-columns-title" className={styles.pickerTitle} title={t('workspace.nodes.columns_keys')}>
            {t('workspace.nodes.columns_hint')}
          </p>
          <ul>
            {order.map((id) => (
              <li
                key={id}
                draggable
                data-dragging={dragging === id || undefined}
                onDragStart={(e) => {
                  setDragging(id);
                  e.dataTransfer?.setData('text/plain', id);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && dragging !== id) move(dragging, order.indexOf(id));
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
              >
                <UiIcon name="dragHandle" size={16} className={styles.grip} />
                <label>
                  <input type="checkbox" checked={columns.includes(id)} onChange={(e) => toggle(id, e.target.checked)} onKeyDown={onKeyDown(id)} />
                  {label(id)}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
