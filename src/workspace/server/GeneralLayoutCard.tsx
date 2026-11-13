/**
 * Server › General, Layout and Sources cards (board r4-server-general; spec
 * §5.1, §7.2–7.3). Admins only, like the settings it writes:
 *
 * - Default layout for new users: `defaultLayout` (a user's own `layout`
 *   preference still wins).
 * - Offer Workspace to Classic users: `offerWorkspaceBanner` (the r3 banner).
 * - Who uses which: `GET /api/admin/layout-usage`.
 * - Default device for guests: today's default Meshtastic source
 *   (`defaultMeshtasticSourceId`), with today's options.
 *
 * Each control saves as it changes (`POST /api/settings`) and shows a Saved
 * tick; a failed save puts the old value back. The rest of General stays
 * re-hosted below until Task 6.4.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import { useDashboardSources } from '../../hooks/useDashboardData';
import { logger } from '../../utils/logger';
import TwoLineRow from '../patterns/TwoLineRow';
import { installSettingsQuery } from '../layout/useLayout';
import styles from './GeneralLayoutCard.module.css';

type Settings = Record<string, string | undefined>;
const USAGE_KEY = ['admin', 'layout-usage'];

export default function GeneralLayoutCard() {
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  return isAdmin ? <Cards /> : null;
}

function Cards() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings = {} } = useQuery(installSettingsQuery);
  const usage = useQuery({
    queryKey: USAGE_KEY,
    queryFn: async () =>
      (await apiService.get<{ data?: { windowDays: number; classic: number; workspace: number } }>('/api/admin/layout-usage')).data,
  });
  const { data: sources = [] } = useDashboardSources();
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const save = async (key: string, value: string) => {
    setSaved((s) => ({ ...s, [key]: false }));
    const prev = queryClient.getQueryData<Settings>(installSettingsQuery.queryKey);
    queryClient.setQueryData<Settings>(installSettingsQuery.queryKey, { ...prev, [key]: value });
    try {
      await apiService.post('/api/settings', { [key]: value });
      setSaved((s) => ({ ...s, [key]: true }));
    } catch (error) {
      queryClient.setQueryData<Settings>(installSettingsQuery.queryKey, prev);
      logger.error(`Failed to save ${key}:`, error);
      showToast(t('common.save_failed'), 'error');
    }
    void queryClient.invalidateQueries({ queryKey: installSettingsQuery.queryKey });
    if (key === 'defaultLayout') void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
  };

  const tick = (key: string) =>
    saved[key] && (
      <span className={styles.saved}>
        <UiIcon name="check" size={14} strokeWidth={3} />
        {t('workspace.saved')}
      </span>
    );

  const select = (key: string, label: string, value: string, options: Array<[string, string]>) => (
    <>
      {tick(key)}
      <select className={styles.select} aria-label={label} value={value} onChange={(e) => void save(key, e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      <UiIcon name="chevronRight" size={18} />
    </>
  );

  // Today's choices for the default source (DefaultMeshtasticSourceSection).
  const sourceId = settings.defaultMeshtasticSourceId?.trim() ?? '';
  const tcp = sources.filter((s) => s.type === 'meshtastic_tcp');
  const sourceOptions: Array<[string, string]> = [
    ['', t('settings.default_source.automatic', 'Automatic (first started)')],
    ...tcp.map((s): [string, string] => [
      s.id,
      s.enabled ? s.name : t('settings.default_source.disabled_option', '{{name}} (disabled)', { name: s.name }),
    ]),
  ];
  if (sourceId && !tcp.some((s) => s.id === sourceId)) {
    sourceOptions.push([sourceId, t('settings.default_source.missing_option', 'Unknown source ({{id}})', { id: sourceId })]);
  }

  const offer = settings.offerWorkspaceBanner === 'true';
  const offerLabel = t('workspace.server.offer_banner');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('workspace.server.general')}</h1>
        <p className={styles.scope}>{t('workspace.server.general_scope')}</p>
      </header>

      <h2 className={styles.groupTitle}>{t('workspace.you.layout')}</h2>
      <div className={styles.group}>
        <TwoLineRow
          data-testid="general-row"
          title={t('workspace.server.default_layout')}
          subtitle={t('workspace.server.default_layout_hint')}
          trailing={select('defaultLayout', t('workspace.server.default_layout'), settings.defaultLayout === 'workspace' ? 'workspace' : 'classic', [
            ['classic', t('workspace.layout.classic')],
            ['workspace', t('workspace.layout.workspace')],
          ])}
        />
        <TwoLineRow
          data-testid="general-row"
          title={offerLabel}
          subtitle={t('workspace.server.offer_banner_hint')}
          trailing={
            <>
              {tick('offerWorkspaceBanner')}
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                aria-label={offerLabel}
                checked={offer}
                onChange={(e) => void save('offerWorkspaceBanner', String(e.target.checked))}
              />
            </>
          }
        />
        <TwoLineRow
          data-testid="general-row"
          title={t('workspace.server.usage')}
          subtitle={usage.data && t('workspace.server.usage_hint', { days: usage.data.windowDays })}
          trailing={usage.data && t('workspace.server.usage_value', { classic: usage.data.classic, workspace: usage.data.workspace })}
        />
      </div>

      <h2 className={styles.groupTitle}>{t('workspace.server.sources')}</h2>
      <div className={styles.group}>
        <TwoLineRow
          data-testid="general-row"
          title={t('workspace.server.guest_device')}
          subtitle={t('workspace.server.guest_device_hint')}
          trailing={select('defaultMeshtasticSourceId', t('workspace.server.guest_device'), sourceId, sourceOptions)}
        />
      </div>
    </div>
  );
}
