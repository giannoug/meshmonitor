/**
 * The node page's facts cards (the boards' RADIO, POSITION, IDENTITY, HISTORY
 * sections): a heading over a bordered list of label / value rows.
 */
import type { ReactNode } from 'react';
import styles from './Facts.module.css';

/** A row of a facts card: label left, value right. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A titled card of facts (the board's RADIO / POSITION / IDENTITY sections). */
export function FactCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${styles.section} ${className ?? ''}`} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}

/** The bordered list a FactCard holds. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className={styles.facts}>{children}</dl>;
}
