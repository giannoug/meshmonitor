/**
 * The frame every Overview › Reports page shares (boards 6-01 … 6-15): the
 * way back, the title with its one-line status, and the page's actions.
 * Desktop pages under the list draw "Back to reports" above the title; on
 * the phone the frame draws its own header (the shell's device header is
 * off on these routes), back to the Overview from the list and back to the
 * list from a report. It also loads today's report styles, so the reused
 * Classic parts look as they do in Classic.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import { useReportsBase } from './reportsPaths';
import '../../styles/analysis-reports.css';
import styles from './ReportFrame.module.css';

interface ReportFrameProps {
  /** `overview` on the list, `reports` on a report. */
  back: 'overview' | 'reports';
  /** Omitted when the page has no title of its own. */
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function ReportFrame({ back, title, subtitle, actions, children }: ReportFrameProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const base = useReportsBase();
  const backLink = (
    <Link to={back === 'overview' ? '/overview' : base} className={styles.back}>
      <UiIcon name="back" size={isPhone ? 20 : 16} />
      {back === 'overview' ? t('workspace.shell.overview') : t('analysis.back_to_reports', 'Back to reports')}
    </Link>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined} data-testid="report-frame">
      {isPhone ? <header className={styles.phoneHead}>{backLink}</header> : back === 'reports' && backLink}
      {(title || actions) && (
        <div className={styles.head}>
          <div className={styles.headText}>
            {title && <h1 className={styles.title}>{title}</h1>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
