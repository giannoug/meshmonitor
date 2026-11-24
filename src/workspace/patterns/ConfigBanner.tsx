/**
 * ConfigBanner (boards 17-03 / 17-10): today's config-issue banners
 * (AppBanners `configIssues`, from `/api/auth/check-config-issues`): the
 * COOKIE_SECURE error on HTTP or warning on HTTPS, each with Learn more.
 * Read once per page load, as App reads it once (no interval, no refetch), and
 * not dismissible, as today. A GET to MeshMonitor's server; nothing is sent.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { ConfigIssue } from '../../hooks/useSecurityCheck';
import apiService from '../../services/api';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './ConfigBanner.module.css';

export default function ConfigBanner() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { data } = useQuery({
    queryKey: ['workspace', 'configIssues'],
    queryFn: () => apiService.get<{ issues?: ConfigIssue[] }>('/api/auth/check-config-issues'),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const issues = data?.issues ?? [];
  if (issues.length === 0) return null;
  return (
    <>
      {issues.map((issue) => (
        <div key={issue.type} className={styles.banner} role="alert" data-severity={issue.severity} data-phone={isPhone || undefined}>
          <span className={styles.icon}>
            <UiIcon name="alert" size={20} />
          </span>
          <p className={styles.text}>
            <strong>{t('banners.config_error')}:</strong> {issue.message}
          </p>
          <a className={styles.link} href={issue.docsUrl} target="_blank" rel="noopener noreferrer">
            {t('banners.learn_more')} <UiIcon name="forward" size={14} />
          </a>
        </div>
      ))}
    </>
  );
}
