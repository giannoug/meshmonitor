/**
 * The frame of a You page (r1, s4, 11-03…11-13): on desktop a crumb, the
 * title, the "Only you · …" scope line and optional head actions; on phone a
 * header with the way back (a link, or a button where going back cancels a
 * step) and the title. Same frame as You › Layout and Notifications.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UiIcon } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import layout from './LayoutPage.module.css';
import styles from './YouAccount.module.css';

export interface YouPageFrameProps {
  title: string;
  scope?: string;
  crumb?: string;
  /** Phone: where the back control goes, and its label; none where there is no way back (forced). */
  back?: { label: string; to?: string; onClick?: () => void };
  actions?: ReactNode;
  children: ReactNode;
}

export default function YouPageFrame({ title, scope, crumb, back, actions, children }: YouPageFrameProps) {
  const isPhone = useIsPhone();
  const backInner = back && (
    <>
      <UiIcon name="back" size={20} />
      {back.label}
    </>
  );
  return (
    <div className={`${layout.page} ${styles.page}`} data-phone={isPhone || undefined}>
      {isPhone ? (
        <header className={layout.phoneHead}>
          {back &&
            (back.to !== undefined ? (
              <Link to={back.to} className={layout.back}>{backInner}</Link>
            ) : (
              <button type="button" className={`${layout.back} ${styles.backButton}`} onClick={back.onClick}>{backInner}</button>
            ))}
          <h1 className={layout.phoneTitle}>{title}</h1>
        </header>
      ) : (
        <header className={`${layout.head} ${styles.head}`}>
          <div className={styles.headText}>
            {crumb && <p className={styles.crumb}>{crumb}</p>}
            <h1 className={layout.title}>{title}</h1>
            {scope && <p className={layout.scope}>{scope}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </div>
  );
}

/** A titled group of the page ("Password", "Two-Factor Authentication" …). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}
