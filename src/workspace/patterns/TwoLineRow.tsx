/**
 * TwoLineRow (spec §5.7): leading slot, a title with an optional second line,
 * a trailing slot. A link with `to`, a button with `onClick`, plain otherwise.
 * At least 52 px tall on phone.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './TwoLineRow.module.css';

export interface TwoLineRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** The row is where the viewer is now (`aria-current`). */
  active?: boolean;
  'data-testid'?: string;
}

export default function TwoLineRow({ leading, title, subtitle, trailing, to, onClick, active, ...rest }: TwoLineRowProps) {
  const inner = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.text}>
        <span className={styles.title} data-row-title="">{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  );
  const common = {
    className: `${styles.row} ${active ? styles.active : ''}`,
    'aria-current': active ? ('page' as const) : undefined,
    'data-testid': rest['data-testid'],
  };
  if (to !== undefined) {
    return <Link to={to} onClick={onClick} {...common}>{inner}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} {...common}>{inner}</button>;
  }
  return <div {...common}>{inner}</div>;
}
