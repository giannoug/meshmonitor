/**
 * Sheet (spec §5.7): a modal panel docked to the bottom on phone and to the
 * right from 768 px (`side="auto"`). Rendered in <body>, so no fixed shell
 * element's stacking context can trap it. Esc, the backdrop and the close
 * button close it; Tab stays inside (`useDialogA11y`, as `common/Modal`).
 * A bottom sheet can opt in to `onSwipeUp` (the phone map peek, g1-map).
 * `dismissible={false}` drops all three (must-ack reveals, the forced
 * password change): only the sheet's own controls close it.
 */
import { useEffect, useId, useRef, type PointerEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  side?: 'auto' | 'bottom' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  /** Buttons in the head, before Close. */
  actions?: ReactNode;
  /** Bottom sheets: called on an upward swipe of at least SWIPE_UP_PX. Keep a visible control for the same action. */
  onSwipeUp?(): void;
  /** false: no close button, and Esc and the backdrop do nothing. Default true. */
  dismissible?: boolean;
  /** The scroll container (the body between head and footer). */
  bodyRef?: Ref<HTMLDivElement>;
}

const ignore = () => {};

/** Open sheets, oldest first: Esc reaches every sheet's document listener, so only the last one may act (CR). */
const openSheets: symbol[] = [];

const SWIPE_UP_PX = 64;

export default function Sheet(props: SheetProps) {
  return props.open ? createPortal(<OpenSheet {...props} />, document.body) : null;
}

/** Mounted only while open: the a11y hook focuses on mount and restores focus on unmount. */
function OpenSheet({ onClose: close, title, side = 'auto', children, footer, actions, onSwipeUp, dismissible = true, bodyRef }: SheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const onClose = dismissible ? close : ignore;
  const token = useRef(Symbol('sheet')).current;
  useEffect(() => {
    openSheets.push(token);
    return () => {
      const i = openSheets.indexOf(token);
      if (i >= 0) openSheets.splice(i, 1);
    };
  }, [token]);
  const { contentRef, onKeyDown } = useDialogA11y(() => {
    if (openSheets[openSheets.length - 1] === token) onClose();
  });
  const titleId = useId();
  const docked = side === 'auto' ? (isPhone ? 'bottom' : 'right') : side;
  const swipe = docked === 'bottom' ? onSwipeUp : undefined;
  const startY = useRef<number | null>(null);
  // The press starts on the sheet; the release is read on the layer, since a swipe can end above the sheet.
  const onPointerUp = (e: PointerEvent) => {
    if (swipe && startY.current !== null && startY.current - e.clientY >= SWIPE_UP_PX) swipe();
    startY.current = null;
  };

  return (
    <div className={styles.layer} onPointerUp={swipe && onPointerUp} onPointerCancel={swipe && (() => { startY.current = null; })}>
      <div className={styles.backdrop} onClick={onClose} data-testid="sheet-backdrop" aria-hidden="true" />
      <div
        ref={contentRef}
        className={styles.sheet}
        data-side={docked}
        data-swipe={swipe ? '' : undefined}
        onPointerDown={
          // React bubbles events out of a sheet opened from this one (a portal); only a press on this sheet counts.
          swipe && ((e) => { if (e.currentTarget.contains(e.target as Node)) startY.current = e.clientY; })
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {docked === 'bottom' && <span className={styles.handle} aria-hidden="true" />}
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {actions}
          {dismissible && (
            <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
              <UiIcon name="close" size={20} />
            </button>
          )}
        </div>
        <div className={styles.body} ref={bodyRef}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
