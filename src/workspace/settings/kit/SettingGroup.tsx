/** A card of setting rows under an optional heading (b-set-d1). */
import { useId, type ReactNode } from 'react';
import styles from './kit.module.css';

export default function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className={styles.group} role="group" aria-labelledby={title ? titleId : undefined}>
      {title && <h2 className={styles.groupTitle} id={titleId}>{title}</h2>}
      <div className={styles.card}>{children}</div>
    </section>
  );
}
