/**
 * You › Help & about (boards 13-14 desktop, 13-29 phone; Task 6.3). Everyone
 * sees it (s13n2).
 *
 * - System status: today's System Status rows (`GET /api/system/status`,
 *   dashboard:read), read once when the page opens; no poll, as today's
 *   modal. Disconnect / Connect stay in the device's Connection popover.
 * - News: the newest three items of today's feed (`GET /api/news`), new ones
 *   marked as today's popup counts them (`unseenNewsItems`); Show all news
 *   opens today's NewsPopup with `forceShowAll`, which marks nothing seen.
 * - Help: today's settings-header documentation and Ko-fi links, and the
 *   sidebar footer's GitHub link, in a new tab.
 */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { version } from '../../../../package.json';
import { BrandIcon, UiIcon } from '../../../components/icons';
import { NewsPopup } from '../../../components/NewsPopup';
import { unseenNewsItems } from '../../../components/NewsPopup/unseenNews';
import { MESHMONITOR_GITHUB_URL, MESHMONITOR_KOFI_URL } from '../../../components/SidebarFooter';
import { useAuth } from '../../../contexts/AuthContext';
import apiService from '../../../services/api';
import type { NewsItem, SystemStatus } from '../../../types/ui';
import StateView from '../../patterns/StateView';
import SettingGroup from '../../settings/kit/SettingGroup';
import { useIsPhone } from '../../shell/useIsPhone';
import PrefsFrame from './PrefsFrame';
import styles from './Preferences.module.css';

/** Today's settings-header documentation link. */
export const DOCS_URL = 'https://meshmonitor.org/features/settings';

/** Read when the page opens, not again until it opens again (no interval, no refetch on focus). */
const ONCE = { staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

export default function HelpAboutPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <PrefsFrame
      categoryId="help"
      title={t('workspace.you.help_about')}
      icon="info"
      scope={t('workspace.help.scope', { version })}
      readOnly={false}
      needsSettings={false}
    >
      <div className={styles.columns} data-phone={isPhone || undefined}>
        <div className={styles.column}>
          <SystemStatusCard />
        </div>
        <div className={styles.column}>
          <NewsCard />
          <HelpLinks />
        </div>
      </div>
    </PrefsFrame>
  );
}

function SystemStatusCard() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  // Today's route gate (requirePermission dashboard:read, no source).
  const allowed = hasPermission('dashboard', 'read', { anySource: true });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace', 'help', 'system-status'],
    queryFn: () => apiService.get<SystemStatus>('/api/system/status'),
    enabled: allowed,
    ...ONCE,
  });

  const rows: Array<[string, string]> = data
    ? [
        [t('system_status.version', 'Version'), data.version],
        [t('system_status.node_version', 'Node.js Version'), data.nodeVersion],
        [t('system_status.uptime', 'Uptime'), data.uptime],
        [t('system_status.platform', 'Platform'), `${data.platform} (${data.architecture})`],
        [t('system_status.environment', 'Environment'), data.environment],
        [t('system_status.memory_heap_used', 'Memory (Heap Used)'), data.memoryUsage.heapUsed],
        [t('system_status.memory_heap_total', 'Memory (Heap Total)'), data.memoryUsage.heapTotal],
        [t('system_status.memory_rss', 'Memory (RSS)'), data.memoryUsage.rss],
        ...(data.database ? [[t('system_status.database', 'Database'), `${data.database.type} ${data.database.version}`] as [string, string]] : []),
      ]
    : [];

  let body;
  if (!allowed) body = <StateView kind="noPermission" />;
  else if (isLoading) body = <StateView kind="loading" />;
  else if (isError || !data) body = <StateView kind="error" onRetry={() => void refetch()} />;
  else
    body = rows.map(([label, value]) => (
      <div key={label} className={styles.statusRow}>
        <span className={styles.statusLabel}>{label}</span>
        <span className={styles.statusValue}>{value}</span>
      </div>
    ));

  return (
    <>
      <SettingGroup title={t('system_status.title', 'System Status')}>{body}</SettingGroup>
      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.help.connection_note')}</span>
      </p>
    </>
  );
}

