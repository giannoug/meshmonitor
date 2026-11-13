/**
 * Sheet (spec §5.7): a modal panel docked to the bottom on phone and to the
 * right from 768 px (`side="auto"`). Rendered in <body>, so no fixed shell
 * element's stacking context can trap it. Esc, the backdrop and the close
 * button close it; Tab stays inside (`useDialogA11y`, as `common/Modal`).
 */
import { useId, type ReactNode } from 'react';
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
}

export default function Sheet(props: SheetProps) {
  return props.open ? createPortal(<OpenSheet {...props} />, document.body) : null;
}

/** Mounted only while open: the a11y hook focuses on mount and restores focus on unmount. */
function OpenSheet({ onClose, title, side = 'auto', children, footer }: SheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { contentRef, onKeyDown } = useDialogA11y(onClose);
  const titleId = useId();
  const docked = side === 'auto' ? (isPhone ? 'bottom' : 'right') : side;

  return (
    <div className={styles.layer}>
      <div className={styles.backdrop} onClick={onClose} data-testid="sheet-backdrop" aria-hidden="true" />
      <div
        ref={contentRef}
        className={styles.sheet}
        data-side={docked}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {docked === 'bottom' && <span className={styles.handle} aria-hidden="true" />}
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <UiIcon name="close" size={20} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
