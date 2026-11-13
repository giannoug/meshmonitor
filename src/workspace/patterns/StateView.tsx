/**
 * StateView: one block for the five non-content states (spec §5.7). Copy is
 * today's: "Loading…" is RouteLoading's text (it has no key), the error copy is
 * `AppErrorScreen`'s, no-permission is `common.permission_denied`.
 */
import { useTranslation } from 'react-i18next';
import styles from './StateView.module.css';

export type StateKind = 'loading' | 'empty' | 'error' | 'noPermission' | 'notFound';

export interface StateViewProps {
  kind: StateKind;
  /** Overrides the default title. */
  title?: string;
  detail?: string;
  /** Error only: shows the retry button. */
  onRetry?(): void;
}

const TITLES: Record<StateKind, string> = {
  loading: 'workspace.state.loading',
  empty: 'workspace.state.empty',
  error: 'app_error.title',
  noPermission: 'common.permission_denied',
  notFound: 'errors.not_found',
};

export default function StateView({ kind, title, detail, onRetry }: StateViewProps) {
  const { t } = useTranslation();
  const shownDetail = detail ?? (kind === 'error' ? t('app_error.body') : undefined);
  return (
    <div className={styles.state} role={kind === 'error' ? 'alert' : 'status'} data-kind={kind}>
      <p className={styles.title}>{title ?? t(TITLES[kind])}</p>
      {shownDetail && <p className={styles.detail}>{shownDetail}</p>}
      {kind === 'error' && onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>{t('app_error.retry')}</button>
      )}
    </div>
  );
}
