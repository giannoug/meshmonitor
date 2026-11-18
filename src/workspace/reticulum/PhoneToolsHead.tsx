/**
 * The phone's Interfaces and Paths page head (board 9-12, note s9n4): "‹ Tools"
 * back to Home, the title, and the Interfaces / Paths segment. Each segment is
 * today's URL (`interfaces`, `paths`), so a link or reload keeps the place.
 */
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ToolHead from '../meshcore/ToolHead';
import styles from './Reticulum.module.css';

export default function PhoneToolsHead({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const base = `/source/${encodeURIComponent(sourceId)}`;
  return (
    <>
      <ToolHead title={t('workspace.reticulum.interfaces_and_paths')} back={{ label: t('workspace.home.tools'), to: base }} />
      <nav className={styles.segments} aria-label={t('workspace.reticulum.interfaces_and_paths')}>
        <NavLink to={`${base}/interfaces`} className={styles.segment}>{t('reticulum.nav.interfaces', 'Interfaces')}</NavLink>
        <NavLink to={`${base}/paths`} className={styles.segment}>{t('reticulum.nav.paths', 'Paths')}</NavLink>
      </nav>
    </>
  );
}