const CATEGORY_KEYS: Record<NewsItem['category'], [string, string]> = {
  release: ['news.category.release', 'Release'],
  security: ['news.category.security', 'Security'],
  feature: ['news.category.feature', 'Feature'],
  maintenance: ['news.category.maintenance', 'Maintenance'],
};

/** NewsPopup's date format. */
function newsDate(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function NewsCard() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const [open, setOpen] = useState(false);
  const feed = useQuery({ queryKey: ['workspace', 'help', 'news'], queryFn: () => apiService.getNewsFeed(), ...ONCE });
  // As today's popup: a guest has no seen state.
  const status = useQuery({
    queryKey: ['workspace', 'help', 'news-status'],
    queryFn: () => apiService.getUserNewsStatus(),
    enabled: signedIn,
    ...ONCE,
  });

  const items = [...(feed.data?.items ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) as NewsItem[];
  const unseen = new Set(status.data ? unseenNewsItems(items, status.data).map((i) => i.id) : []);

  let body;
  if (feed.isLoading) body = <StateView kind="loading" />;
  else if (feed.isError) body = <StateView kind="error" onRetry={() => void feed.refetch()} />;
  else if (items.length === 0) body = <StateView kind="empty" title={t('news.no_news', 'No news at this time.')} />;
  else
    body = items.slice(0, 3).map((item) => {
      const [key, fallback] = CATEGORY_KEYS[item.category] ?? [item.category, item.category];
      return (
        <div key={item.id} className={styles.themeRow} data-phone={isPhone || undefined}>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              {item.title}
              {item.priority === 'important' && <span className={styles.badge}>{t('news.important', 'Important')}</span>}
            </span>
            <span className={styles.rowSub}>{`${t(key, fallback)} · ${newsDate(item.date)}`}</span>
          </span>
          {unseen.has(item.id) && <span className={styles.dot} role="img" aria-label={t('workspace.help.news_new')} />}
        </div>
      );
    });

  return (
    <SettingGroup title={t('news.title', 'News')}>
      {body}
      <div className={styles.foot}>
        <button type="button" className={styles.button} data-phone={isPhone || undefined} onClick={() => setOpen(true)}>
          {t('workspace.help.show_all_news')}
        </button>
      </div>
      <NewsPopup
        isOpen={open}
        onClose={() => {
          setOpen(false);
          // The popup may have changed what is seen: read the status again, once.
          if (signedIn) void status.refetch();
        }}
        forceShowAll
        isAuthenticated={signedIn}
      />
    </SettingGroup>
  );
}

function HelpLinks() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const link = (href: string, icon: ReactNode, title: string, sub: string, action: string) => (
    <a key={href} className={styles.rowLink} data-phone={isPhone || undefined} href={href} target="_blank" rel="noopener noreferrer">
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {!isPhone && <span className={styles.rowSub}>{sub}</span>}
      </span>
      {isPhone ? (
        <>
          <span className={styles.rowValue}>{sub}</span>
          <UiIcon name="chevronRight" size={18} />
        </>
      ) : (
        <span className={styles.pill}>
          <UiIcon name="link" size={16} />
          {action}
        </span>
      )}
    </a>
  );
  return (
    <SettingGroup title={t('workspace.help.help')}>
      {link(DOCS_URL, <UiIcon name="help" size={18} />, t('settings.view_docs'), 'meshmonitor.org', t('workspace.help.open'))}
      {link(MESHMONITOR_GITHUB_URL, <BrandIcon brand="github" size={18} />, t('source.sidebar.github'), t('workspace.help.github_desc'), t('workspace.help.open'))}
      {link(MESHMONITOR_KOFI_URL, <UiIcon name="heart" size={18} />, t('source.sidebar.support'), 'ko-fi.com/yeraze', t('workspace.help.kofi'))}
    </SettingGroup>
  );
}
