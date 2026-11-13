/**
 * You › Layout (boards r2-you-layout, s3-layout; spec §5.1–5.2): the user's
 * own choice of Classic or Workspace, and two Workspace display preferences.
 *
 * Choosing a layout saves the `layout` preference and lets the gate re-read
 * it, so the page swaps to that layout at once (and on the user's other
 * browsers at their next load). The "In Workspace" rows save
 * `workspace.messageStyle` (`rows` | `bubbles`) and `workspace.signalDetail`
 * (`hover` | `always`); Phase 2's chat reads them. A guest sees the page with
 * the controls off: preferences belong to an account.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import { logger } from '../../utils/logger';
import TwoLineRow from '../patterns/TwoLineRow';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { asLayout, type Layout } from '../layout/resolveLayout';
import { useLayout } from '../layout/useLayout';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './LayoutPage.module.css';

const LAYOUTS: Layout[] = ['classic', 'workspace'];

export default function LayoutPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus } = useAuth();
  const { showToast } = useToast();
  const { prefs, setPref } = useUserPreferences();
  const { setLayout } = useLayout();
  const signedIn = authStatus?.authenticated === true;

  // This page is only reachable in the Workspace, so no stored choice means Workspace.
  const layout = asLayout(prefs.layout) ?? 'workspace';
  const messageStyle = prefs['workspace.messageStyle'] === 'bubbles' ? 'bubbles' : 'rows';
  const signalDetail = prefs['workspace.signalDetail'] === 'always' ? 'always' : 'hover';

  const failed = (error: unknown) => {
    logger.error('Failed to save a layout preference:', error);
    showToast(t('common.save_failed'), 'error');
  };
  const choose = (l: Layout) => {
    if (l !== layout) setLayout(l).catch(failed);
  };
  const save = (key: string, value: string) => setPref(key, value).catch(failed);

  const select = (label: string, value: string, key: string, options: Array<[string, string]>) => (
    <TwoLineRow
      title={label}
      trailing={
        <select
          className={styles.select}
          aria-label={label}
          value={value}
          disabled={!signedIn}
          onChange={(e) => void save(key, e.target.value)}
        >
          {options.map(([v, text]) => (
            <option key={v} value={v}>{text}</option>
          ))}
        </select>
      }
    />
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <header className={styles.phoneHead}>
          <Link to="/you" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.tabs.you')}
          </Link>
          <h1 className={styles.phoneTitle}>{t('workspace.you.layout')}</h1>
        </header>
      ) : (
        <header className={styles.head}>
          <h1 className={styles.title}>{t('workspace.you.layout')}</h1>
          <p className={styles.scope}>{t('workspace.layout.subtitle')}</p>
        </header>
      )}

      {!signedIn && <p className={styles.note}>{t('workspace.layout.sign_in')}</p>}

      <div className={styles.cards} role="radiogroup" aria-label={t('workspace.you.layout')}>
        {LAYOUTS.map((l) => (
          <label key={l} className={styles.card} data-checked={l === layout || undefined}>
            <input
              type="radio"
              name="layout"
              className={styles.radio}
              value={l}
              checked={l === layout}
              disabled={!signedIn}
              onChange={() => choose(l)}
            />
            <span className={styles.preview} data-layout={l} aria-hidden="true">
              {l === 'classic' ? (
                <>
                  <span className={styles.topbar} />
                  <span className={styles.tabs}>
                    {Array.from({ length: 6 }, (_, i) => <span key={i} />)}
                  </span>
                  <span className={styles.body} />
                </>
              ) : (
                <>
                  <span className={styles.rail}>
                    <span /><span /><span />
                  </span>
                  <span className={styles.side} />
                  <span className={styles.body} />
                </>
              )}
            </span>
            {l === layout && (
              <span className={styles.tick} aria-hidden="true">
                <UiIcon name="check" size={16} strokeWidth={3} />
              </span>
            )}
            <span className={styles.name}>{t(`workspace.layout.${l}`)}</span>
            <span className={styles.desc}>{t(`workspace.layout.${l}_desc`)}</span>
          </label>
        ))}
      </div>

      {isPhone ? (
        <p className={styles.caption}>{t('workspace.layout.same_data_phone')}</p>
      ) : (
        <p className={styles.info}>
          <UiIcon name="info" size={18} />
          <span>{t('workspace.layout.same_data')}</span>
        </p>
      )}

      <h2 className={styles.groupTitle}>{t('workspace.layout.in_workspace')}</h2>
      <div className={styles.group}>
        {select(t('workspace.layout.messages_as'), messageStyle, 'workspace.messageStyle', [
          ['rows', t('workspace.layout.messages_rows')],
          ['bubbles', t('workspace.layout.messages_bubbles')],
        ])}
        {select(t('workspace.layout.signal_detail'), signalDetail, 'workspace.signalDetail', [
          ['hover', t('workspace.layout.signal_hover')],
          ['always', t('workspace.layout.signal_always')],
        ])}
      </div>
    </div>
  );
}
