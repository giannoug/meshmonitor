/**
 * StateView: one block for the five non-content states (spec §5.7, boards
 * 17-04 / 17-11). Copy is today's: "Loading…" is RouteLoading's text (it has
 * no key, and like RouteLoading the loading state calls no i18n hook, so it
 * can be a Suspense fallback), the error copy is `AppErrorScreen`'s,
 * no-permission is `common.permission_denied` unless a page names its grant.
 *
 * An `error` (a route's thrown value, ShellRouteBoundary) adds today's Error
 * details and Reload page beside Try again.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { describeError } from '../../components/common/describeError';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './StateView.module.css';

export type StateKind = 'loading' | 'empty' | 'error' | 'noPermission' | 'notFound';

export interface StateViewProps {
  kind: StateKind;
  /** Overrides the default title. */
  title?: ReactNode;
  detail?: string;
  /** Error only: shows the retry button. */
  onRetry?(): void;
  /** Error only: the thrown value, shown under Error details, with Reload page. */
  error?: unknown;
  /** Empty only: the icon over the title. */
  icon?: UiIconName;
  /** Fills the viewport (a whole page in flight), as RouteLoading's page variant. */
  page?: boolean;
}

const TITLES: Record<Exclude<StateKind, 'loading'>, string> = {
  empty: 'workspace.state.empty',
  error: 'app_error.title',
  noPermission: 'common.permission_denied',
  notFound: 'errors.not_found',
};

const ICONS: Partial<Record<StateKind, UiIconName>> = { error: 'alert', noPermission: 'encrypted' };

export default function StateView(props: StateViewProps) {
  return props.kind === 'loading' ? <Loading {...props} /> : <Other {...props} />;
}

function Loading({ title, page }: StateViewProps) {
  return (
    <div className={styles.state} role="status" data-kind="loading" data-page={page || undefined}>
      <p className={styles.loading}>{title ?? 'Loading…'}</p>
    </div>
  );
}

function Other({ kind, title, detail, onRetry, error, icon, page }: StateViewProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const shownDetail = detail ?? (kind === 'error' ? t('app_error.body') : undefined);
  const shownIcon = icon ?? ICONS[kind];
  const body = (
    <>
      {shownIcon && (
        <span className={styles.icon}>
          <UiIcon name={shownIcon} size={kind === 'error' ? 28 : 22} />
        </span>
      )}
      <p className={styles.title}>{title ?? t(TITLES[kind as Exclude<StateKind, 'loading'>])}</p>
      {shownDetail && <p className={styles.detail}>{shownDetail}</p>}
      {kind === 'error' && error != null && (
        <details className={styles.details}>
          <summary>
            <UiIcon name="chevronDown" size={16} />
            {t('app_error.details')}
          </summary>
          <pre>{describeError(error)}</pre>
        </details>
      )}
      {kind === 'error' && (onRetry || error != null) && (
        <div className={styles.actions}>
          {onRetry && (
            <button type="button" className={error != null ? styles.primary : styles.retry} onClick={onRetry}>
              {error != null && <UiIcon name="refresh" size={16} />}
              {t('app_error.retry')}
            </button>
          )}
          {error != null && (
            <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
              {t('app_error.reload')}
            </button>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className={styles.state} role={kind === 'error' ? 'alert' : 'status'} data-kind={kind} data-page={page || undefined} data-phone={isPhone || undefined}>
      {kind === 'noPermission' ? <div className={styles.card}>{body}</div> : body}
    </div>
  );
}
