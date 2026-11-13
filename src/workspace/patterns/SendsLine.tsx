/** SendsLine: the muted "this transmits" line every transmitting control carries (spec §5.7). */
import type { ReactNode } from 'react';
import { UiIcon } from '../../components/icons';
import styles from './SendsLine.module.css';

// `radioSignal` is the existing RadioTower (antenna) icon; UiIcon has no icon named "antenna".
export default function SendsLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.line}>
      <UiIcon name="radioSignal" size={14} />
      <span>{children}</span>
    </p>
  );
}
