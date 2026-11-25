/** A labelled form field in a card on the Server pages: label above, help under it, then the control. */
import type { ReactNode } from 'react';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

/** `below`: a line under the control that the control points at with aria-describedby (a validation message). */
export default function Field({ label, help, below, children }: { label: string; help?: ReactNode; below?: ReactNode; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={pages.infoLabel}>{label}</span>
      {help && <span className={pages.infoHelp}>{help}</span>}
      {children}
      {below}
    </label>
  );
}
