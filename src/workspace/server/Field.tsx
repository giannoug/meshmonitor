/** A labelled form field in a card on the Server pages: label above, help under it, then the control. */
import type { ReactNode } from 'react';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

export default function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={pages.infoLabel}>{label}</span>
      {help && <span className={pages.infoHelp}>{help}</span>}
      {children}
    </label>
  );
}
