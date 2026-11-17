/**
 * First run (board h6, note ds7): an admin on an install with no devices
 * lands here in place of the Overview. It leads to the Add device flow
 * (Task 6.6, `?add=1`), to Server › Backup to restore one, and to the
 * getting-started guide. The type list names what can be added; it is not a
 * second flow.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MESHMONITOR_WEBSITE_URL } from '../../components/SidebarFooter';
import { useIsPhone } from '../shell/useIsPhone';
import { DEVICE_TYPES } from './deviceInfo';
import styles from './FirstRun.module.css';

export default function FirstRun() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <section className={styles.page} data-phone={isPhone || undefined}>
      <span className={styles.mark} aria-hidden="true">
        <UiIcon name="radioSignal" size={36} />
      </span>
      <h1 className={styles.title}>{t('workspace.first_run.title')}</h1>
      <p className={styles.body}>{t('workspace.first_run.body')}</p>
      <div className={styles.actions}>
        <Link className={`${styles.button} ${styles.primary}`} to="/server/devices?add=1">
          <UiIcon name="plus" size={18} />
          {t('workspace.first_run.add')}
        </Link>
        <Link className={styles.button} to="/server/backup">
          {t('workspace.first_run.restore')}
        </Link>
      </div>
      <ul className={styles.types} aria-label={t('workspace.first_run.types')}>
        {DEVICE_TYPES.map(({ type, icon, tone }) => (
          <li key={type} className={styles.type}>
            <span className={styles.typeIcon} style={{ background: `var(--device-${tone})` }} aria-hidden="true">
              <UiIcon name={icon} size={18} />
            </span>
            {t(`workspace.devices.type.${type}`)}
          </li>
        ))}
      </ul>
      <a className={styles.guide} href={`${MESHMONITOR_WEBSITE_URL}/getting-started`} target="_blank" rel="noopener noreferrer">
        {t('workspace.first_run.guide')}
      </a>
    </section>
  );
}
