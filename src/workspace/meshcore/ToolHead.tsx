/**
 * A MeshCore tool page's head (Task 7.5): on desktop the title, its subtitle
 * and the page's actions; on the phone "‹ <back>", the title and the actions
 * at the end (8-29, 8-30, 8-31), back to the device's Home.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UiIcon } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './McTools.module.css';

export interface ToolHeadProps {
  title: string;
  subtitle?: ReactNode;
  /** The phone's back link: its label and target. */
  back: { label: string; to: string };
  actions?: ReactNode;
  /** Phone: what sits at the end of the bar (default `actions`). */
  phoneActions?: ReactNode;
}

export default function ToolHead({ title, subtitle, back, actions, phoneActions = actions }: ToolHeadProps) {
  const isPhone = useIsPhone();
  if (isPhone) {
    return (
      <header className={styles.phoneHead}>
        <Link className={styles.back} to={back.to}>
          <UiIcon name="back" size={22} />
          <span>{back.label}</span>
        </Link>
        <h1 className={styles.phoneTitle}>{title}</h1>
        <span className={styles.phoneEnd}>{phoneActions}</span>
      </header>
    );
  }
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
