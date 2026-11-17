/**
 * RowMenu: a row's ⋯ menu (Task 6.3's theme menu, made shared in Task 6.4 for
 * the Map & tiles, Channel database and Embed rows). The menu is portalled to
 * <body> with fixed placement under ⋯ (above it when there is no room below,
 * and inside the window's width),
 * so a card's `overflow: hidden` never clips it (6.4 I1); a scroll or resize
 * moves it with ⋯. Opening focuses the first item; ArrowUp / ArrowDown / Home /
 * End move between items, wrapping; Escape closes only the menu (CR) and
 * returns focus to ⋯; a click outside closes it. An item with `checked` is a menuitemcheckbox.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './RowMenu.module.css';

export interface RowMenuItem {
  key: string;
  label: string;
  icon: UiIconName;
  danger?: boolean;
  disabled?: boolean;
  /** On/off items (menuitemcheckbox). */
  checked?: boolean;
  onSelect(): void;
}

const GAP = 4;

export default function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  const buttons = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);

  // Under ⋯, right-aligned to it; above it when the menu would leave the window.
  const placeMenu = () => {
    if (!trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    const width = menu.current?.offsetWidth ?? 0;
    const below = r.bottom + GAP + height <= window.innerHeight;
    // Right-aligned to ⋯, kept inside the window on both sides (a wrapped row puts ⋯ at the left).
    const left = Math.max(GAP, Math.min(r.right - width, window.innerWidth - width - GAP));
    setPlace({
      left,
      ...(below ? { top: r.bottom + GAP } : { bottom: window.innerHeight - r.top + GAP }),
    });
  };

  useLayoutEffect(() => {
    if (open) placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrap.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    // The page moving under the menu moves the menu with ⋯.
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', placeMenu, true);
    window.addEventListener('resize', placeMenu);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', placeMenu, true);
      window.removeEventListener('resize', placeMenu);
    };
  }, [open]);

  // The portal's keys still bubble to this wrapper through React.
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
      {open &&
        createPortal(
          <span className={styles.menu} role="menu" aria-label={label} ref={menu} style={place} data-phone={isPhone || undefined}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={item.checked}
                className={styles.menuItem}
                data-phone={isPhone || undefined}
                data-danger={item.danger ? '' : undefined}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <UiIcon name={item.checked === undefined ? item.icon : item.checked ? 'check' : item.icon} size={16} />
                {item.label}
              </button>
            ))}
          </span>,
          document.body,
        )}
    </span>
  );
}
