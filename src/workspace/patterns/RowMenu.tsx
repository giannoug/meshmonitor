/**
 * RowMenu: a row's ⋯ menu (Task 6.3's theme menu, made shared in Task 6.4 for
 * the Map & tiles and Channel database rows). Opening focuses the first item;
 * ArrowUp / ArrowDown / Home / End move between items, wrapping; Escape closes
 * only the menu (CR) and returns focus to ⋯; a click outside closes it.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './RowMenu.module.css';

export interface RowMenuItem {
  key: string;
  label: string;
  icon: UiIconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

export default function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  const buttons = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined || list.length === 0) return;
    e.preventDefault();
    list[(to + list.length) % list.length].focus();
  };

  return (
    <span className={styles.menuWrap} ref={wrap} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        data-phone={isPhone || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {open && (
        <span className={styles.menu} role="menu" aria-label={label} ref={menu}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              data-phone={isPhone || undefined}
              data-danger={item.danger ? '' : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <UiIcon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
