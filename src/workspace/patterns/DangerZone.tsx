/** DangerZone: the red card that ends a category (spec §5.7). Its buttons open a ConfirmSheet. */
import type { ReactNode } from 'react';
import styles from './DangerZone.module.css';

export default function DangerZone({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.zone}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </section>
  );
}
